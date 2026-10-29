const { getDatabase } = require('../db');
const { generateId } = require('../utils/crypto');
const { logAction } = require('./auditService');
const { formatQuestionFromDb } = require('./poolService');

const VALID_TYPES = [
  'yes_no',
  'true_false',
  'single_choice',
  'multiple_response',
  'matching',
  'ordering',
  'categorisation',
  'dropdown',
  'fill_blank',
  'scenario',
  'case_study',
  'hot_area',
  'hotspot'
];

function validateQuestionData(data) {
  const { question_type, question_text, answer_options, correct_answer, requires_manual_review } = data;

  if (!VALID_TYPES.includes(question_type)) {
    throw new Error(`Invalid question type '${question_type}'. Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  if (!question_text || !question_text.trim()) {
    throw new Error('Question text is required.');
  }

  // Answer key validation (unless manual review is required)
  if (!requires_manual_review) {
    if (correct_answer === undefined || correct_answer === null || correct_answer === '') {
      throw new Error('A valid answer key is required unless manual review is enabled.');
    }

    if (question_type === 'yes_no') {
      const val = String(correct_answer).trim().toLowerCase();
      if (val !== 'yes' && val !== 'no') {
        throw new Error("Correct answer for Yes/No question must be 'Yes' or 'No'.");
      }
    } else if (question_type === 'true_false') {
      const val = String(correct_answer).trim().toLowerCase();
      if (val !== 'true' && val !== 'false') {
        throw new Error("Correct answer for True/False question must be 'True' or 'False'.");
      }
    } else if (question_type === 'multiple_response') {
      const correctArr = Array.isArray(correct_answer) ? correct_answer : [];
      if (correctArr.length === 0) {
        throw new Error('Multiple response questions require at least one correct answer selected.');
      }
      if (data.required_selection_count && data.required_selection_count !== correctArr.length) {
        throw new Error(`Required selection count (${data.required_selection_count}) does not match the number of correct answers selected (${correctArr.length}).`);
      }
    } else if (question_type === 'hotspot') {
      let stmts = answer_options;
      if (typeof stmts === 'string') {
        try { stmts = JSON.parse(stmts); } catch (_) { stmts = []; }
      }
      if (!Array.isArray(stmts) || stmts.length === 0) {
        throw new Error('Hotspot questions require at least one statement in answer options.');
      }
      let correctObj = correct_answer;
      if (typeof correctObj === 'string') {
        try { correctObj = JSON.parse(correctObj); } catch (_) {}
      }
      if (!correctObj || (typeof correctObj !== 'object' && !Array.isArray(correctObj))) {
        throw new Error('Hotspot questions require a valid answer key mapping statements to their correct options.');
      }
    } else if (question_type === 'matching') {
      let opts = answer_options;
      if (typeof opts === 'string') {
        try { opts = JSON.parse(opts); } catch (_) { opts = []; }
      }
      let correctObj = correct_answer;
      if (typeof correctObj === 'string') {
        try { correctObj = JSON.parse(correctObj); } catch (_) {}
      }

      const hasLegacyPairs = Array.isArray(opts) && opts.length > 0;
      const hasModernSources = typeof opts === 'object' && opts !== null && Array.isArray(opts.sources) && opts.sources.length > 0 && Array.isArray(opts.targets) && opts.targets.length > 0;

      if (!hasLegacyPairs && !hasModernSources) {
        throw new Error('Matching questions require draggable source items and target slots in answer options.');
      }
      if (!correctObj || (typeof correctObj !== 'object' && !Array.isArray(correctObj))) {
        throw new Error('Matching questions require an answer key mapping targets to their correct matches.');
      }
    }
  }
}

function createQuestion(data) {
  const {
    course_id = null,
    topic = '',
    learning_objective = '',
    section_module = '',
    difficulty = 'medium',
    tags = [],
    question_type,
    question_text,
    question_description = '',
    answer_options,
    correct_answer,
    answer_explanation = '',
    explanation_visibility = 'after_submission',
    points = 1,
    partial_credit = false,
    negative_marking = false,
    randomize_options = true,
    requires_manual_review = false,
    status = 'draft',
    version_notes = 'Initial version',
    required_selection_count,
    adminUserId = null,
    adminUsername = 'admin'
  } = data;
  const db = getDatabase();

  validateQuestionData({
    question_type,
    question_text,
    answer_options,
    correct_answer,
    requires_manual_review,
    required_selection_count
  });

  const questionId = generateId();
  const optionsStr = typeof answer_options === 'string' ? answer_options : JSON.stringify(answer_options || []);
  const correctStr = typeof correct_answer === 'string' ? correct_answer : JSON.stringify(correct_answer ?? '');
  const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : (tags || '[]');

  db.run(
    `INSERT INTO questions (
      id, course_id, topic, learning_objective, section_module, difficulty, tags,
      question_type, question_text, question_description, answer_options, correct_answer,
      answer_explanation, explanation_visibility, points, partial_credit, negative_marking,
      randomize_options, requires_manual_review, status, version, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
    [
      questionId, course_id, topic, learning_objective, section_module, difficulty, tagsStr,
      question_type, question_text.trim(), question_description || '', optionsStr, correctStr,
      answer_explanation || '', explanation_visibility, points, partial_credit ? 1 : 0, negative_marking ? 1 : 0,
      randomize_options ? 1 : 0, requires_manual_review ? 1 : 0, status, adminUserId
    ]
  );

  // Snapshot initial version
  const versionId = generateId();
  const snapshotData = {
    question_type,
    question_text,
    question_description,
    answer_options,
    correct_answer,
    answer_explanation,
    points,
    tags
  };
  db.run(
    `INSERT INTO question_versions (id, question_id, version, question_data, change_reason, changed_by, created_at)
     VALUES (?, ?, 1, ?, ?, ?, datetime('now'))`,
    [versionId, questionId, JSON.stringify(snapshotData), version_notes, adminUserId]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'CREATE_QUESTION',
    entityType: 'questions',
    entityId: questionId,
    details: { question_type, topic, points, status }
  });

  return getQuestion(questionId);
}

function getQuestion(questionId) {
  const db = getDatabase();
  const q = db.get(
    `SELECT q.*, c.name as course_name, c.code as course_code, u.username as creator_username
     FROM questions q
     LEFT JOIN courses c ON c.id = q.course_id
     LEFT JOIN users u ON u.id = q.created_by
     WHERE q.id = ?`,
    [questionId]
  );
  if (!q) return null;

  // Assessments using this question
  const assessments = db.all(
    `SELECT a.id, a.name, a.status 
     FROM assessment_questions aq
     JOIN assessments a ON a.id = aq.assessment_id
     WHERE aq.question_id = ?`,
    [questionId]
  );

  // Submitted attempts using this question
  const attemptUsage = db.get(
    `SELECT COUNT(DISTINCT sa.id) as count
     FROM attempt_answers aa
     JOIN student_attempts sa ON sa.id = aa.attempt_id
     WHERE aa.question_id = ? AND sa.status IN ('submitted', 'marked', 'awaiting_review')`,
    [questionId]
  );

  // Version history
  const versions = db.all(
    `SELECT qv.*, u.username as changed_by_username
     FROM question_versions qv
     LEFT JOIN users u ON u.id = qv.changed_by
     WHERE qv.question_id = ?
     ORDER BY qv.version DESC`,
    [questionId]
  ).map(v => ({
    ...v,
    question_data: JSON.parse(v.question_data || '{}')
  }));

  return {
    ...formatQuestionFromDb(q),
    used_in_assessments: assessments,
    assessments_count: assessments.length,
    submitted_attempts_count: attemptUsage?.count || 0,
    versions
  };
}

function listQuestions({
  course_id = '',
  assessment_id = '',
  question_type = '',
  topic = '',
  difficulty = '',
  status = '',
  search = '',
  tags = ''
} = {}) {
  const db = getDatabase();
  let sql = `
    SELECT q.*, c.name as course_name, c.code as course_code,
           (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.question_id = q.id) as usage_count,
           (SELECT COUNT(*) FROM attempt_answers aa JOIN student_attempts sa ON sa.id = aa.attempt_id WHERE aa.question_id = q.id AND sa.status IN ('submitted', 'marked', 'awaiting_review')) as submitted_count
    FROM questions q
    LEFT JOIN courses c ON c.id = q.course_id
    WHERE 1=1
  `;
  const params = [];

  if (course_id) {
    sql += ' AND q.course_id = ?';
    params.push(course_id);
  }
  if (assessment_id) {
    sql += ' AND EXISTS (SELECT 1 FROM assessment_questions aq WHERE aq.question_id = q.id AND aq.assessment_id = ?)';
    params.push(assessment_id);
  }
  if (question_type) {
    sql += ' AND q.question_type = ?';
    params.push(question_type);
  }
  if (topic) {
    sql += ' AND LOWER(q.topic) LIKE ?';
    params.push(`%${topic.toLowerCase()}%`);
  }
  if (difficulty) {
    sql += ' AND q.difficulty = ?';
    params.push(difficulty);
  }
  if (status) {
    sql += ' AND q.status = ?';
    params.push(status);
  }
  if (search) {
    sql += " AND (LOWER(q.question_text) LIKE ? OR LOWER(COALESCE(q.question_description, '')) LIKE ? OR LOWER(COALESCE(q.topic, '')) LIKE ?)";
    const s = `%${search.toLowerCase()}%`;
    params.push(s, s, s);
  }
  if (tags) {
    sql += " AND LOWER(COALESCE(q.tags, '')) LIKE ?";
    params.push(`%${tags.toLowerCase()}%`);
  }

  sql += ' ORDER BY q.updated_at DESC';
  return db.all(sql, params).map(formatQuestionFromDb);
}

/**
 * Controlled Question Update & Versioning (Sections 13 & 14)
 */
function updateQuestion(questionId, data, {
  versionMode = 'future_only', // 'new_version', 'future_only', 'recalculate_previous'
  changeReason = 'Correction / update',
  recalculateAttempts = false,
  adminUserId = null,
  adminUsername = 'admin'
} = {}) {
  const db = getDatabase();
  const current = getQuestion(questionId);
  if (!current) throw new Error('Question not found.');

  // If question was used in submitted student attempts, enforce controlled versioning
  const hasSubmittedAttempts = current.submitted_attempts_count > 0;

  if (hasSubmittedAttempts && versionMode === 'new_version') {
    // Create new version copy
    const newVersionNum = current.version + 1;
    const optionsStr = typeof data.answer_options === 'string' ? data.answer_options : JSON.stringify(data.answer_options ?? current.answer_options);
    const correctStr = typeof data.correct_answer === 'string' ? data.correct_answer : JSON.stringify(data.correct_answer ?? current.correct_answer);
    const tagsStr = Array.isArray(data.tags) ? JSON.stringify(data.tags) : (data.tags ?? JSON.stringify(current.tags));

    const toParam = (v) => v !== undefined ? v : null;

    db.run(
      `UPDATE questions
       SET course_id = COALESCE(?, course_id),
           topic = COALESCE(?, topic),
           learning_objective = COALESCE(?, learning_objective),
           section_module = COALESCE(?, section_module),
           difficulty = COALESCE(?, difficulty),
           tags = COALESCE(?, tags),
           question_type = COALESCE(?, question_type),
           question_text = COALESCE(?, question_text),
           question_description = COALESCE(?, question_description),
           answer_options = COALESCE(?, answer_options),
           correct_answer = COALESCE(?, correct_answer),
           answer_explanation = COALESCE(?, answer_explanation),
           explanation_visibility = COALESCE(?, explanation_visibility),
           points = COALESCE(?, points),
           partial_credit = COALESCE(?, partial_credit),
           negative_marking = COALESCE(?, negative_marking),
           randomize_options = COALESCE(?, randomize_options),
           requires_manual_review = COALESCE(?, requires_manual_review),
           status = COALESCE(?, status),
           version = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        toParam(data.course_id), toParam(data.topic), toParam(data.learning_objective), toParam(data.section_module), toParam(data.difficulty),
        toParam(tagsStr), toParam(data.question_type), toParam(data.question_text), toParam(data.question_description),
        toParam(optionsStr), toParam(correctStr), toParam(data.answer_explanation), toParam(data.explanation_visibility),
        toParam(data.points), data.partial_credit !== undefined ? (data.partial_credit ? 1 : 0) : null,
        data.negative_marking !== undefined ? (data.negative_marking ? 1 : 0) : null,
        data.randomize_options !== undefined ? (data.randomize_options ? 1 : 0) : null,
        data.requires_manual_review !== undefined ? (data.requires_manual_review ? 1 : 0) : null,
        toParam(data.status),
        newVersionNum,
        questionId
      ]
    );

    // Save version snapshot
    const versionId = generateId();
    db.run(
      `INSERT INTO question_versions (id, question_id, version, question_data, change_reason, changed_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [versionId, questionId, newVersionNum, JSON.stringify(data), changeReason, adminUserId]
    );

    logAction({
      userId: adminUserId,
      username: adminUsername,
      action: 'QUESTION_VERSION_CREATED',
      entityType: 'questions',
      entityId: questionId,
      details: { previousVersion: current.version, newVersion: newVersionNum, changeReason }
    });

    return getQuestion(questionId);
  }

  // Standard update or future-only update
  const optionsStr = data.answer_options !== undefined 
    ? (typeof data.answer_options === 'string' ? data.answer_options : JSON.stringify(data.answer_options))
    : null;
  const correctStr = data.correct_answer !== undefined
    ? (typeof data.correct_answer === 'string' ? data.correct_answer : JSON.stringify(data.correct_answer))
    : null;
  const tagsStr = data.tags !== undefined
    ? (Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags)
    : null;

  const toParam = (v) => v !== undefined ? v : null;

  db.run(
    `UPDATE questions
     SET course_id = COALESCE(?, course_id),
         topic = COALESCE(?, topic),
         learning_objective = COALESCE(?, learning_objective),
         section_module = COALESCE(?, section_module),
         difficulty = COALESCE(?, difficulty),
         tags = COALESCE(?, tags),
         question_type = COALESCE(?, question_type),
         question_text = COALESCE(?, question_text),
         question_description = COALESCE(?, question_description),
         answer_options = COALESCE(?, answer_options),
         correct_answer = COALESCE(?, correct_answer),
         answer_explanation = COALESCE(?, answer_explanation),
         explanation_visibility = COALESCE(?, explanation_visibility),
         points = COALESCE(?, points),
         partial_credit = COALESCE(?, partial_credit),
         negative_marking = COALESCE(?, negative_marking),
         randomize_options = COALESCE(?, randomize_options),
         requires_manual_review = COALESCE(?, requires_manual_review),
         status = COALESCE(?, status),
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      toParam(data.course_id), toParam(data.topic), toParam(data.learning_objective), toParam(data.section_module), toParam(data.difficulty),
      toParam(tagsStr), toParam(data.question_type), toParam(data.question_text), toParam(data.question_description),
      toParam(optionsStr), toParam(correctStr), toParam(data.answer_explanation), toParam(data.explanation_visibility),
      toParam(data.points),
      data.partial_credit !== undefined ? (data.partial_credit ? 1 : 0) : null,
      data.negative_marking !== undefined ? (data.negative_marking ? 1 : 0) : null,
      data.randomize_options !== undefined ? (data.randomize_options ? 1 : 0) : null,
      data.requires_manual_review !== undefined ? (data.requires_manual_review ? 1 : 0) : null,
      toParam(data.status),
      questionId
    ]
  );

  // Record audit log of exact changes
  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'UPDATE_QUESTION',
    entityType: 'questions',
    entityId: questionId,
    details: { changeReason, changes: data, previousAnswerKey: current.correct_answer }
  });

  return getQuestion(questionId);
}

function duplicateQuestion(questionId, adminUserId = null, adminUsername = 'admin') {
  const source = getQuestion(questionId);
  if (!source) throw new Error('Source question not found.');

  const duplicate = createQuestion({
    course_id: source.course_id,
    topic: source.topic,
    learning_objective: source.learning_objective,
    section_module: source.section_module,
    difficulty: source.difficulty,
    tags: source.tags,
    question_type: source.question_type,
    question_text: `${source.question_text} (Copy)`,
    question_description: source.question_description,
    answer_options: source.answer_options,
    correct_answer: source.correct_answer,
    answer_explanation: source.answer_explanation,
    explanation_visibility: source.explanation_visibility,
    points: source.points,
    partial_credit: source.partial_credit,
    negative_marking: source.negative_marking,
    randomize_options: source.randomize_options,
    requires_manual_review: source.requires_manual_review,
    status: 'draft',
    version_notes: `Duplicated from question ${questionId}`,
    adminUserId,
    adminUsername
  });

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'DUPLICATE_QUESTION',
    entityType: 'questions',
    entityId: duplicate.id,
    details: { sourceQuestionId: questionId, newQuestionId: duplicate.id }
  });

  return duplicate;
}

function archiveQuestion(questionId, adminUserId = null, adminUsername = 'admin') {
  return updateQuestion(questionId, { status: 'archived' }, { adminUserId, adminUsername, changeReason: 'Archived by administrator' });
}

function deleteQuestions(questionIds, adminUserId = null, adminUsername = 'admin', { force = true } = {}) {
  const db = getDatabase();
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    return { success: true, count: 0 };
  }

  const validIds = questionIds.filter(id => Boolean(id && String(id).trim()));
  if (validIds.length === 0) return { success: true, count: 0 };

  return db.transaction(() => {
    const placeholders = validIds.map(() => '?').join(',');

    if (!force) {
      const hasAttempts = db.get(
        `SELECT COUNT(*) as c FROM attempt_answers WHERE question_id IN (${placeholders})`,
        validIds
      );
      if (hasAttempts?.c > 0) {
        throw new Error('One or more selected questions have already been submitted in student attempts.');
      }
    }

    // 1. Clear self-referencing parent question IDs
    db.run(`UPDATE questions SET parent_question_id = NULL WHERE parent_question_id IN (${placeholders})`, validIds);

    // 2. Cascade delete dependent records
    db.run(`DELETE FROM attempt_answers WHERE question_id IN (${placeholders})`, validIds);
    db.run(`DELETE FROM assessment_questions WHERE question_id IN (${placeholders})`, validIds);
    db.run(`DELETE FROM question_pool_items WHERE question_id IN (${placeholders})`, validIds);
    db.run(`DELETE FROM question_versions WHERE question_id IN (${placeholders})`, validIds);

    // 3. Delete questions
    db.run(`DELETE FROM questions WHERE id IN (${placeholders})`, validIds);

    logAction({
      userId: adminUserId,
      username: adminUsername,
      action: 'DELETE_QUESTIONS_BULK',
      entityType: 'questions',
      entityId: validIds.join(','),
      details: { count: validIds.length, question_ids: validIds }
    });

    return { success: true, count: validIds.length };
  });
}

function deleteQuestion(questionId, adminUserId = null, adminUsername = 'admin', { force = true } = {}) {
  return deleteQuestions([questionId], adminUserId, adminUsername, { force });
}

function importQuestions(items, { courseId = null, adminUserId = null, adminUsername = 'admin' } = {}) {
  const results = {
    total: items.length,
    imported: [],
    errors: []
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const type = item.question_type || item.type || 'single_choice';
      const text = item.question_text || item.question || item.Question;
      const desc = item.question_description || item.description || item.Description || '';
      let options = item.answer_options || item.options || item.Options || [];
      let correct = item.correct_answer || item.correct || item.Correct;
      const explanation = item.answer_explanation || item.explanation || item.Explanation || '';
      const points = Number(item.points || item.Points || 1);
      const difficulty = item.difficulty || 'medium';
      const topic = item.topic || 'General';

      if (typeof options === 'string' && options.startsWith('[')) {
        try { options = JSON.parse(options); } catch (e) { /* keep as is */ }
      }

      const created = createQuestion({
        course_id: item.course_id || courseId,
        topic,
        difficulty,
        question_type: type,
        question_text: text,
        question_description: desc,
        answer_options: options,
        correct_answer: correct,
        answer_explanation: explanation,
        points,
        status: 'draft', // Non-negotiable Rule: imported questions start as Draft
        version_notes: 'Imported from template',
        adminUserId,
        adminUsername
      });

      results.imported.push({
        row: i + 1,
        id: created.id,
        question_text: created.question_text,
        question_type: created.question_type
      });
    } catch (err) {
      results.errors.push({
        row: i + 1,
        data: item,
        error: err.message
      });
    }
  }

  return results;
}

module.exports = {
  createQuestion,
  getQuestion,
  listQuestions,
  updateQuestion,
  duplicateQuestion,
  archiveQuestion,
  deleteQuestion,
  deleteQuestions,
  importQuestions,
  VALID_TYPES
};
