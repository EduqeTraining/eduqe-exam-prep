// Eduqe Supabase Integration Service
// Communicates with Supabase via PostgREST using native Node.js fetch (zero external dependencies)

const { getDatabase } = require('../db');

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || null;
  return {
    url: url ? url.replace(/\/+$/, '') : null,
    key,
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
// SYNC INDIVIDUAL RECORDS
// -------------------------------------------------------------

async function syncUserToSupabase(user) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !user) return;
  try {
    await supabaseRequest('users', {
      method: 'POST',
      body: user
    });
  } catch (err) {
    console.warn('[Supabase Sync] Could not sync user:', err.message);
  }
}

async function syncAttemptToSupabase(attemptId) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !attemptId) return;

  try {
    const db = getDatabase();
    const attempt = db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]);
    if (!attempt) return;

    await supabaseRequest('student_attempts', {
      method: 'POST',
      body: attempt
    });

    const answers = db.all('SELECT * FROM attempt_answers WHERE attempt_id = ?', [attemptId]);
    if (answers && answers.length > 0) {
      await supabaseRequest('attempt_answers', {
        method: 'POST',
        body: answers
      });
    }
  } catch (err) {
    console.warn('[Supabase Sync] Could not sync attempt:', err.message);
  }
}

async function syncQuestionToSupabase(question) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !question) return;

  try {
    await supabaseRequest('questions', {
      method: 'POST',
      body: question
    });
  } catch (err) {
    console.warn('[Supabase Sync] Could not sync question:', err.message);
  }
}

// -------------------------------------------------------------
// BULK DATA SYNC (PUSH ALL LOCAL DATA -> SUPABASE)
// -------------------------------------------------------------

async function pushAllToSupabase() {
  const config = getSupabaseConfig();
  if (!config.isEnabled) {
    throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
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

    // Push in batches of 100 to avoid payload size limits
    const batchSize = 100;
    let pushed = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await supabaseRequest(table, {
        method: 'POST',
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
    throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
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
    'assessment_questions'
  ];

  const results = {};

  for (const table of tables) {
    try {
      const rows = await supabaseRequest(table, { method: 'GET' });
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
// CONNECTION HEALTH CHECK
// -------------------------------------------------------------

async function testSupabaseConnection() {
  const config = getSupabaseConfig();
  if (!config.isEnabled) {
    return {
      connected: false,
      reason: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are missing.'
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
  syncUserToSupabase,
  syncAttemptToSupabase,
  syncQuestionToSupabase,
  pushAllToSupabase,
  pullFromSupabase,
  testSupabaseConnection
};
