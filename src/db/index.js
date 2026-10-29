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
    db.exec('CREATE TABLE IF NOT EXISTS revoked_tokens (token TEXT PRIMARY KEY, revoked_at TEXT DEFAULT (datetime(\'now\')));');
  } catch (err) {
    // Table already exists
  }

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
