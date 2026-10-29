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
// GENERIC UPSERT / DELETE HELPERS
// -------------------------------------------------------------

async function upsertRecord(tableName, record) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !record) return null;
  try {
    return await supabaseRequest(`${tableName}?on_conflict=id`, {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: record
    });
  } catch (err) {
    console.warn(`[Supabase Sync Warning] Could not sync to ${tableName}:`, err.message);
    return null;
  }
}

async function deleteRecord(tableName, id) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !id) return null;
  try {
    return await supabaseRequest(`${tableName}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
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
  const user = typeof userOrId === 'string' ? db.get('SELECT * FROM users WHERE id = ?', [userOrId]) : userOrId;
  if (!user) return;
  return await upsertRecord('users', user);
}

async function syncClassToSupabase(classOrId) {
  if (!classOrId) return;
  const db = getDatabase();
  const cls = typeof classOrId === 'string' ? db.get('SELECT * FROM classes WHERE id = ?', [classOrId]) : classOrId;
  if (!cls) return;
  await upsertRecord('classes', cls);

  // Sync associated active codes
  try {
    const codes = db.all('SELECT * FROM course_access_codes WHERE class_id = ?', [cls.id]);
    if (codes && codes.length > 0) {
      for (const code of codes) {
        await upsertRecord('course_access_codes', code);
      }
    }
  } catch (e) {
    // Ignore code query error
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
  return await upsertRecord('course_access_codes', code);
}

async function syncEnrollmentToSupabase(enrollmentOrId) {
  if (!enrollmentOrId) return;
  const db = getDatabase();
  const enrollment = typeof enrollmentOrId === 'string' ? db.get('SELECT * FROM class_enrollments WHERE id = ?', [enrollmentOrId]) : enrollmentOrId;
  if (!enrollment) return;
  return await upsertRecord('class_enrollments', enrollment);
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
  await upsertRecord('assessments', assess);

  try {
    const aqs = db.all('SELECT * FROM assessment_questions WHERE assessment_id = ?', [assess.id]);
    if (aqs && aqs.length > 0) {
      for (const aq of aqs) {
        await upsertRecord('assessment_questions', aq);
      }
    }
    const acs = db.all('SELECT * FROM assessment_classes WHERE assessment_id = ?', [assess.id]);
    if (acs && acs.length > 0) {
      for (const ac of acs) {
        await upsertRecord('assessment_classes', ac);
      }
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
      for (const item of items) {
        await upsertRecord('question_pool_items', item);
      }
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
  await upsertRecord('student_attempts', attempt);

  try {
    const answers = db.all('SELECT * FROM attempt_answers WHERE attempt_id = ?', [attemptId]);
    if (answers && answers.length > 0) {
      for (const ans of answers) {
        await upsertRecord('attempt_answers', ans);
      }
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
      for (const ans of answers) {
        await upsertRecord('attempt_answers', ans);
      }
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
    'attempt_answers'
  ];

  const results = {};

  for (const table of tables) {
    try {
      const rows = await supabaseRequest(`${table}?select=*&limit=10000`, { method: 'GET' });
      if (Array.isArray(rows) && rows.length > 0) {
        const cols = Object.keys(rows[0]);
        const placeholders = cols.map(() => '?').join(', ');
        const colNames = cols.map(c => `"${c}"`).join(', ');

        db.transaction(() => {
          for (const row of rows) {
            const vals = cols.map(c => row[c]);
            db.run(
              `INSERT OR REPLACE INTO "${table}" (${colNames}) VALUES (${placeholders})`,
              vals
            );
          }
        });
        results[table] = rows.length;
      } else {
        results[table] = 0;
      }
    } catch (err) {
      console.warn(`[Supabase Pull] Warning fetching table ${table}:`, err.message);
      results[table] = 0;
    }
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
  testSupabaseConnection
};
