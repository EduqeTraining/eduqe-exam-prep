const { getDatabase } = require('../db');
const { generateId } = require('../utils/crypto');
const { logAction } = require('./auditService');
const { createQuestion, getQuestion } = require('./questionService');
const { getPool, formatQuestionFromDb } = require('./poolService');
const { assignAssessmentToClass, removeAssessmentFromClass } = require('./classService');

const DEFAULT_SECTIONS = ['Section 1', 'Section 2', 'Section 3'];

function parseStoredSections(rawSections) {
  if (!rawSections) return [...DEFAULT_SECTIONS];
  let parsed = rawSections;
  if (typeof rawSections === 'string') {
    try {
      parsed = JSON.parse(rawSections);
    } catch (e) {
      parsed = rawSections.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [...DEFAULT_SECTIONS];
  }
  const names = parsed
    .map(s => (typeof s === 'string' ? s.trim() : (s?.name || '').trim()))
    .filter(Boolean);
  return names.length > 0 ? [...new Set(names)] : [...DEFAULT_SECTIONS];
}

function createAssessment({
  course_id,
  name,
  description = '',
  instructions = '',
  pass_mark_percentage = 70,
  duration_minutes = 60,
  max_attempts = 0,
  available_from = null,
  available_to = null,
  allow_back_navigation = true,
  allow_flagging = true,
  allow_review_screen = true,
  randomize_questions = false,
  randomize_answers = false,
  result_visibility = 'immediate',
  explanation_visibility = 'after_submission',
  sections = DEFAULT_SECTIONS,
  status = 'draft',
  class_ids = [],
  adminUserId = null,
  adminUsername = 'admin'
}) {
  const db = getDatabase();
  const trimmedName = (name || '').trim();

  if (!course_id) throw new Error('Course ID is required.');
  if (!trimmedName) throw new Error('Assessment name is required.');

  const course = db.get('SELECT id FROM courses WHERE id = ?', [course_id]);
  if (!course) throw new Error('Course not found.');

  const assessmentId = generateId();
  const sectionNames = parseStoredSections(sections);

  db.run(
    `INSERT INTO assessments (
      id, course_id, name, description, instructions, pass_mark_percentage, duration_minutes,
      max_attempts, available_from, available_to, allow_back_navigation, allow_flagging,
      allow_review_screen, randomize_questions, randomize_answers, result_visibility,
      explanation_visibility, sections, status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      assessmentId, course_id, trimmedName, description, instructions, pass_mark_percentage, duration_minutes,
      max_attempts, available_from, available_to, allow_back_navigation ? 1 : 0, allow_flagging ? 1 : 0,
      allow_review_screen ? 1 : 0, randomize_questions ? 1 : 0, randomize_answers ? 1 : 0, result_visibility,
      explanation_visibility, JSON.stringify(sectionNames), status, adminUserId
    ]
  );

  // Assign classes if provided
  if (Array.isArray(class_ids)) {
    for (const cId of class_ids) {
      if (cId) assignAssessmentToClass(assessmentId, cId, adminUserId, adminUsername);
    }
  }

  // Sync items if provided on creation
  if (Array.isArray(arguments[0]?.items)) {
    syncAssessmentItems(assessmentId, arguments[0].items, adminUserId, adminUsername);
  }

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'CREATE_ASSESSMENT',
    entityType: 'assessments',
    entityId: assessmentId,
    details: { name: trimmedName, course_id, duration_minutes, pass_mark_percentage, sections: sectionNames, status }
  });

  return getAssessment(assessmentId);
}

function getAssessment(assessmentId) {
  const db = getDatabase();
  const assessment = db.get(
    `SELECT a.*, c.name as course_name, c.code as course_code, u.username as creator_username
     FROM assessments a
     JOIN courses c ON c.id = a.course_id
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.id = ?`,
    [assessmentId]
  );
  if (!assessment) return null;

  // Parse configured sections (defaults to 3 sections: Section 1, Section 2, Section 3)
  const configuredSections = parseStoredSections(assessment.sections);

  // Assigned classes
  const assignedClasses = db.all(
    `SELECT cl.*, ac.id as assignment_id,
            (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = cl.id AND ce.status = 'active') as student_count
     FROM assessment_classes ac
     JOIN classes cl ON cl.id = ac.class_id
     WHERE ac.assessment_id = ?
     ORDER BY cl.name`,
    [assessmentId]
  );

  // Questions in this assessment (direct questions + pools)
  const items = db.all(
    `SELECT aq.id as assessment_question_id, aq.section_name, aq.order_index, aq.points_override,
            aq.question_id, aq.pool_id,
            q.question_type, q.question_text, q.question_description, q.answer_options,
            q.correct_answer, q.answer_explanation, q.explanation_visibility, q.points,
            q.partial_credit, q.negative_marking, q.difficulty, q.topic, q.status as question_status,
            qp.name as pool_name, qp.random_count as pool_random_count
     FROM assessment_questions aq
     LEFT JOIN questions q ON q.id = aq.question_id
     LEFT JOIN question_pools qp ON qp.id = aq.pool_id
     WHERE aq.assessment_id = ?
     ORDER BY aq.order_index ASC, aq.id ASC`,
    [assessmentId]
  );

  // Build final ordered section names list (configured sections + any custom item sections)
  const sectionNames = [...configuredSections];
  for (const item of items) {
    const rawSec = (item.section_name || '').trim();
    if (rawSec && rawSec !== 'General' && !sectionNames.includes(rawSec)) {
      sectionNames.push(rawSec);
    }
  }
  if (sectionNames.length === 0) {
    sectionNames.push(...DEFAULT_SECTIONS);
  }

  const formattedItems = items.map(item => {
    let secName = (item.section_name || '').trim();
    if (!secName || (secName === 'General' && !sectionNames.includes('General'))) {
      secName = sectionNames[0] || 'Section 1';
    }

    if (item.pool_id) {
      return {
        assessment_question_id: item.assessment_question_id,
        is_pool: true,
        pool_id: item.pool_id,
        pool_name: item.pool_name,
        pool_random_count: item.pool_random_count,
        section_name: secName,
        order_index: item.order_index
      };
    }

    const q = formatQuestionFromDb({
      id: item.question_id,
      question_type: item.question_type,
      question_text: item.question_text,
      question_description: item.question_description,
      answer_options: item.answer_options,
      correct_answer: item.correct_answer,
      answer_explanation: item.answer_explanation,
      explanation_visibility: item.explanation_visibility,
      points: item.points_override !== null && item.points_override !== undefined ? item.points_override : item.points,
      partial_credit: item.partial_credit,
      negative_marking: item.negative_marking,
      difficulty: item.difficulty,
      topic: item.topic,
      status: item.question_status
    });

    return {
      assessment_question_id: item.assessment_question_id,
      is_pool: false,
      section_name: secName,
      order_index: item.order_index,
      points_override: item.points_override,
      question: q
    };
  });

  // Sort formattedItems so that items are grouped in the order of sectionNames, then by order_index
  formattedItems.sort((a, b) => {
    const secA = sectionNames.indexOf(a.section_name);
    const secB = sectionNames.indexOf(b.section_name);
    if (secA !== secB) return secA - secB;
    return (a.order_index || 0) - (b.order_index || 0);
  });

  // Build structured sections breakdown
  const structuredSections = sectionNames.map((secName, idx) => {
    const secItems = formattedItems.filter(it => it.section_name === secName);
    const secQuestionCount = secItems.reduce((acc, it) => acc + (it.is_pool ? (it.pool_random_count || 5) : 1), 0);
    const secPoints = secItems.reduce((acc, it) => acc + (it.is_pool ? (it.pool_random_count || 5) : (it.question?.points || 1)), 0);
    return {
      name: secName,
      order_index: idx,
      items: secItems,
      question_count: secQuestionCount,
      total_points: secPoints
    };
  });

  // Calculate total points and total question count
  const totalPoints = formattedItems.reduce((acc, item) => {
    if (item.is_pool) {
      return acc + (item.pool_random_count || 5);
    }
    return acc + (item.question?.points || 1);
  }, 0);

  const totalQuestionCount = formattedItems.reduce((acc, item) => {
    if (item.is_pool) {
      return acc + (item.pool_random_count || 5);
    }
    return acc + 1;
  }, 0);

  return {
    ...assessment,
    allow_back_navigation: Boolean(assessment.allow_back_navigation),
    allow_flagging: Boolean(assessment.allow_flagging),
    allow_review_screen: Boolean(assessment.allow_review_screen),
    randomize_questions: Boolean(assessment.randomize_questions),
    randomize_answers: Boolean(assessment.randomize_answers),
    section_names: sectionNames,
    sections: structuredSections,
    assigned_classes: assignedClasses,
    items: formattedItems,
    item_count: formattedItems.length,
    question_count: totalQuestionCount,
    total_points: totalPoints
  };
}

function listAssessments({ course_id = '', status = '', class_id = '', search = '' } = {}) {
  const db = getDatabase();
  let sql = `
    SELECT a.*, c.name as course_name, c.code as course_code,
           (
             (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id AND aq.question_id IS NOT NULL) +
             COALESCE((SELECT SUM(COALESCE(qp.random_count, 5)) FROM assessment_questions aq JOIN question_pools qp ON qp.id = aq.pool_id WHERE aq.assessment_id = a.id), 0)
           ) as question_count,
           (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id) as item_count,
           (SELECT COUNT(*) FROM assessment_classes ac WHERE ac.assessment_id = a.id) as assigned_class_count,
           (SELECT COUNT(*) FROM student_attempts sa WHERE sa.assessment_id = a.id) as total_attempts,
           (SELECT COUNT(*) FROM student_attempts sa WHERE sa.assessment_id = a.id AND sa.status IN ('submitted', 'marked')) as completed_attempts
    FROM assessments a
    JOIN courses c ON c.id = a.course_id
    WHERE 1=1
  `;
  const params = [];

  if (course_id) {
    sql += ' AND a.course_id = ?';
    params.push(course_id);
  }
  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }
  if (class_id) {
    sql += ' AND EXISTS (SELECT 1 FROM assessment_classes ac WHERE ac.assessment_id = a.id AND ac.class_id = ?)';
    params.push(class_id);
  }
  if (search) {
    sql += " AND (LOWER(a.name) LIKE ? OR LOWER(COALESCE(a.description, '')) LIKE ?)";
    const s = `%${search.toLowerCase()}%`;
    params.push(s, s);
  }

  sql += ' ORDER BY a.created_at DESC';
  return db.all(sql, params).map(a => {
    const sectionNames = parseStoredSections(a.sections);
    return {
      ...a,
      section_names: sectionNames,
      section_count: sectionNames.length,
      allow_back_navigation: Boolean(a.allow_back_navigation),
      allow_flagging: Boolean(a.allow_flagging),
      allow_review_screen: Boolean(a.allow_review_screen),
      randomize_questions: Boolean(a.randomize_questions),
      randomize_answers: Boolean(a.randomize_answers)
    };
  });
}

function updateAssessment(assessmentId, data, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const existing = getAssessment(assessmentId);
  if (!existing) throw new Error('Assessment not found.');

  const {
    name, description, instructions, pass_mark_percentage, duration_minutes, max_attempts,
    available_from, available_to, allow_back_navigation, allow_flagging, allow_review_screen,
    randomize_questions, randomize_answers, result_visibility, explanation_visibility, status,
    sections, class_ids
  } = data;

  const updatedSectionsJson = sections !== undefined
    ? JSON.stringify(parseStoredSections(sections))
    : null;

  db.run(
    `UPDATE assessments
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         instructions = COALESCE(?, instructions),
         pass_mark_percentage = COALESCE(?, pass_mark_percentage),
         duration_minutes = COALESCE(?, duration_minutes),
         max_attempts = COALESCE(?, max_attempts),
         available_from = ?,
         available_to = ?,
         allow_back_navigation = COALESCE(?, allow_back_navigation),
         allow_flagging = COALESCE(?, allow_flagging),
         allow_review_screen = COALESCE(?, allow_review_screen),
         randomize_questions = COALESCE(?, randomize_questions),
         randomize_answers = COALESCE(?, randomize_answers),
         result_visibility = COALESCE(?, result_visibility),
         explanation_visibility = COALESCE(?, explanation_visibility),
         sections = COALESCE(?, sections),
         status = COALESCE(?, status),
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      name ? name.trim() : null,
      description !== undefined ? description : null,
      instructions !== undefined ? instructions : null,
      pass_mark_percentage !== undefined ? pass_mark_percentage : null,
      duration_minutes !== undefined ? duration_minutes : null,
      max_attempts !== undefined ? max_attempts : null,
      available_from !== undefined ? available_from : existing.available_from,
      available_to !== undefined ? available_to : existing.available_to,
      allow_back_navigation !== undefined ? (allow_back_navigation ? 1 : 0) : null,
      allow_flagging !== undefined ? (allow_flagging ? 1 : 0) : null,
      allow_review_screen !== undefined ? (allow_review_screen ? 1 : 0) : null,
      randomize_questions !== undefined ? (randomize_questions ? 1 : 0) : null,
      randomize_answers !== undefined ? (randomize_answers ? 1 : 0) : null,
      result_visibility || null,
      explanation_visibility || null,
      updatedSectionsJson,
      status || null,
      assessmentId
    ]
  );

  // Synchronize assigned classes if explicitly provided
  if (Array.isArray(class_ids)) {
    db.run('DELETE FROM assessment_classes WHERE assessment_id = ?', [assessmentId]);
    for (const cId of class_ids) {
      if (cId) assignAssessmentToClass(assessmentId, cId, adminUserId, adminUsername);
    }
  }

  // Synchronize question/pool items if explicitly provided
  if (Array.isArray(data.items)) {
    syncAssessmentItems(assessmentId, data.items, adminUserId, adminUsername);
  }

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'UPDATE_ASSESSMENT',
    entityType: 'assessments',
    entityId: assessmentId,
    details: { changes: data }
  });

  return getAssessment(assessmentId);
}

function syncAssessmentItems(assessmentId, items, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  db.run('DELETE FROM assessment_questions WHERE assessment_id = ?', [assessmentId]);
  items.forEach((item, idx) => {
    const id = item.assessment_question_id || generateId();
    const sectionName = (item.section_name || '').trim() || 'Section 1';
    const pointsOverride = item.points_override !== undefined ? item.points_override : null;
    if (item.is_pool && item.pool_id) {
      db.run(
        `INSERT INTO assessment_questions (id, assessment_id, pool_id, section_name, order_index)
         VALUES (?, ?, ?, ?, ?)`,
        [id, assessmentId, item.pool_id, sectionName, idx]
      );
    } else {
      const qId = item.question_id || item.question?.id;
      if (qId) {
        db.run(
          `INSERT INTO assessment_questions (id, assessment_id, question_id, section_name, order_index, points_override)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, assessmentId, qId, sectionName, idx, pointsOverride]
        );
        db.run("UPDATE questions SET status = 'published', updated_at = datetime('now') WHERE id = ? AND status = 'draft'", [qId]);
      }
    }
  });
}

function ensureSectionOnAssessment(db, assessmentId, sectionName) {
  if (!sectionName || sectionName === 'General') return;
  const row = db.get('SELECT sections FROM assessments WHERE id = ?', [assessmentId]);
  if (!row) return;
  const current = parseStoredSections(row.sections);
  if (!current.includes(sectionName)) {
    current.push(sectionName);
    db.run('UPDATE assessments SET sections = ? WHERE id = ?', [JSON.stringify(current), assessmentId]);
  }
}

function addQuestionToAssessment(assessmentId, questionId, { sectionName = 'Section 1', pointsOverride = null } = {}, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const cleanSection = (!sectionName || sectionName === 'General') ? 'Section 1' : sectionName.trim();

  const existing = db.get(
    'SELECT id FROM assessment_questions WHERE assessment_id = ? AND question_id = ?',
    [assessmentId, questionId]
  );
  if (existing) {
    // Update section if re-assigned
    if (sectionName && sectionName !== 'General') {
      db.run('UPDATE assessment_questions SET section_name = ? WHERE id = ?', [cleanSection, existing.id]);
      ensureSectionOnAssessment(db, assessmentId, cleanSection);
    }
    return { id: existing.id, added: false, already_exists: true, section_name: cleanSection };
  }

  ensureSectionOnAssessment(db, assessmentId, cleanSection);

  const maxOrder = db.get('SELECT MAX(order_index) as max_order FROM assessment_questions WHERE assessment_id = ?', [assessmentId]);
  const nextOrder = (maxOrder?.max_order ?? -1) + 1;

  const id = generateId();
  db.run(
    `INSERT INTO assessment_questions (id, assessment_id, question_id, section_name, order_index, points_override)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, assessmentId, questionId, cleanSection, nextOrder, pointsOverride]
  );

  // Ensure question added to an assessment is published so it is active in exams
  db.run("UPDATE questions SET status = 'published', updated_at = datetime('now') WHERE id = ? AND status = 'draft'", [questionId]);

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'ADD_QUESTION_TO_ASSESSMENT',
    entityType: 'assessment_questions',
    entityId: id,
    details: { assessmentId, questionId, sectionName: cleanSection, orderIndex: nextOrder }
  });

  return { id, added: true, section_name: cleanSection };
}

/**
 * Create Question directly inside Assessment Builder (Rule 7 & 12)
 */
function createQuestionInAssessment(assessmentId, questionData, { sectionName = 'Section 1', pointsOverride = null } = {}, adminUserId = null, adminUsername = 'admin') {
  const assessment = getAssessment(assessmentId);
  if (!assessment) throw new Error('Assessment not found.');

  const cleanSection = (!sectionName || sectionName === 'General')
    ? (assessment.section_names?.[0] || 'Section 1')
    : sectionName.trim();

  // Create question in Question Bank associated with current course
  const createdQuestion = createQuestion({
    ...questionData,
    course_id: assessment.course_id,
    adminUserId,
    adminUsername
  });

  // Add question to this assessment
  addQuestionToAssessment(assessmentId, createdQuestion.id, { sectionName: cleanSection, pointsOverride }, adminUserId, adminUsername);

  return {
    question: createdQuestion,
    assessment: getAssessment(assessmentId)
  };
}

function addPoolToAssessment(assessmentId, poolId, { sectionName = 'Section 1' } = {}, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const cleanSection = (!sectionName || sectionName === 'General') ? 'Section 1' : sectionName.trim();
  ensureSectionOnAssessment(db, assessmentId, cleanSection);

  const maxOrder = db.get('SELECT MAX(order_index) as max_order FROM assessment_questions WHERE assessment_id = ?', [assessmentId]);
  const nextOrder = (maxOrder?.max_order ?? -1) + 1;

  const id = generateId();
  db.run(
    `INSERT INTO assessment_questions (id, assessment_id, pool_id, section_name, order_index)
     VALUES (?, ?, ?, ?, ?)`,
    [id, assessmentId, poolId, cleanSection, nextOrder]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'ADD_POOL_TO_ASSESSMENT',
    entityType: 'assessment_questions',
    entityId: id,
    details: { assessmentId, poolId, sectionName: cleanSection }
  });

  return { id, added: true, section_name: cleanSection };
}

function removeQuestionFromAssessment(assessmentQuestionId, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  db.run('DELETE FROM assessment_questions WHERE id = ?', [assessmentQuestionId]);
  return { success: true };
}

function reorderAssessmentQuestions(assessmentId, orderedIds) {
  const db = getDatabase();
  for (let i = 0; i < orderedIds.length; i++) {
    db.run('UPDATE assessment_questions SET order_index = ? WHERE id = ? AND assessment_id = ?', [i, orderedIds[i], assessmentId]);
  }
  return { success: true };
}

function duplicateAssessment(assessmentId, newName, adminUserId = null, adminUsername = 'admin') {
  const source = getAssessment(assessmentId);
  if (!source) throw new Error('Source assessment not found.');

  const duplicatedName = (newName || `${source.name} (Copy)`).trim();
  const created = createAssessment({
    course_id: source.course_id,
    name: duplicatedName,
    description: source.description,
    instructions: source.instructions,
    pass_mark_percentage: source.pass_mark_percentage,
    duration_minutes: source.duration_minutes,
    max_attempts: source.max_attempts,
    allow_back_navigation: source.allow_back_navigation,
    allow_flagging: source.allow_flagging,
    allow_review_screen: source.allow_review_screen,
    randomize_questions: source.randomize_questions,
    randomize_answers: source.randomize_answers,
    result_visibility: source.result_visibility,
    explanation_visibility: source.explanation_visibility,
    sections: source.section_names || DEFAULT_SECTIONS,
    status: 'draft',
    adminUserId,
    adminUsername
  });

  // Duplicate questions & pools
  for (const item of source.items) {
    if (item.is_pool) {
      addPoolToAssessment(created.id, item.pool_id, { sectionName: item.section_name }, adminUserId, adminUsername);
    } else if (item.question?.id) {
      addQuestionToAssessment(created.id, item.question.id, { sectionName: item.section_name, pointsOverride: item.points_override }, adminUserId, adminUsername);
    }
  }

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'DUPLICATE_ASSESSMENT',
    entityType: 'assessments',
    entityId: created.id,
    details: { sourceAssessmentId: assessmentId, newAssessmentId: created.id }
  });

  return getAssessment(created.id);
}

function setAssessmentStatus(assessmentId, status, adminUserId = null, adminUsername = 'admin') {
  const valid = ['draft', 'published', 'unpublished', 'archived'];
  if (!valid.includes(status)) throw new Error(`Invalid status: ${status}`);
  return updateAssessment(assessmentId, { status }, adminUserId, adminUsername);
}

module.exports = {
  DEFAULT_SECTIONS,
  parseStoredSections,
  createAssessment,
  getAssessment,
  listAssessments,
  updateAssessment,
  addQuestionToAssessment,
  createQuestionInAssessment,
  addPoolToAssessment,
  removeQuestionFromAssessment,
  reorderAssessmentQuestions,
  duplicateAssessment,
  setAssessmentStatus
};
