// Eduqe Supabase Integration Service
// Communicates with Supabase via PostgREST using native Node.js fetch (zero external dependencies)

const { getDatabase } = require('../db');

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
  return {
    url: url ? url.replace(/\/+$/, '') : null,
    key: key ? key.trim() : null,
    isEnabled: Boolean(url && key)
  };
}

async function supabaseRequest(tableOrPath, { method = 'GET', body = null, headers = {} } = {}) {
  const config = getSupabaseConfig();
  if (!config.isEnabled) return null;

  const endpoint = `${config.url}/rest/v1/${tableOrPath.replace(/^\/+/, '')}`;
  const reqHeaders = {
    'apikey': config.key,
    'Authorization': `Bearer ${config.key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation,resolution=merge-duplicates',
    ...headers
  };

  const res = await fetch(endpoint, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Supabase API request failed (${res.status}): ${errorText}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// -------------------------------------------------------------
// CONTINUOUS REAL-TIME SYNC & LOCAL CACHE MANAGEMENT
// -------------------------------------------------------------

const tableLastSync = new Map();
const inFlightPulls = new Map();
const SYNC_CACHE_TTL_MS = 30000; // 30 seconds cache window (mutations immediately invalidate cache)

function invalidateTableCache(tableName = null) {
  if (tableName) {
    tableLastSync.delete(tableName);
  } else {
    tableLastSync.clear();
  }
}

async function pullTable(table) {
  const config = getSupabaseConfig();
  if (!config.isEnabled) return 0;

  // Deduplicate concurrent in-flight requests for the same table
  if (inFlightPulls.has(table)) {
    return inFlightPulls.get(table);
  }

  const pullPromise = (async () => {
    const db = getDatabase();
    try {
      const rows = await supabaseRequest(`${table}?select=*&limit=10000`, { method: 'GET' });
      if (!Array.isArray(rows)) return 0;

      const tableCols = db.all(`PRAGMA table_info("${table}")`);
      if (!tableCols || tableCols.length === 0) return 0;

      const hasId = tableCols.some(c => c.name === 'id');
      const localColSet = new Set(tableCols.map(c => c.name));

      if (rows.length === 0) {
        // If remote table has 0 rows, preserve existing local cache rows to prevent
        // wiping newly seeded records or in-flight attempts before they sync
        tableLastSync.set(table, Date.now());
        return 0;
      }

      const remoteCols = Object.keys(rows[0]);
      const matchingCols = remoteCols.filter(c => localColSet.has(c));
      if (matchingCols.length === 0) return 0;

      const placeholders = matchingCols.map(() => '?').join(', ');
      const colNames = matchingCols.map(c => `"${c}"`).join(', ');

      // Temporarily turn OFF foreign key checks during hydration from Supabase
      // to prevent rollback due to inter-table foreign key resolution order
      try {
        db.run('PRAGMA foreign_keys = OFF;');
      } catch (e) {}

      try {
        db.transaction(() => {
          // Upsert latest rows from Supabase into local cache without deleting local un-synced rows
          for (const row of rows) {
            const vals = matchingCols.map(c => {
              const val = row[c];
              if (val !== null && typeof val === 'object') {
                return JSON.stringify(val);
              }
              return val;
            });
            db.run(
              `INSERT OR REPLACE INTO "${table}" (${colNames}) VALUES (${placeholders})`,
              vals
            );
          }
        });
      } finally {
        try {
          db.run('PRAGMA foreign_keys = ON;');
        } catch (e) {}
      }

      tableLastSync.set(table, Date.now());
      return rows.length;
    } catch (err) {
      console.warn(`[Supabase Pull Warning] Error pulling table ${table}:`, err.message);
      return 0;
    } finally {
      inFlightPulls.delete(table);
    }
  })();

  inFlightPulls.set(table, pullPromise);
  return pullPromise;
}

async function ensureTableFresh(table, maxAgeMs = SYNC_CACHE_TTL_MS) {
  const config = getSupabaseConfig();
  if (!config.isEnabled) return;

  const now = Date.now();
  const lastSync = tableLastSync.get(table) || 0;
  if (now - lastSync < maxAgeMs) {
    return;
  }
  await pullTable(table);
}

async function ensureTablesFresh(tables = [], maxAgeMs = SYNC_CACHE_TTL_MS) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !tables || tables.length === 0) return;

  const now = Date.now();
  const needed = [...new Set(tables)].filter(table => {
    const lastSync = tableLastSync.get(table) || 0;
    return (now - lastSync) >= maxAgeMs;
  });

  if (needed.length === 0) return;

  // Execute all required table refreshes concurrently in parallel
  await Promise.all(needed.map(table => pullTable(table)));
}

// -------------------------------------------------------------
// GENERIC UPSERT / DELETE HELPERS
// -------------------------------------------------------------

async function upsertRecord(tableName, record, conflictColumns = null) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !record) return null;
  invalidateTableCache(tableName);

  let conflictParam = conflictColumns || 'id';
  if (!conflictColumns) {
    if (tableName === 'class_enrollments') conflictParam = 'class_id,user_id';
    else if (tableName === 'assessment_classes') conflictParam = 'assessment_id,class_id';
    else if (tableName === 'course_access_codes') conflictParam = 'code';
    else if (tableName === 'eduque_settings') conflictParam = 'key';
  }

  try {
    let res;
    try {
      res = await supabaseRequest(`${tableName}?on_conflict=${conflictParam}`, {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: record
      });
    } catch (firstErr) {
      if (conflictParam !== 'id') {
        res = await supabaseRequest(`${tableName}?on_conflict=id`, {
          method: 'POST',
          headers: {
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: record
        });
      } else {
        throw firstErr;
      }
    }
    invalidateTableCache(tableName);
    return res;
  } catch (err) {
    console.warn(`[Supabase Sync Warning] Could not sync to ${tableName}:`, err.message);
    return null;
  }
}

async function upsertRecords(tableName, records, conflictColumns = null) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !records) return null;
  const items = Array.isArray(records) ? records : [records];
  if (items.length === 0) return [];

  invalidateTableCache(tableName);

  let conflictParam = conflictColumns || 'id';
  if (!conflictColumns) {
    if (tableName === 'class_enrollments') conflictParam = 'class_id,user_id';
    else if (tableName === 'assessment_classes') conflictParam = 'assessment_id,class_id';
    else if (tableName === 'course_access_codes') conflictParam = 'code';
    else if (tableName === 'eduque_settings') conflictParam = 'key';
  }

  try {
    let res;
    try {
      res = await supabaseRequest(`${tableName}?on_conflict=${conflictParam}`, {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: items
      });
    } catch (firstErr) {
      if (conflictParam !== 'id') {
        res = await supabaseRequest(`${tableName}?on_conflict=id`, {
          method: 'POST',
          headers: {
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: items
        });
      } else {
        throw firstErr;
      }
    }
    invalidateTableCache(tableName);
    return res;
  } catch (err) {
    console.warn(`[Supabase Bulk Sync Warning] Could not sync batch to ${tableName}:`, err.message);
    return null;
  }
}

async function deleteRecord(tableName, id) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !id) return null;
  invalidateTableCache(tableName);
  try {
    const res = await supabaseRequest(`${tableName}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    invalidateTableCache(tableName);
    return res;
  } catch (err) {
    console.warn(`[Supabase Delete Warning] Could not delete from ${tableName}:`, err.message);
    return null;
  }
}

// -------------------------------------------------------------
// SPECIFIC ENTITY SYNCERS
// -------------------------------------------------------------

async function syncUserToSupabase(userOrId) {
  if (!userOrId) return;
  const db = getDatabase();
  let user = null;
  if (typeof userOrId === 'string') {
    user = db.get('SELECT * FROM users WHERE id = ?', [userOrId]);
  } else if (userOrId && userOrId.id) {
    // If user object was passed (e.g. from authService), re-fetch from SQLite to guarantee password_hash and timestamps exist
    user = db.get('SELECT * FROM users WHERE id = ?', [userOrId.id]) || userOrId;
  } else {
    user = userOrId;
  }
  if (!user) return;
  return await upsertRecord('users', user);
}

async function syncClassToSupabase(classOrId) {
  if (!classOrId) return;
  const db = getDatabase();
  const cls = typeof classOrId === 'string' ? db.get('SELECT * FROM classes WHERE id = ?', [classOrId]) : classOrId;
  if (!cls) return;

  // Guarantee parent course and instructor exist in Supabase first to satisfy FK constraints
  if (cls.course_id) {
    try {
      await syncCourseToSupabase(cls.course_id);
    } catch (e) {}
  }
  if (cls.instructor_id) {
    try {
      await syncUserToSupabase(cls.instructor_id);
    } catch (e) {}
  }

  await upsertRecord('classes', cls);

  // Sync associated active codes and assessment links
  try {
    const codes = db.all('SELECT * FROM course_access_codes WHERE class_id = ?', [cls.id]);
    if (codes && codes.length > 0) {
      for (const code of codes) {
        await upsertRecord('course_access_codes', code, 'code');
      }
    }
    const acLinks = db.all('SELECT * FROM assessment_classes WHERE class_id = ?', [cls.id]);
    if (acLinks && acLinks.length > 0) {
      for (const ac of acLinks) {
        await upsertRecord('assessment_classes', ac, 'assessment_id,class_id');
      }
    }
  } catch (e) {
    // Ignore relational query error
  }
}

async function deleteClassFromSupabase(classId) {
  if (!classId) return;
  return await deleteRecord('classes', classId);
}

async function syncCourseToSupabase(courseOrId) {
  if (!courseOrId) return;
  const db = getDatabase();
  const course = typeof courseOrId === 'string' ? db.get('SELECT * FROM courses WHERE id = ?', [courseOrId]) : courseOrId;
  if (!course) return;
  return await upsertRecord('courses', course);
}

async function deleteCourseFromSupabase(courseId) {
  if (!courseId) return;
  return await deleteRecord('courses', courseId);
}

async function syncAccessCodeToSupabase(codeOrId) {
  if (!codeOrId) return;
  const db = getDatabase();
  const code = typeof codeOrId === 'string' ? db.get('SELECT * FROM course_access_codes WHERE id = ? OR code = ?', [codeOrId, codeOrId]) : codeOrId;
  if (!code) return;
  if (code.course_id) {
    try {
      await syncCourseToSupabase(code.course_id);
    } catch (e) {}
  }
  return await upsertRecord('course_access_codes', code, 'code');
}

async function syncEnrollmentToSupabase(enrollmentOrId) {
  if (!enrollmentOrId) return;
  const db = getDatabase();
  const enrollment = typeof enrollmentOrId === 'string' ? db.get('SELECT * FROM class_enrollments WHERE id = ?', [enrollmentOrId]) : enrollmentOrId;
  if (!enrollment) return;

  // Guarantee parent class and user exist in Supabase first
  if (enrollment.class_id) {
    try {
      await syncClassToSupabase(enrollment.class_id);
    } catch (e) {}
  }
  if (enrollment.user_id) {
    try {
      await syncUserToSupabase(enrollment.user_id);
    } catch (e) {}
  }

  return await upsertRecord('class_enrollments', enrollment, 'class_id,user_id');
}

async function deleteEnrollmentFromSupabase(classId, userId) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !classId || !userId) return null;
  try {
    return await supabaseRequest(`class_enrollments?class_id=eq.${encodeURIComponent(classId)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn('[Supabase Delete Warning] Could not delete class enrollment:', err.message);
    return null;
  }
}

async function syncAssessmentToSupabase(assessmentOrId) {
  if (!assessmentOrId) return;
  const db = getDatabase();
  const assess = typeof assessmentOrId === 'string' ? db.get('SELECT * FROM assessments WHERE id = ?', [assessmentOrId]) : assessmentOrId;
  if (!assess) return;

  if (assess.course_id) {
    try {
      await syncCourseToSupabase(assess.course_id);
    } catch (e) {}
  }

  await upsertRecord('assessments', assess);

  try {
    const aqs = db.all('SELECT * FROM assessment_questions WHERE assessment_id = ?', [assess.id]);
    if (aqs && aqs.length > 0) {
      await upsertRecords('assessment_questions', aqs, 'id');
    }
    const acs = db.all('SELECT * FROM assessment_classes WHERE assessment_id = ?', [assess.id]);
    if (acs && acs.length > 0) {
      await upsertRecords('assessment_classes', acs, 'assessment_id,class_id');
    }
  } catch (e) {
    // Ignore links error
  }
}

async function deleteAssessmentFromSupabase(assessmentId) {
  if (!assessmentId) return;
  return await deleteRecord('assessments', assessmentId);
}

async function syncQuestionToSupabase(questionOrId) {
  if (!questionOrId) return;
  const db = getDatabase();
  const question = typeof questionOrId === 'string' ? db.get('SELECT * FROM questions WHERE id = ?', [questionOrId]) : questionOrId;
  if (!question) return;
  return await upsertRecord('questions', question);
}

async function deleteQuestionFromSupabase(questionId) {
  if (!questionId) return;
  return await deleteRecord('questions', questionId);
}

async function syncPoolToSupabase(poolOrId) {
  if (!poolOrId) return;
  const db = getDatabase();
  const pool = typeof poolOrId === 'string' ? db.get('SELECT * FROM question_pools WHERE id = ?', [poolOrId]) : poolOrId;
  if (!pool) return;
  await upsertRecord('question_pools', pool);
  try {
    const items = db.all('SELECT * FROM question_pool_items WHERE pool_id = ?', [pool.id]);
    if (items && items.length > 0) {
      await upsertRecords('question_pool_items', items, 'id');
    }
  } catch (e) {
    // Ignore
  }
}

async function deletePoolFromSupabase(poolId) {
  if (!poolId) return;
  return await deleteRecord('question_pools', poolId);
}

async function syncAttemptToSupabase(attemptId) {
  if (!attemptId) return;
  const db = getDatabase();
  const attempt = db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]);
  if (!attempt) return;

  // Guarantee referenced parent entities (assessment, class, user) exist in Supabase first
  if (attempt.assessment_id) {
    try {
      await syncAssessmentToSupabase(attempt.assessment_id);
    } catch (e) {}
  }
  if (attempt.class_id) {
    try {
      await syncClassToSupabase(attempt.class_id);
    } catch (e) {}
  }
  if (attempt.user_id) {
    try {
      await syncUserToSupabase(attempt.user_id);
    } catch (e) {}
  }

  await upsertRecord('student_attempts', attempt);

  try {
    const answers = db.all('SELECT * FROM attempt_answers WHERE attempt_id = ?', [attemptId]);
    if (answers && answers.length > 0) {
      await upsertRecords('attempt_answers', answers, 'id');
    }
  } catch (e) {
    // Ignore
  }
}

async function syncAttemptAnswersToSupabase(attemptId) {
  if (!attemptId) return;
  const db = getDatabase();
  try {
    const answers = db.all('SELECT * FROM attempt_answers WHERE attempt_id = ?', [attemptId]);
    if (answers && answers.length > 0) {
      await upsertRecords('attempt_answers', answers, 'id');
    }
  } catch (e) {
    // Ignore
  }
}

// -------------------------------------------------------------
// BULK DATA SYNC (PUSH ALL LOCAL DATA -> SUPABASE)
// -------------------------------------------------------------

async function pushAllToSupabase() {
  const config = getSupabaseConfig();
  if (!config.isEnabled) {
    throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY.');
  }

  const db = getDatabase();
  const tables = [
    'users',
    'courses',
    'classes',
    'course_access_codes',
    'class_enrollments',
    'questions',
    'question_versions',
    'question_pools',
    'question_pool_items',
    'assessments',
    'assessment_classes',
    'assessment_questions',
    'student_attempts',
    'attempt_answers',
    'audit_logs'
  ];

  const results = {};

  for (const table of tables) {
    const rows = db.all(`SELECT * FROM "${table}"`);
    if (!rows || rows.length === 0) {
      results[table] = 0;
      continue;
    }

    const batchSize = 100;
    let pushed = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await supabaseRequest(`${table}?on_conflict=id`, {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: batch
      });
      pushed += batch.length;
    }
    results[table] = pushed;
  }

  return results;
}

// -------------------------------------------------------------
// BULK DATA PULL (FETCH FROM SUPABASE -> LOCAL DB)
// -------------------------------------------------------------

async function pullFromSupabase() {
  const config = getSupabaseConfig();
  if (!config.isEnabled) {
    throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY.');
  }

  const tables = [
    'users',
    'courses',
    'classes',
    'course_access_codes',
    'class_enrollments',
    'questions',
    'question_versions',
    'question_pools',
    'question_pool_items',
    'assessments',
    'assessment_classes',
    'assessment_questions',
    'student_attempts',
    'attempt_answers'
  ];

  const results = {};
  for (const table of tables) {
    results[table] = await pullTable(table);
  }
  return results;
}

// -------------------------------------------------------------
// CONTAINER STARTUP SYNC
// -------------------------------------------------------------

async function syncOnStartup() {
  const config = getSupabaseConfig();
  if (!config.isEnabled) return;

  try {
    const remoteUsers = await supabaseRequest('users?select=id&limit=1', { method: 'GET' });
    if (!remoteUsers || remoteUsers.length === 0) {
      console.log('[Supabase Startup] Remote tables are empty. Pushing platform seed data to Supabase...');
      await pushAllToSupabase();
    } else {
      console.log('[Supabase Startup] Hydrating local database from Supabase...');
      await pullFromSupabase();
    }
  } catch (err) {
    console.warn('[Supabase Startup Warning]:', err.message);
  }
}

// -------------------------------------------------------------
// CONNECTION HEALTH CHECK
// -------------------------------------------------------------

async function testSupabaseConnection() {
  const config = getSupabaseConfig();
  if (!config.isEnabled) {
    return {
      connected: false,
      reason: 'SUPABASE_URL or SUPABASE_KEY environment variables are missing.'
    };
  }

  try {
    const res = await supabaseRequest('users?select=id&limit=1', { method: 'GET' });
    return {
      connected: true,
      url: config.url,
      recordCount: Array.isArray(res) ? res.length : 0
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

module.exports = {
  getSupabaseConfig,
  supabaseRequest,
  upsertRecord,
  upsertRecords,
  deleteRecord,
  syncUserToSupabase,
  syncClassToSupabase,
  deleteClassFromSupabase,
  syncCourseToSupabase,
  deleteCourseFromSupabase,
  syncAccessCodeToSupabase,
  syncEnrollmentToSupabase,
  deleteEnrollmentFromSupabase,
  syncAssessmentToSupabase,
  deleteAssessmentFromSupabase,
  syncQuestionToSupabase,
  deleteQuestionFromSupabase,
  syncPoolToSupabase,
  deletePoolFromSupabase,
  syncAttemptToSupabase,
  syncAttemptAnswersToSupabase,
  syncOnStartup,
  pushAllToSupabase,
  pullFromSupabase,
  pullTable,
  ensureTableFresh,
  ensureTablesFresh,
  invalidateTableCache,
  testSupabaseConnection
};
