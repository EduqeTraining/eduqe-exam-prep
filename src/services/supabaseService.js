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
const tableLastSyncIso = new Map();
const classAnswersLastSync = new Map();
const inFlightPulls = new Map();
const unsupportedRemoteColumns = new Map();
const SYNC_CACHE_TTL_MS = 30000; // 30 seconds default cache window

const TABLE_TTL_OVERRIDES = {
  questions: 300000,            // 5 minutes (invalidated on question mutations)
  question_versions: 300000,
  question_pools: 300000,
  question_pool_items: 300000,
  courses: 120000,              // 2 minutes
  assessments: 60000,           // 1 minute
  assessment_questions: 60000,
  assessment_classes: 60000,
  attempt_answers: 30000
};

function getTableTtl(table, defaultTtl = SYNC_CACHE_TTL_MS) {
  if (defaultTtl !== SYNC_CACHE_TTL_MS) return defaultTtl;
  return TABLE_TTL_OVERRIDES[table] || defaultTtl;
}

function invalidateTableCache(tableName = null) {
  if (tableName) {
    tableLastSync.delete(tableName);
    tableLastSyncIso.delete(tableName);
  } else {
    tableLastSync.clear();
    tableLastSyncIso.clear();
    classAnswersLastSync.clear();
  }
}

function upsertLocalRows(table, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const db = getDatabase();
  const tableCols = db.all(`PRAGMA table_info("${table}")`);
  if (!tableCols || tableCols.length === 0) return 0;

  const hasId = tableCols.some(c => c.name === 'id');
  const hasKey = tableCols.some(c => c.name === 'key');
  const localColSet = new Set(tableCols.map(c => c.name));

  // Collect union of all matching columns across rows
  const remoteColSet = new Set();
  const sampleLimit = Math.min(rows.length, 20);
  for (let i = 0; i < sampleLimit; i++) {
    if (rows[i] && typeof rows[i] === 'object') {
      for (const k of Object.keys(rows[i])) {
        if (localColSet.has(k)) remoteColSet.add(k);
      }
    }
  }
  const matchingCols = Array.from(remoteColSet);
  if (matchingCols.length === 0) return 0;

  const placeholders = matchingCols.map(() => '?').join(', ');
  const colNames = matchingCols.map(c => `"${c}"`).join(', ');

  try {
    db.run('PRAGMA foreign_keys = OFF;');
  } catch (e) {}

  try {
    // Build high-speed prepared statement for bulk execution inside a single SQLite transaction
    let sql = `INSERT OR REPLACE INTO "${table}" (${colNames}) VALUES (${placeholders})`;

    if (hasId && matchingCols.includes('id') && (table === 'student_attempts' || table === 'attempt_answers')) {
      const updateCols = matchingCols.filter(c => c !== 'id');
      if (updateCols.length > 0) {
        const setClauses = updateCols.map(c => {
          if (table === 'student_attempts') {
            if (c === 'completed_sections') {
              return `"completed_sections" = CASE WHEN (excluded."completed_sections" IS NULL OR excluded."completed_sections" = '' OR excluded."completed_sections" = '[]') AND ("${table}"."completed_sections" IS NOT NULL AND "${table}"."completed_sections" != '' AND "${table}"."completed_sections" != '[]' AND "${table}"."completed_sections" != 'null') THEN "${table}"."completed_sections" ELSE excluded."completed_sections" END`;
            }
            if (c === 'class_id') {
              return `"class_id" = CASE WHEN (excluded."class_id" IS NULL OR excluded."class_id" = '') AND "${table}"."class_id" IS NOT NULL THEN "${table}"."class_id" ELSE excluded."class_id" END`;
            }
            if (c === 'percentage' || c === 'score') {
              return `"${c}" = CASE WHEN (excluded."${c}" IS NULL OR excluded."${c}" = 0) AND "${table}"."${c}" IS NOT NULL AND "${table}"."${c}" > 0 THEN "${table}"."${c}" ELSE COALESCE(excluded."${c}", "${table}"."${c}") END`;
            }
            if (c === 'is_paused' || c === 'paused_remaining_seconds') {
              return `"${c}" = CASE WHEN (excluded."${c}" IS NULL OR excluded."${c}" = 0) AND "${table}"."${c}" IS NOT NULL AND "${table}"."${c}" != 0 THEN "${table}"."${c}" ELSE excluded."${c}" END`;
            }
          } else if (table === 'attempt_answers') {
            if (c === 'is_correct' || c === 'awarded_points' || c === 'marked_status') {
              return `"${c}" = COALESCE(excluded."${c}", "${table}"."${c}")`;
            }
            if (c === 'saved_answer') {
              return `"saved_answer" = CASE WHEN (excluded."saved_answer" IS NULL OR excluded."saved_answer" = '') AND "${table}"."saved_answer" IS NOT NULL AND "${table}"."saved_answer" != '' THEN "${table}"."saved_answer" ELSE excluded."saved_answer" END`;
            }
          }
          return `"${c}" = excluded."${c}"`;
        });
        sql = `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT("id") DO UPDATE SET ${setClauses.join(', ')}`;
      }
    } else if (hasKey && matchingCols.includes('key') && table === 'eduque_settings') {
      const updateCols = matchingCols.filter(c => c !== 'key');
      if (updateCols.length > 0) {
        const setClauses = updateCols.map(c => `"${c}" = excluded."${c}"`);
        sql = `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT("key") DO UPDATE SET ${setClauses.join(', ')}`;
      }
    }

    const stmt = db.prepare(sql);
    const fallbackStmt = sql.startsWith('INSERT INTO')
      ? db.prepare(`INSERT OR REPLACE INTO "${table}" (${colNames}) VALUES (${placeholders})`)
      : null;

    db.transaction(() => {
      for (const row of rows) {
        if (!row) continue;
        const vals = matchingCols.map(c => {
          const val = row[c];
          if (val === undefined) return null;
          if (val !== null && typeof val === 'object') {
            return JSON.stringify(val);
          }
          return val;
        });

        try {
          stmt.run(...vals);
        } catch (rowErr) {
          if (fallbackStmt) {
            try { fallbackStmt.run(...vals); } catch (_) {}
          }
        }
      }
    });
  } finally {
    try {
      db.run('PRAGMA foreign_keys = ON;');
    } catch (e) {}
  }
  return rows.length;
}

async function pullTable(table, { forceFull = false } = {}) {
  const config = getSupabaseConfig();
  if (!config.isEnabled) return 0;

  // Deduplicate concurrent in-flight requests for the same table
  if (inFlightPulls.has(table)) {
    return inFlightPulls.get(table);
  }

  const pullPromise = (async () => {
    try {
      let rows = [];
      const pageSize = 1000;

      // Incremental delta sync for attempt_answers after initial full pull
      const lastIso = !forceFull ? tableLastSyncIso.get(table) : null;
      if (table === 'attempt_answers' && lastIso) {
        const deltaRows = await supabaseRequest(
          `attempt_answers?saved_at=gte.${encodeURIComponent(lastIso)}&select=*&limit=2000`,
          { method: 'GET' }
        );
        if (Array.isArray(deltaRows) && deltaRows.length > 0) {
          upsertLocalRows('attempt_answers', deltaRows);
        }
        tableLastSync.set(table, Date.now());
        tableLastSyncIso.set(table, new Date(Date.now() - 60000).toISOString());
        return Array.isArray(deltaRows) ? deltaRows.length : 0;
      }

      // First page fetch
      const firstBatch = await supabaseRequest(`${table}?select=*&limit=${pageSize}&offset=0`, { method: 'GET' });
      if (!Array.isArray(firstBatch)) return 0;
      rows.push(...firstBatch);

      // If more pages exist, fetch in parallel chunks of 4 pages (4,000 rows per wave) for high speed
      if (firstBatch.length === pageSize) {
        let waveOffset = pageSize;
        const parallelPages = 4;
        while (true) {
          const offsets = [];
          for (let p = 0; p < parallelPages; p++) {
            offsets.push(waveOffset + (p * pageSize));
          }
          const waveResults = await Promise.all(
            offsets.map(off =>
              supabaseRequest(`${table}?select=*&limit=${pageSize}&offset=${off}`, { method: 'GET' }).catch(() => [])
            )
          );
          let reachedEnd = false;
          for (const batch of waveResults) {
            if (Array.isArray(batch) && batch.length > 0) {
              rows.push(...batch);
              if (batch.length < pageSize) reachedEnd = true;
            } else {
              reachedEnd = true;
            }
          }
          if (reachedEnd) break;
          waveOffset += parallelPages * pageSize;
        }
      }

      if (rows.length === 0) {
        // If remote table has 0 rows, preserve existing local cache rows to prevent
        // wiping newly seeded records or in-flight attempts before they sync
        tableLastSync.set(table, Date.now());
        return 0;
      }

      if (table === 'assessment_questions') {
        const db = getDatabase();
        const remoteIds = new Set(rows.map(r => r.id).filter(Boolean));
        const localRows = db.all('SELECT id FROM assessment_questions');
        const toDelete = localRows.filter(r => !remoteIds.has(r.id)).map(r => r.id);
        if (toDelete.length > 0) {
          for (let i = 0; i < toDelete.length; i += 100) {
            const chunk = toDelete.slice(i, i + 100);
            const placeholders = chunk.map(() => '?').join(',');
            db.run(`DELETE FROM assessment_questions WHERE id IN (${placeholders})`, chunk);
          }
        }
      } else if (table === 'assessment_classes') {
        const db = getDatabase();
        const remoteIds = new Set(rows.map(r => `${r.assessment_id}_${r.class_id}`));
        const localRows = db.all('SELECT id, assessment_id, class_id FROM assessment_classes');
        const toDelete = localRows.filter(r => !remoteIds.has(`${r.assessment_id}_${r.class_id}`)).map(r => r.id);
        if (toDelete.length > 0) {
          for (let i = 0; i < toDelete.length; i += 100) {
            const chunk = toDelete.slice(i, i + 100);
            const placeholders = chunk.map(() => '?').join(',');
            db.run(`DELETE FROM assessment_classes WHERE id IN (${placeholders})`, chunk);
          }
        }
      }

      const count = upsertLocalRows(table, rows);
      tableLastSync.set(table, Date.now());
      tableLastSyncIso.set(table, new Date(Date.now() - 60000).toISOString());
      return count;
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

  const effectiveTtl = getTableTtl(table, maxAgeMs);
  const now = Date.now();
  const lastSync = tableLastSync.get(table) || 0;
  if (now - lastSync < effectiveTtl) {
    return;
  }
  await pullTable(table);
}

async function ensureTablesFresh(tables = [], maxAgeMs = SYNC_CACHE_TTL_MS) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !tables || tables.length === 0) return;

  const now = Date.now();
  const needed = [...new Set(tables)].filter(table => {
    const effectiveTtl = getTableTtl(table, maxAgeMs);
    const lastSync = tableLastSync.get(table) || 0;
    return (now - lastSync) >= effectiveTtl;
  });

  if (needed.length === 0) return;

  // Execute all required table refreshes concurrently in parallel
  await Promise.all(needed.map(table => pullTable(table)));
}

// -------------------------------------------------------------
// GENERIC UPSERT / DELETE HELPERS
// -------------------------------------------------------------

function stripUnsupportedColumns(tableName, obj) {
  const unsupported = unsupportedRemoteColumns.get(tableName);
  if (!unsupported || unsupported.size === 0) return obj;
  for (const col of unsupported) {
    delete obj[col];
  }
  return obj;
}

function recordUnsupportedColumn(tableName, colName) {
  if (!colName) return;
  if (!unsupportedRemoteColumns.has(tableName)) {
    unsupportedRemoteColumns.set(tableName, new Set());
  }
  unsupportedRemoteColumns.get(tableName).add(colName);
}

async function upsertRecord(tableName, record, conflictColumns = null) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !record) return null;

  let conflictParam = conflictColumns || 'id';
  if (!conflictColumns) {
    if (tableName === 'class_enrollments') conflictParam = 'class_id,user_id';
    else if (tableName === 'assessment_classes') conflictParam = 'assessment_id,class_id';
    else if (tableName === 'course_access_codes') conflictParam = 'code';
    else if (tableName === 'eduque_settings') conflictParam = 'key';
  }

  const curRecord = stripUnsupportedColumns(tableName, { ...record });
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await supabaseRequest(`${tableName}?on_conflict=${conflictParam}`, {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: curRecord
      });
      return res;
    } catch (err) {
      // If error is about a missing column in Supabase schema cache (e.g. is_paused, paused_remaining_seconds, completed_sections):
      if (err && err.message && /column.*does not exist|Could not find the.*column/i.test(err.message)) {
        const colMatch = err.message.match(/['"]([a-zA-Z0-9_]+)['"]\s+column/i) || err.message.match(/column\s+['"]?([a-zA-Z0-9_]+)['"]?/i);
        const colToOmit = colMatch ? colMatch[1] : null;
        if (colToOmit && curRecord[colToOmit] !== undefined) {
          recordUnsupportedColumn(tableName, colToOmit);
          delete curRecord[colToOmit];
          continue;
        }
      }
      if (conflictParam !== 'id') {
        conflictParam = 'id';
        continue;
      }
      console.warn(`[Supabase Sync Warning] Could not sync to ${tableName}:`, err.message);
      return null;
    }
  }
  return null;
}

async function upsertRecords(tableName, records, conflictColumns = null) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !records) return null;
  const rawList = Array.isArray(records) ? records : [records];
  if (rawList.length === 0) return [];

  let conflictParam = conflictColumns || 'id';
  if (!conflictColumns) {
    if (tableName === 'class_enrollments') conflictParam = 'class_id,user_id';
    else if (tableName === 'assessment_classes') conflictParam = 'assessment_id,class_id';
    else if (tableName === 'course_access_codes') conflictParam = 'code';
    else if (tableName === 'eduque_settings') conflictParam = 'key';
  }

  // Chunk large arrays into batches of 200 so payloads never time out
  const batchSize = 200;
  for (let i = 0; i < rawList.length; i += batchSize) {
    const chunk = rawList.slice(i, i + batchSize).map(r => stripUnsupportedColumns(tableName, { ...r }));
    let curConflict = conflictParam;

    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await supabaseRequest(`${tableName}?on_conflict=${curConflict}`, {
          method: 'POST',
          headers: {
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          },
          body: chunk
        });
        break;
      } catch (err) {
        if (err && err.message && /column.*does not exist|Could not find the.*column/i.test(err.message)) {
          const colMatch = err.message.match(/['"]([a-zA-Z0-9_]+)['"]\s+column/i) || err.message.match(/column\s+['"]?([a-zA-Z0-9_]+)['"]?/i);
          const colToOmit = colMatch ? colMatch[1] : null;
          if (colToOmit) {
            recordUnsupportedColumn(tableName, colToOmit);
            chunk.forEach(it => { delete it[colToOmit]; });
            continue;
          }
        }
        if (curConflict !== 'id') {
          curConflict = 'id';
          continue;
        }
        console.warn(`[Supabase Bulk Sync Warning] Could not sync batch to ${tableName}:`, err.message);
        break;
      }
    }
  }
  return [];
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
    const aqs = db.all('SELECT * FROM assessment_questions WHERE assessment_id = ?', [assess.id]) || [];
    // Delete stale remote assessment_questions for this assessment first so zombie questions cannot persist
    await supabaseRequest(`assessment_questions?assessment_id=eq.${encodeURIComponent(assess.id)}`, {
      method: 'DELETE'
    });
    if (aqs.length > 0) {
      await upsertRecords('assessment_questions', aqs, 'id');
    }

    const acs = db.all('SELECT * FROM assessment_classes WHERE assessment_id = ?', [assess.id]) || [];
    // Delete stale remote assessment_classes for this assessment first
    await supabaseRequest(`assessment_classes?assessment_id=eq.${encodeURIComponent(assess.id)}`, {
      method: 'DELETE'
    });
    if (acs.length > 0) {
      await upsertRecords('assessment_classes', acs, 'assessment_id,class_id');
    }
  } catch (e) {
    console.warn(`[syncAssessmentToSupabase Warning] Failed to sync sub-items for assessment ${assess.id}:`, e.message);
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

async function syncQuestionsToSupabase(questionIdsOrObjects) {
  if (!questionIdsOrObjects || questionIdsOrObjects.length === 0) return;
  const config = getSupabaseConfig();
  if (!config.isEnabled) return;
  const db = getDatabase();
  let questionsToSync = [];
  if (typeof questionIdsOrObjects[0] === 'string') {
    const validIds = questionIdsOrObjects.filter(Boolean);
    if (validIds.length === 0) return;
    const placeholders = validIds.map(() => '?').join(',');
    questionsToSync = db.all(`SELECT * FROM questions WHERE id IN (${placeholders})`, validIds);
  } else {
    questionsToSync = questionIdsOrObjects;
  }
  if (!questionsToSync || questionsToSync.length === 0) return;

  const batchSize = 100;
  for (let i = 0; i < questionsToSync.length; i += batchSize) {
    const batch = questionsToSync.slice(i, i + batchSize);
    await upsertRecords('questions', batch, 'id');
  }
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

  // Upsert attempt record directly to Supabase first for fast persistence
  let syncSuccess = await upsertRecord('student_attempts', attempt);

  // If initial sync failed due to foreign key missing in Supabase, ensure full parent hierarchy exists and retry
  if (!syncSuccess) {
    if (attempt.user_id) {
      try { await syncUserToSupabase(attempt.user_id); } catch (e) {}
    }
    if (attempt.class_id) {
      try {
        await syncClassToSupabase(attempt.class_id);
      } catch (e) {}
    }
    if (attempt.assessment_id) {
      try {
        await syncAssessmentToSupabase(attempt.assessment_id);
      } catch (e) {}
    }
    syncSuccess = await upsertRecord('student_attempts', attempt);
  }

  try {
    const answers = db.all('SELECT * FROM attempt_answers WHERE attempt_id = ?', [attemptId]);
    if (answers && answers.length > 0) {
      await upsertRecords('attempt_answers', answers, 'id');
    }
  } catch (e) {
    // Ignore
  }
}

async function syncSettingToSupabase(keyOrRecord) {
  if (!keyOrRecord) return;
  const db = getDatabase();
  const setting = typeof keyOrRecord === 'string'
    ? db.get('SELECT * FROM eduque_settings WHERE key = ?', [keyOrRecord])
    : keyOrRecord;
  if (!setting) return;
  return await upsertRecord('eduque_settings', setting, 'key');
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

async function pullAttemptAnswersForAttempt(attemptId) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !attemptId) return 0;

  try {
    const rows = await supabaseRequest(`attempt_answers?attempt_id=eq.${encodeURIComponent(attemptId)}&select=*`, { method: 'GET' });
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    return upsertLocalRows('attempt_answers', rows);
  } catch (err) {
    console.warn(`[Supabase Pull Warning] Error pulling attempt_answers for attempt ${attemptId}:`, err.message);
    return 0;
  }
}

/**
 * Ensures all questions assigned to an assessment (and its pools)
 * are fully synchronized from Supabase into local SQLite with full text and options.
 */
async function ensureAssessmentQuestionsHydrated(assessmentId) {
  if (!assessmentId) return;
  const config = getSupabaseConfig();
  if (!config.isEnabled) return;
  const db = getDatabase();

  // 1. Ensure assessment_questions for this assessment are present in local SQLite
  let aqRows = db.all('SELECT id, question_id, pool_id FROM assessment_questions WHERE assessment_id = ?', [assessmentId]);
  if (!aqRows || aqRows.length === 0) {
    try {
      let offset = 0;
      let allAq = [];
      while (true) {
        const remoteAqs = await supabaseRequest(
          `assessment_questions?assessment_id=eq.${encodeURIComponent(assessmentId)}&select=*&limit=1000&offset=${offset}`,
          { method: 'GET' }
        );
        if (!Array.isArray(remoteAqs) || remoteAqs.length === 0) break;
        allAq.push(...remoteAqs);
        if (remoteAqs.length < 1000) break;
        offset += 1000;
      }
      if (allAq.length > 0) {
        upsertLocalRows('assessment_questions', allAq);
        aqRows = db.all('SELECT id, question_id, pool_id FROM assessment_questions WHERE assessment_id = ?', [assessmentId]);
      }
    } catch (e) {
      console.warn(`[ensureAssessmentQuestionsHydrated] Error pulling assessment_questions for ${assessmentId}:`, e.message);
    }
  }

  // 2. Find any question in this assessment missing from local SQLite (or missing text)
  const missing = db.all(
    `SELECT aq.question_id FROM assessment_questions aq
     LEFT JOIN questions q ON q.id = aq.question_id
     WHERE aq.assessment_id = ? AND aq.question_id IS NOT NULL AND (q.id IS NULL OR q.question_text IS NULL OR q.question_text = '')`,
    [assessmentId]
  );

  const missingIds = [...new Set((missing || []).map(m => m.question_id).filter(Boolean))];
  if (missingIds.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < missingIds.length; i += chunkSize) {
      const chunk = missingIds.slice(i, i + chunkSize);
      try {
        const idFilter = chunk.map(id => encodeURIComponent(id)).join(',');
        const qRows = await supabaseRequest(`questions?id=in.(${idFilter})&select=*`, { method: 'GET' });
        if (Array.isArray(qRows) && qRows.length > 0) {
          upsertLocalRows('questions', qRows);
        }
      } catch (err) {
        console.warn(`[ensureAssessmentQuestionsHydrated] Error fetching questions chunk:`, err.message);
      }
    }
  }

  // 3. Hydrate any question pools referenced in this assessment
  const poolIds = [...new Set((aqRows || []).map(r => r.pool_id).filter(Boolean))];
  for (const poolId of poolIds) {
    try {
      const qpiRows = db.all('SELECT question_id FROM question_pool_items WHERE pool_id = ?', [poolId]);
      if (!qpiRows || qpiRows.length === 0) {
        const remoteQpi = await supabaseRequest(`question_pool_items?pool_id=eq.${encodeURIComponent(poolId)}&select=*`, { method: 'GET' });
        if (Array.isArray(remoteQpi) && remoteQpi.length > 0) {
          upsertLocalRows('question_pool_items', remoteQpi);
        }
      }
      const missingPoolQ = db.all(
        `SELECT qpi.question_id FROM question_pool_items qpi
         LEFT JOIN questions q ON q.id = qpi.question_id
         WHERE qpi.pool_id = ? AND qpi.question_id IS NOT NULL AND (q.id IS NULL OR q.question_text IS NULL OR q.question_text = '')`,
        [poolId]
      );
      const mIds = [...new Set((missingPoolQ || []).map(m => m.question_id).filter(Boolean))];
      if (mIds.length > 0) {
        for (let i = 0; i < mIds.length; i += 50) {
          const chunk = mIds.slice(i, i + 50);
          const idFilter = chunk.map(id => encodeURIComponent(id)).join(',');
          const qRows = await supabaseRequest(`questions?id=in.(${idFilter})&select=*`, { method: 'GET' });
          if (Array.isArray(qRows) && qRows.length > 0) {
            upsertLocalRows('questions', qRows);
          }
        }
      }
    } catch (e) {}
  }
}

/**
 * Targeted Serverless Hydration for a specific student attempt.
 * Ensures the attempt, its assessment, questions, classes, answers, and settings
 * are fully synchronized into local SQLite regardless of microVM cache state.
 */
async function ensureAttemptFullyHydrated(attemptId, userId = null, assessmentIdHint = null, classIdHint = null) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || (!attemptId && !userId)) {
    const db = getDatabase();
    const local = attemptId ? db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]) : null;
    return { attempt: local, attemptId: local?.id || attemptId };
  }

  const db = getDatabase();

  // 1. Fetch attempt locally or pull directly from Supabase
  let attempt = attemptId ? db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]) : null;
  if (!attempt && userId) {
    attempt = (assessmentIdHint
      ? db.get("SELECT * FROM student_attempts WHERE user_id = ? AND assessment_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1", [userId, assessmentIdHint])
      : null)
      || db.get("SELECT * FROM student_attempts WHERE user_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1", [userId])
      || (assessmentIdHint
        ? db.get("SELECT * FROM student_attempts WHERE user_id = ? AND assessment_id = ? ORDER BY started_at DESC LIMIT 1", [userId, assessmentIdHint])
        : null)
      || db.get("SELECT * FROM student_attempts WHERE user_id = ? ORDER BY started_at DESC LIMIT 1", [userId]);
    if (attempt) attemptId = attempt.id;
  }

  if (!attempt) {
    try {
      let rows = attemptId ? await supabaseRequest(`student_attempts?id=eq.${encodeURIComponent(attemptId)}&select=*`, { method: 'GET' }) : [];
      if ((!Array.isArray(rows) || rows.length === 0) && userId && assessmentIdHint) {
        rows = await supabaseRequest(
          `student_attempts?user_id=eq.${encodeURIComponent(userId)}&assessment_id=eq.${encodeURIComponent(assessmentIdHint)}&status=eq.in_progress&order=started_at.desc&limit=1&select=*`,
          { method: 'GET' }
        );
      }
      if ((!Array.isArray(rows) || rows.length === 0) && userId) {
        rows = await supabaseRequest(
          `student_attempts?user_id=eq.${encodeURIComponent(userId)}&status=eq.in_progress&order=started_at.desc&limit=1&select=*`,
          { method: 'GET' }
        );
        if (!Array.isArray(rows) || rows.length === 0) {
          rows = await supabaseRequest(
            `student_attempts?user_id=eq.${encodeURIComponent(userId)}&order=started_at.desc&limit=1&select=*`,
            { method: 'GET' }
          );
        }
      }
      if (Array.isArray(rows) && rows.length > 0) {
        upsertLocalRows('student_attempts', rows);
        attempt = db.get('SELECT * FROM student_attempts WHERE id = ?', [rows[0].id]);
        attemptId = rows[0].id;
      }
    } catch (err) {
      console.warn(`[ensureAttemptFullyHydrated] Error pulling student_attempt ${attemptId}:`, err.message);
    }
  }

  // 2. Ensure referenced assessment exists in local SQLite
  const assessmentId = attempt?.assessment_id;
  if (assessmentId) {
    const hasAss = db.get('SELECT id FROM assessments WHERE id = ?', [assessmentId]);
    if (!hasAss) {
      try {
        const assRows = await supabaseRequest(`assessments?id=eq.${encodeURIComponent(assessmentId)}&select=*`, { method: 'GET' });
        if (Array.isArray(assRows) && assRows.length > 0) {
          upsertLocalRows('assessments', assRows);
        }
      } catch (err) {
        console.warn(`[ensureAttemptFullyHydrated] Error pulling assessment ${assessmentId}:`, err.message);
      }
    }

    // Ensure assessment_questions exist in local SQLite
    const aqCount = db.get('SELECT COUNT(*) as c FROM assessment_questions WHERE assessment_id = ?', [assessmentId])?.c || 0;
    if (aqCount === 0) {
      try {
        const aqRows = await supabaseRequest(`assessment_questions?assessment_id=eq.${encodeURIComponent(assessmentId)}&select=*`, { method: 'GET' });
        if (Array.isArray(aqRows) && aqRows.length > 0) {
          upsertLocalRows('assessment_questions', aqRows);
        }
      } catch (err) {}
    }

    // Ensure all referenced questions (and pool questions) exist in local SQLite
    await ensureAssessmentQuestionsHydrated(assessmentId);
  }

  // 3. Ensure referenced class exists in local SQLite
  let classId = attempt?.class_id;
  if (!classId && attempt && attempt.user_id && assessmentId) {
    const localEnroll = db.get(
      `SELECT ce.class_id FROM class_enrollments ce
       JOIN classes cl ON cl.id = ce.class_id
       JOIN assessments a ON a.course_id = cl.course_id
       WHERE ce.user_id = ? AND a.id = ? AND ce.status = 'active'
       ORDER BY ce.enrolled_at DESC LIMIT 1`,
      [attempt.user_id, assessmentId]
    );
    if (localEnroll) {
      classId = localEnroll.class_id;
    } else {
      try {
        const enrollRows = await supabaseRequest(`class_enrollments?user_id=eq.${encodeURIComponent(attempt.user_id)}&select=*`, { method: 'GET' });
        if (Array.isArray(enrollRows) && enrollRows.length > 0) {
          upsertLocalRows('class_enrollments', enrollRows);
        }
      } catch (err) {}
    }
  }

  if (classId) {
    const hasClass = db.get('SELECT id FROM classes WHERE id = ?', [classId]);
    if (!hasClass) {
      try {
        const cRows = await supabaseRequest(`classes?id=eq.${encodeURIComponent(classId)}&select=*`, { method: 'GET' });
        if (Array.isArray(cRows) && cRows.length > 0) {
          upsertLocalRows('classes', cRows);
        }
      } catch (err) {}
    }
  }

  // 4. Pull all latest attempt answers from Supabase
  await pullAttemptAnswersForAttempt(attemptId);

  // 4b. Self-heal & backfill any missing attempt_answers rows from assessment_questions
  // (e.g., if startAttempt ran on another serverless instance before initial attempt_answers synced)
  if (assessmentId && attempt) {
    try {
      const aqRows = db.all(
        `SELECT aq.question_id, aq.section_name, aq.order_index, aq.points_override, q.points, q.version
         FROM assessment_questions aq
         LEFT JOIN questions q ON q.id = aq.question_id
         WHERE aq.assessment_id = ? AND aq.question_id IS NOT NULL
         ORDER BY aq.order_index ASC, aq.id ASC`,
        [assessmentId]
      );

      if (aqRows && aqRows.length > 0) {
        // Deduplicate any duplicate (attempt_id, question_id) rows keeping the one with saved_answer
        const existingAnsRows = db.all(
          `SELECT id, question_id, saved_answer, order_index FROM attempt_answers WHERE attempt_id = ? ORDER BY (saved_answer IS NOT NULL AND saved_answer != '') DESC, saved_at DESC`,
          [attemptId]
        );
        const seenQ = new Set();
        const dupIds = [];
        for (const r of existingAnsRows) {
          if (seenQ.has(r.question_id)) {
            dupIds.push(r.id);
          } else {
            seenQ.add(r.question_id);
          }
        }
        if (dupIds.length > 0) {
          for (let i = 0; i < dupIds.length; i += 100) {
            const c = dupIds.slice(i, i + 100);
            db.run(`DELETE FROM attempt_answers WHERE id IN (${c.map(() => '?').join(',')})`, c);
          }
        }

        // Check if class config restricts question limits per section
        let hasCustomLimit = false;
        if (classId) {
          try {
            const cfgRow = db.get('SELECT value FROM eduque_settings WHERE key = ?', [`class_assessment_config_${classId}`]);
            if (cfgRow && cfgRow.value) {
              const cfg = typeof cfgRow.value === 'string' ? JSON.parse(cfgRow.value) : cfgRow.value;
              if (cfg && cfg.sections && Object.values(cfg.sections).some(s => s && (Number(s.limit) > 0 || Number(s.chunk_size) > 0))) {
                hasCustomLimit = true;
              }
            }
          } catch (_) {}
        }

        // If no custom limit is shrinking the question set (or if 0 answers exist), backfill any missing questions
        if (!hasCustomLimit || seenQ.size === 0) {
          const missingAq = aqRows.filter(aq => !seenQ.has(aq.question_id));
          if (missingAq.length > 0) {
            try { db.run('PRAGMA foreign_keys = OFF;'); } catch (_) {}
            const insertStmt = db.prepare(
              `INSERT OR IGNORE INTO attempt_answers (id, attempt_id, question_id, question_version, section_name, order_index, saved_answer, is_flagged, max_points, marked_status)
               VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, 'pending')`
            );
            const newRowsForRemote = [];
            db.transaction(() => {
              missingAq.forEach((aq, idx) => {
                const detId = `aa_${attemptId}_${aq.question_id}`;
                const secName = (aq.section_name && aq.section_name !== 'General') ? aq.section_name : 'Section 1';
                const ordIdx = aq.order_index !== null && aq.order_index !== undefined ? aq.order_index : (seenQ.size + idx);
                const maxPts = aq.points_override !== null && aq.points_override !== undefined ? aq.points_override : (aq.points || 1);
                insertStmt.run(detId, attemptId, aq.question_id, aq.version || 1, secName, ordIdx, maxPts);
                newRowsForRemote.push({
                  id: detId,
                  attempt_id: attemptId,
                  question_id: aq.question_id,
                  question_version: aq.version || 1,
                  section_name: secName,
                  order_index: ordIdx,
                  saved_answer: null,
                  is_flagged: 0,
                  max_points: maxPts,
                  marked_status: 'pending'
                });
              });
            });
            try { db.run('PRAGMA foreign_keys = ON;'); } catch (_) {}
            if (newRowsForRemote.length > 0) {
              await upsertRecords('attempt_answers', newRowsForRemote, 'id');
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[ensureAttemptFullyHydrated] Backfill check warning:`, err.message);
    }
  }

  // 5. Ensure all questions referenced in attempt_answers exist in the questions table
  try {
    const missingQRows = db.all(
      `SELECT DISTINCT aa.question_id
       FROM attempt_answers aa
       LEFT JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = ? AND (q.id IS NULL OR q.question_text IS NULL OR q.question_text = '')`,
      [attemptId]
    );
    if (missingQRows && missingQRows.length > 0) {
      const missingIds = missingQRows.map(r => r.question_id).filter(Boolean);
      for (let i = 0; i < missingIds.length; i += 50) {
        const chunk = missingIds.slice(i, i + 50);
        const inFilter = `in.(${chunk.map(id => `"${id}"`).join(',')})`;
        const qRows = await supabaseRequest(`questions?id=${inFilter}&select=*`, { method: 'GET' });
        if (Array.isArray(qRows) && qRows.length > 0) {
          upsertLocalRows('questions', qRows);
        }
      }
    }
  } catch (err) {}

  // 6. Ensure settings for unlocked sections and attempt timer are fresh
  try {
    const settingKeys = [
      `attempt_timer_${attemptId}`,
      `completed_sections_attempt_${attemptId}`,
      `attempt_meta_${attemptId}`
    ];
    if (classId) {
      settingKeys.push(`cohort_unlocked_sections_${classId}`);
      settingKeys.push(`class_assessment_config_${classId}`);
    }
    const inFilter = `in.(${settingKeys.map(k => `"${k}"`).join(',')})`;
    const sRows = await supabaseRequest(`eduque_settings?key=${inFilter}&select=*`, { method: 'GET' });
    if (Array.isArray(sRows) && sRows.length > 0) {
      upsertLocalRows('eduque_settings', sRows);
    }
  } catch (err) {}

  return { attempt, attemptId };
}

/**
 * Fast, targeted hydration for a Student Dashboard load.
 * Avoids pulling all 16,500+ global attempt_answers across the entire platform.
 */
async function ensureStudentDashboardHydrated(userId) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !userId) return;

  await ensureTablesFresh([
    'courses',
    'classes',
    'course_access_codes',
    'assessments',
    'assessment_classes',
    'assessment_questions',
    'eduque_settings'
  ]);

  // Pull this specific student's user row, enrollments, and attempts in parallel
  try {
    const [uRows, eRows, aRows] = await Promise.all([
      supabaseRequest(`users?id=eq.${encodeURIComponent(userId)}&select=*`, { method: 'GET' }).catch(() => []),
      supabaseRequest(`class_enrollments?user_id=eq.${encodeURIComponent(userId)}&select=*`, { method: 'GET' }).catch(() => []),
      supabaseRequest(`student_attempts?user_id=eq.${encodeURIComponent(userId)}&select=*`, { method: 'GET' }).catch(() => [])
    ]);
    if (Array.isArray(uRows) && uRows.length > 0) upsertLocalRows('users', uRows);
    if (Array.isArray(eRows) && eRows.length > 0) upsertLocalRows('class_enrollments', eRows);
    if (Array.isArray(aRows) && aRows.length > 0) upsertLocalRows('student_attempts', aRows);
  } catch (e) {}
}

/**
 * Fast, targeted hydration for Instructor Cohort Progress.
 * Pulls attempt_answers only for the attempts belonging to the target class(es) rather than all historical answers.
 */
async function ensureClassProgressHydrated(classId = null, instructorId = null) {
  const config = getSupabaseConfig();
  if (!config.isEnabled) return;

  await ensureTablesFresh([
    'courses',
    'users',
    'classes',
    'course_access_codes',
    'class_enrollments',
    'assessments',
    'assessment_classes',
    'questions',
    'assessment_questions',
    'student_attempts',
    'eduque_settings'
  ]);

  const cacheKey = `${classId || 'all'}_${instructorId || 'admin'}`;
  const now = Date.now();
  const lastClassSync = classAnswersLastSync.get(cacheKey) || 0;
  if (now - lastClassSync < 12000) {
    return;
  }

  try {
    const db = getDatabase();
    let attRows = [];
    if (classId && classId !== 'all') {
      attRows = db.all(
        `SELECT DISTINCT sa.id FROM student_attempts sa
         WHERE sa.class_id = ?
            OR sa.user_id IN (SELECT ce.user_id FROM class_enrollments ce WHERE ce.class_id = ?)`,
        [classId, classId]
      );
    } else if (instructorId) {
      attRows = db.all(
        `SELECT DISTINCT sa.id FROM student_attempts sa
         WHERE sa.class_id IN (SELECT id FROM classes WHERE instructor_id = ?)
            OR sa.user_id IN (SELECT ce.user_id FROM class_enrollments ce JOIN classes cl ON cl.id = ce.class_id WHERE cl.instructor_id = ?)`,
        [instructorId, instructorId]
      );
    } else {
      attRows = db.all(
        `SELECT id FROM student_attempts ORDER BY COALESCE(submitted_at, started_at) DESC LIMIT 120`
      );
    }

    const attIds = attRows.map(r => r.id).filter(Boolean);
    if (attIds.length > 0) {
      const chunkSize = 35;
      const chunks = [];
      for (let i = 0; i < attIds.length; i += chunkSize) {
        chunks.push(attIds.slice(i, i + chunkSize));
      }
      await Promise.all(
        chunks.map(async (chunk) => {
          const inFilter = `in.(${chunk.map(id => `"${id}"`).join(',')})`;
          let offset = 0;
          while (true) {
            const rows = await supabaseRequest(
              `attempt_answers?attempt_id=${inFilter}&select=*&limit=1000&offset=${offset}`,
              { method: 'GET' }
            ).catch(() => []);
            if (!Array.isArray(rows) || rows.length === 0) break;
            upsertLocalRows('attempt_answers', rows);
            if (rows.length < 1000) break;
            offset += 1000;
          }
        })
      );
    }
    classAnswersLastSync.set(cacheKey, Date.now());
  } catch (e) {
    console.warn('[ensureClassProgressHydrated] Warning:', e.message);
  }
}

/**
 * Hydrates an active in-progress attempt for a user & assessment from Supabase
 */
async function ensureActiveAttemptForUserHydrated(userId, assessmentId) {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !userId || !assessmentId) return;

  const db = getDatabase();
  const local = db.get(
    `SELECT id FROM student_attempts
     WHERE user_id = ? AND assessment_id = ? AND status = 'in_progress'
     ORDER BY attempt_number DESC, started_at DESC LIMIT 1`,
    [userId, assessmentId]
  );

  if (local) {
    await ensureAttemptFullyHydrated(local.id);
  } else {
    try {
      const rows = await supabaseRequest(
        `student_attempts?user_id=eq.${encodeURIComponent(userId)}&assessment_id=eq.${encodeURIComponent(assessmentId)}&status=eq.in_progress&order=attempt_number.desc&limit=1&select=*`,
        { method: 'GET' }
      );
      if (Array.isArray(rows) && rows.length > 0) {
        upsertLocalRows('student_attempts', rows);
        await ensureAttemptFullyHydrated(rows[0].id);
      }
    } catch (err) {}
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
          'Prefer': 'resolution=merge-duplicates,return=minimal'
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
// CONTAINER STARTUP SYNC (FAST PARALLEL CORE HYDRATION)
// -------------------------------------------------------------

async function syncOnStartup() {
  const config = getSupabaseConfig();
  if (!config.isEnabled) return;

  try {
    const remoteUsers = await supabaseRequest('users?select=id&limit=1', { method: 'GET' });
    if (!remoteUsers || remoteUsers.length === 0) {
      console.log('[Supabase Startup] Remote tables are empty. Pushing platform seed data to Supabase...');
      await pushAllToSupabase();
      return;
    }

    // Pull lightweight core metadata tables in parallel (< 400ms total) so cold starts never block login or API calls
    const fastCoreTables = [
      'users',
      'courses',
      'classes',
      'course_access_codes',
      'class_enrollments',
      'assessments',
      'assessment_classes',
      'assessment_questions',
      'eduque_settings'
    ];
    await Promise.all(fastCoreTables.map(t => pullTable(t).catch(() => 0)));

    // Ensure local draft questions are marked published
    const db = getDatabase();
    db.run("UPDATE questions SET status = 'published' WHERE status = 'draft';");
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
  isConfigured: () => getSupabaseConfig().isEnabled,
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
  syncQuestionsToSupabase,
  deleteQuestionFromSupabase,
  syncPoolToSupabase,
  deletePoolFromSupabase,
  syncAttemptToSupabase,
  syncAttemptAnswersToSupabase,
  pullAttemptAnswersForAttempt,
  syncSettingToSupabase,
  syncOnStartup,
  pushAllToSupabase,
  pullFromSupabase,
  pullTable,
  ensureTableFresh,
  ensureTablesFresh,
  invalidateTableCache,
  testSupabaseConnection,
  upsertLocalRows,
  ensureAssessmentQuestionsHydrated,
  ensureAttemptFullyHydrated,
  ensureActiveAttemptForUserHydrated,
  ensureStudentDashboardHydrated,
  ensureClassProgressHydrated
};
