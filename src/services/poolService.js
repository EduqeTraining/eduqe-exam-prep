const { getDatabase } = require('../db');
const { generateId } = require('../utils/crypto');
const { logAction } = require('./auditService');

function createPool({ courseId, name, description = '', randomCount = 5, adminUserId = null, adminUsername = 'admin' }) {
  const db = getDatabase();
  const trimmedName = (name || '').trim();
  if (!trimmedName) throw new Error('Pool name is required.');

  const poolId = generateId();
  db.run(
    `INSERT INTO question_pools (id, course_id, name, description, random_count, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [poolId, courseId || null, trimmedName, description, randomCount]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'CREATE_QUESTION_POOL',
    entityType: 'question_pools',
    entityId: poolId,
    details: { name: trimmedName, randomCount }
  });

  return getPool(poolId);
}

function getPool(poolId) {
  const db = getDatabase();
  const pool = db.get(
    `SELECT qp.*, c.name as course_name 
     FROM question_pools qp
     LEFT JOIN courses c ON c.id = qp.course_id
     WHERE qp.id = ?`,
    [poolId]
  );
  if (!pool) return null;

  const questions = db.all(
    `SELECT q.*, qpi.id as pool_item_id
     FROM question_pool_items qpi
     JOIN questions q ON q.id = qpi.question_id
     WHERE qpi.pool_id = ?
     ORDER BY q.created_at DESC`,
    [poolId]
  ).map(formatQuestionFromDb);

  return {
    ...pool,
    questions,
    total_questions: questions.length
  };
}

function listPools(courseId = null) {
  const db = getDatabase();
  let sql = `
    SELECT qp.*, c.name as course_name,
           (SELECT COUNT(*) FROM question_pool_items qpi WHERE qpi.pool_id = qp.id) as question_count
    FROM question_pools qp
    LEFT JOIN courses c ON c.id = qp.course_id
    WHERE 1=1
  `;
  const params = [];
  if (courseId) {
    sql += ' AND (qp.course_id = ? OR qp.course_id IS NULL)';
    params.push(courseId);
  }
  sql += ' ORDER BY qp.created_at DESC';
  return db.all(sql, params);
}

function addQuestionToPool(poolId, questionId) {
  const db = getDatabase();
  const existing = db.get('SELECT id FROM question_pool_items WHERE pool_id = ? AND question_id = ?', [poolId, questionId]);
  if (existing) return { id: existing.id, exists: true };

  const id = generateId();
  db.run('INSERT INTO question_pool_items (id, pool_id, question_id) VALUES (?, ?, ?)', [id, poolId, questionId]);
  return { id, added: true };
}

function removeQuestionFromPool(poolId, questionId) {
  const db = getDatabase();
  db.run('DELETE FROM question_pool_items WHERE pool_id = ? AND question_id = ?', [poolId, questionId]);
  return { success: true };
}

function deletePool(poolId, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const existing = getPool(poolId);
  if (!existing) {
    throw new Error('Question pool not found.');
  }

  return db.transaction(() => {
    db.run('DELETE FROM assessment_questions WHERE pool_id = ?', [poolId]);
    db.run('DELETE FROM question_pool_items WHERE pool_id = ?', [poolId]);
    db.run('DELETE FROM question_pools WHERE id = ?', [poolId]);

    logAction({
      userId: adminUserId,
      username: adminUsername,
      action: 'DELETE_QUESTION_POOL',
      entityType: 'question_pools',
      entityId: poolId,
      details: { name: existing.name, courseId: existing.course_id }
    });

    return { success: true, deletedId: poolId, name: existing.name };
  });
}

function selectRandomQuestionsFromPool(poolId, count = null) {
  const pool = getPool(poolId);
  if (!pool || !pool.questions.length) return [];
  const targetCount = count || pool.random_count || 5;

  // Shuffle array
  const shuffled = [...pool.questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, targetCount);
}

function formatQuestionFromDb(q) {
  if (!q) return null;
  let answerOptions = [];
  let correctAnswer = null;
  let tags = [];

  try { answerOptions = q.answer_options ? JSON.parse(q.answer_options) : []; } catch (e) { answerOptions = q.answer_options; }
  try { correctAnswer = q.correct_answer ? JSON.parse(q.correct_answer) : null; } catch (e) { correctAnswer = q.correct_answer; }
  try { tags = q.tags ? JSON.parse(q.tags) : []; } catch (e) { tags = q.tags ? q.tags.split(',') : []; }

  return {
    ...q,
    partial_credit: Boolean(q.partial_credit),
    negative_marking: Boolean(q.negative_marking),
    randomize_options: Boolean(q.randomize_options),
    requires_manual_review: Boolean(q.requires_manual_review),
    answer_options: answerOptions,
    correct_answer: correctAnswer,
    tags
  };
}

module.exports = {
  createPool,
  getPool,
  listPools,
  addQuestionToPool,
  removeQuestionFromPool,
  deletePool,
  selectRandomQuestionsFromPool,
  formatQuestionFromDb
};
