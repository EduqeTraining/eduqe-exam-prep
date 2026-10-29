const fs = require('node:fs');
const path = require('node:path');
const { getDatabase } = require('../src/db');

function escapeSqlString(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function exportSeed() {
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

  let sql = '-- =========================================================\n';
  sql += '-- Eduqe Demonstration Curriculum & Question Bank Seed Data\n';
  sql += '-- Generated for Supabase PostgreSQL\n';
  sql += '-- =========================================================\n\n';

  for (const table of tables) {
    const rows = db.all(`SELECT * FROM ${table}`);
    if (!rows || rows.length === 0) continue;

    sql += `-- ---------------------------------------------------------\n`;
    sql += `-- Table: ${table} (${rows.length} records)\n`;
    sql += `-- ---------------------------------------------------------\n`;

    const cols = Object.keys(rows[0]);
    const colList = cols.map(c => `"${c}"`).join(', ');

    for (const row of rows) {
      const vals = cols.map(c => escapeSqlString(row[c])).join(', ');
      sql += `INSERT INTO "${table}" (${colList}) VALUES (${vals}) ON CONFLICT ("id") DO NOTHING;\n`;
    }
    sql += '\n';
  }

  const outDir = path.join(__dirname, '../supabase');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'seed.sql');
  fs.writeFileSync(outPath, sql, 'utf8');
  console.log('Successfully generated Supabase seed file:', outPath);
}

exportSeed();
