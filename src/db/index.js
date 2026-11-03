const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let instance = null;

function resolveDatabasePath(dbPath) {
  if (dbPath) return dbPath;
  if (process.env.DB_PATH) return process.env.DB_PATH;

  // Serverless environment detection (Vercel, AWS Lambda)
  // In serverless, root filesystem is read-only; only os.tmpdir() (/tmp) is writable.
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );

  if (isServerless) {
    const tmpDbPath = path.join(os.tmpdir(), 'eduque.db');
    if (!fs.existsSync(tmpDbPath)) {
      const candidates = [
        path.join(__dirname, '../../data/eduque.db'),
        path.join(process.cwd(), 'data/eduque.db')
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            fs.copyFileSync(candidate, tmpDbPath);
            break;
          } catch (e) {
            // Ignore copy error and let DatabaseSync create a clean DB
          }
        }
      }
    }
    return tmpDbPath;
  }

  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'eduque.db');
}

function initDatabase(dbPath) {
  dbPath = resolveDatabasePath(dbPath);

  const db = new DatabaseSync(dbPath);
  
  // Enable foreign keys and WAL performance mode if file-backed
  try {
    db.exec('PRAGMA foreign_keys = ON;');
    if (dbPath !== ':memory:') {
      db.exec('PRAGMA journal_mode = WAL;');
    }
  } catch (err) {
    // Ignore pragma error in test / memory mode if unsupported
  }

  // Load and apply schema
  const { schemaSql } = require('./schema');
  db.exec(schemaSql);

  // Safe migrations
  try {
    db.exec('ALTER TABLE classes ADD COLUMN instructor_id TEXT REFERENCES users(id);');
  } catch (err) {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE course_access_codes ADD COLUMN class_id TEXT REFERENCES classes(id);');
  } catch (err) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE assessments ADD COLUMN sections TEXT DEFAULT '["Section 1","Section 2","Section 3"]';`);
  } catch (err) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE attempt_answers ADD COLUMN section_name TEXT DEFAULT 'Section 1';`);
  } catch (err) {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE attempt_answers ADD COLUMN order_index INTEGER DEFAULT 0;');
  } catch (err) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE classes ADD COLUMN unlocked_sections TEXT DEFAULT '["Section 1"]';`);
  } catch (err) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE student_attempts ADD COLUMN completed_sections TEXT DEFAULT '[]';`);
  } catch (err) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE student_attempts ADD COLUMN is_paused INTEGER DEFAULT 0;`);
  } catch (err) {}
  try {
    db.exec(`ALTER TABLE student_attempts ADD COLUMN paused_remaining_seconds INTEGER DEFAULT NULL;`);
  } catch (err) {}
  try {
    db.exec(`UPDATE classes SET unlocked_sections = '["Section 1"]' WHERE unlocked_sections IS NULL;`);
  } catch (err) {}
  try {
    db.exec(`UPDATE student_attempts SET completed_sections = '[]' WHERE completed_sections IS NULL;`);
  } catch (err) {}
  try {
    // Default all draft questions to published so they are active and exam-ready
    db.exec(`UPDATE questions SET status = 'published' WHERE status = 'draft';`);
  } catch (err) {}
  try {
    db.exec('CREATE TABLE IF NOT EXISTS revoked_tokens (token TEXT PRIMARY KEY, revoked_at TEXT DEFAULT (datetime(\'now\')));');
  } catch (err) {
    // Table already exists
  }

  // Idempotent migration to ensure AZ-900 / AZ-104 questions are evenly distributed across sections (14, 14, 13)
  try {
    const s1Row = db.prepare(`SELECT COUNT(*) as count FROM assessment_questions WHERE assessment_id = '49f35cbd-3b72-4e1c-849c-c898f08f41e9' AND section_name = 'Section 1'`).get();
    const s2Row = db.prepare(`SELECT COUNT(*) as count FROM assessment_questions WHERE assessment_id = '49f35cbd-3b72-4e1c-849c-c898f08f41e9' AND section_name = 'Section 2'`).get();
    const s1Count = s1Row ? s1Row.count : 0;
    const s2Count = s2Row ? s2Row.count : 0;
    if (s1Count >= 25 && s2Count <= 5) {
      const allQuestions = db.prepare(`SELECT id, question_id FROM assessment_questions WHERE assessment_id = '49f35cbd-3b72-4e1c-849c-c898f08f41e9' ORDER BY order_index ASC, id ASC`).all();
      const updateAqStmt = db.prepare(`UPDATE assessment_questions SET section_name = ?, order_index = ? WHERE id = ?`);
      const updateAaStmt = db.prepare(`UPDATE attempt_answers SET section_name = ?, order_index = ? WHERE question_id = ? AND attempt_id IN (SELECT id FROM student_attempts WHERE assessment_id = '49f35cbd-3b72-4e1c-849c-c898f08f41e9')`);
      allQuestions.forEach((q, idx) => {
        let sec = 'Section 1';
        if (idx >= 28) sec = 'Section 3';
        else if (idx >= 14) sec = 'Section 2';
        updateAqStmt.run(sec, idx, q.id);
        try {
          updateAaStmt.run(sec, idx, q.question_id);
        } catch (_) {}
      });
    }
  } catch (err) {}

  try {
    db.exec(`
      UPDATE attempt_answers
      SET section_name = (
        SELECT aq.section_name
        FROM assessment_questions aq
        JOIN student_attempts sa ON sa.id = attempt_answers.attempt_id
        WHERE aq.assessment_id = sa.assessment_id AND aq.question_id = attempt_answers.question_id
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1
        FROM assessment_questions aq
        JOIN student_attempts sa ON sa.id = attempt_answers.attempt_id
        WHERE aq.assessment_id = sa.assessment_id AND aq.question_id = attempt_answers.question_id
          AND aq.section_name != attempt_answers.section_name
      );
    `);
  } catch (err) {}

  const wrapper = {
    raw: db,
    dbPath,
    get(sql, params = []) {
      const stmt = db.prepare(sql);
      return stmt.get(...params);
    },
    all(sql, params = []) {
      const stmt = db.prepare(sql);
      return stmt.all(...params);
    },
    run(sql, params = []) {
      const stmt = db.prepare(sql);
      return stmt.run(...params);
    },
    transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = fn(wrapper);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    close() {
      try {
        db.close();
      } catch (e) {
        // ignore
      }
    }
  };

  return wrapper;
}

function getDatabase(dbPath) {
  if (!dbPath && instance) {
    return instance;
  }
  const targetPath = resolveDatabasePath(dbPath);
  if (!instance || (dbPath && instance.dbPath !== targetPath)) {
    instance = initDatabase(targetPath);
  }
  return instance;
}

function setDatabaseInstance(db) {
  instance = db;
}

module.exports = {
  initDatabase,
  getDatabase,
  setDatabaseInstance,
  resolveDatabasePath
};
