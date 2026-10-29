const { getDatabase } = require('../db');
const { generateId, generateRandomCode } = require('../utils/crypto');
const { logAction } = require('./auditService');
const { createCode } = require('./accessCodeService');

function createCourse({
  name,
  code,
  description = '',
  subject = '',
  learning_track = '',
  image_url = '',
  start_date = null,
  end_date = null,
  status = 'draft',
  access_code = null,
  adminUserId = null,
  adminUsername = 'admin'
}) {
  const db = getDatabase();
  const trimmedName = (name || '').trim();
  const courseCode = (code || generateRandomCode('CRS', 5)).trim().toUpperCase();

  if (!trimmedName) {
    throw new Error('Course name is required.');
  }

  // Check unique course code
  const existing = db.get('SELECT id FROM courses WHERE code = ?', [courseCode]);
  if (existing) {
    throw new Error(`A course with code '${courseCode}' already exists.`);
  }

  const courseId = generateId();

  db.run(
    `INSERT INTO courses (id, name, code, description, subject, learning_track, image_url, start_date, end_date, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [courseId, trimmedName, courseCode, description, subject, learning_track, image_url, start_date, end_date, status, adminUserId]
  );

  // Generate or create access code if specified
  const initialCode = access_code ? access_code.trim().toUpperCase() : `${courseCode}-CODE01`;
  createCode({
    courseId,
    code: initialCode,
    expiresAt: end_date,
    adminUserId,
    adminUsername
  });

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'CREATE_COURSE',
    entityType: 'courses',
    entityId: courseId,
    details: { name: trimmedName, code: courseCode, status, initialCode }
  });

  return getCourse(courseId);
}

function getCourse(courseId) {
  const db = getDatabase();
  const course = db.get(
    `SELECT c.*, u.username as creator_username
     FROM courses c
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.id = ?`,
    [courseId]
  );

  if (!course) return null;

  // Associated classes
  const classes = db.all(
    `SELECT cl.*, 
            (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = cl.id AND ce.status = 'active') as student_count,
            (SELECT COUNT(*) FROM assessment_classes ac WHERE ac.class_id = cl.id) as assessment_count
     FROM classes cl
     WHERE cl.course_id = ?
     ORDER BY cl.created_at DESC`,
    [courseId]
  );

  // Associated assessments
  const assessments = db.all(
    `SELECT a.*,
            (
              (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id AND aq.question_id IS NOT NULL) +
              COALESCE((SELECT SUM(COALESCE(qp.random_count, 5)) FROM assessment_questions aq JOIN question_pools qp ON qp.id = aq.pool_id WHERE aq.assessment_id = a.id), 0)
            ) as question_count
     FROM assessments a
     WHERE a.course_id = ?
     ORDER BY a.created_at DESC`,
    [courseId]
  );

  // Active access code
  const activeCode = db.get(
    'SELECT * FROM course_access_codes WHERE course_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
    [courseId]
  );

  return {
    ...course,
    classes,
    assessments,
    active_code: activeCode?.code || null,
    active_code_details: activeCode || null
  };
}

function listCourses({ query = '', status = '', subject = '', learning_track = '' } = {}) {
  const db = getDatabase();
  let sql = `
    SELECT c.*,
           (SELECT COUNT(*) FROM classes cl WHERE cl.course_id = c.id) as class_count,
           (SELECT COUNT(*) FROM assessments a WHERE a.course_id = c.id) as assessment_count,
           (SELECT COUNT(DISTINCT ce.user_id) 
            FROM class_enrollments ce 
            JOIN classes cl ON cl.id = ce.class_id 
            WHERE cl.course_id = c.id AND ce.status = 'active') as enrolled_students_count,
           (SELECT cac.code FROM course_access_codes cac WHERE cac.course_id = c.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1) as active_code
    FROM courses c
    WHERE 1=1
  `;
  const params = [];

  if (query) {
    sql += ' AND (LOWER(c.name) LIKE ? OR LOWER(c.code) LIKE ? OR LOWER(c.description) LIKE ?)';
    const q = `%${query.toLowerCase()}%`;
    params.push(q, q, q);
  }
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  if (subject) {
    sql += ' AND LOWER(c.subject) = LOWER(?)';
    params.push(subject);
  }
  if (learning_track) {
    sql += ' AND LOWER(c.learning_track) = LOWER(?)';
    params.push(learning_track);
  }

  sql += ' ORDER BY c.created_at DESC';
  return db.all(sql, params);
}

function updateCourse(courseId, data, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const existing = getCourse(courseId);
  if (!existing) {
    throw new Error('Course not found.');
  }

  const { name, code, description, subject, learning_track, image_url, start_date, end_date, status } = data;

  if (code && code.trim().toUpperCase() !== existing.code) {
    const codeCheck = db.get('SELECT id FROM courses WHERE code = ? AND id != ?', [code.trim().toUpperCase(), courseId]);
    if (codeCheck) {
      throw new Error(`Course code '${code}' is already in use.`);
    }
  }

  db.run(
    `UPDATE courses
     SET name = COALESCE(?, name),
         code = COALESCE(?, code),
         description = COALESCE(?, description),
         subject = COALESCE(?, subject),
         learning_track = COALESCE(?, learning_track),
         image_url = COALESCE(?, image_url),
         start_date = ?,
         end_date = ?,
         status = COALESCE(?, status),
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      name ? name.trim() : null,
      code ? code.trim().toUpperCase() : null,
      description !== undefined ? description : null,
      subject !== undefined ? subject : null,
      learning_track !== undefined ? learning_track : null,
      image_url !== undefined ? image_url : null,
      start_date !== undefined ? start_date : existing.start_date,
      end_date !== undefined ? end_date : existing.end_date,
      status || null,
      courseId
    ]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'UPDATE_COURSE',
    entityType: 'courses',
    entityId: courseId,
    details: { changes: data }
  });

  return getCourse(courseId);
}

function duplicateCourse(courseId, newName, newCode, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const source = getCourse(courseId);
  if (!source) {
    throw new Error('Source course not found.');
  }

  const duplicateName = (newName || `${source.name} (Copy)`).trim();
  const duplicateCode = (newCode || `${source.code}_COPY`).trim().toUpperCase();

  const created = createCourse({
    name: duplicateName,
    code: duplicateCode,
    description: source.description,
    subject: source.subject,
    learning_track: source.learning_track,
    image_url: source.image_url,
    status: 'draft',
    adminUserId,
    adminUsername
  });

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'DUPLICATE_COURSE',
    entityType: 'courses',
    entityId: created.id,
    details: { sourceCourseId: courseId, newCourseId: created.id }
  });

  return created;
}

function setCourseStatus(courseId, status, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const valid = ['draft', 'published', 'closed', 'archived'];
  if (!valid.includes(status)) {
    throw new Error(`Invalid status '${status}'. Must be one of: ${valid.join(', ')}`);
  }

  db.run("UPDATE courses SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, courseId]);

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: `SET_COURSE_STATUS_${status.toUpperCase()}`,
    entityType: 'courses',
    entityId: courseId,
    details: { status }
  });

  return getCourse(courseId);
}

function deleteCourse(courseId, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const existing = getCourse(courseId);
  if (!existing) {
    throw new Error('Course not found.');
  }

  return db.transaction(() => {
    // 1. Delete attempt answers and student attempts tied to this course's classes or assessments
    db.run(
      `DELETE FROM attempt_answers 
       WHERE attempt_id IN (
         SELECT id FROM student_attempts 
         WHERE class_id IN (SELECT id FROM classes WHERE course_id = ?)
            OR assessment_id IN (SELECT id FROM assessments WHERE course_id = ?)
       )`,
      [courseId, courseId]
    );

    db.run(
      `DELETE FROM student_attempts 
       WHERE class_id IN (SELECT id FROM classes WHERE course_id = ?)
          OR assessment_id IN (SELECT id FROM assessments WHERE course_id = ?)`,
      [courseId, courseId]
    );

    // 2. Delete class enrollments and assessment_classes links for this course's classes
    db.run(
      `DELETE FROM class_enrollments WHERE class_id IN (SELECT id FROM classes WHERE course_id = ?)`,
      [courseId]
    );

    db.run(
      `DELETE FROM assessment_classes 
       WHERE class_id IN (SELECT id FROM classes WHERE course_id = ?)
          OR assessment_id IN (SELECT id FROM assessments WHERE course_id = ?)`,
      [courseId, courseId]
    );

    // 3. Delete assessment_questions and assessments for this course
    db.run(
      `DELETE FROM assessment_questions WHERE assessment_id IN (SELECT id FROM assessments WHERE course_id = ?)`,
      [courseId]
    );
    db.run(`DELETE FROM assessments WHERE course_id = ?`, [courseId]);

    // 4. Delete question pools and pool items for this course
    db.run(
      `DELETE FROM question_pool_items WHERE pool_id IN (SELECT id FROM question_pools WHERE course_id = ?)`,
      [courseId]
    );
    db.run(`DELETE FROM question_pools WHERE course_id = ?`, [courseId]);

    // 5. Delete questions and their dependent records for this course
    db.run(
      `UPDATE questions SET parent_question_id = NULL WHERE parent_question_id IN (SELECT id FROM questions WHERE course_id = ?)`,
      [courseId]
    );
    db.run(
      `DELETE FROM attempt_answers WHERE question_id IN (SELECT id FROM questions WHERE course_id = ?)`,
      [courseId]
    );
    db.run(
      `DELETE FROM assessment_questions WHERE question_id IN (SELECT id FROM questions WHERE course_id = ?)`,
      [courseId]
    );
    db.run(
      `DELETE FROM question_pool_items WHERE question_id IN (SELECT id FROM questions WHERE course_id = ?)`,
      [courseId]
    );
    db.run(
      `DELETE FROM question_versions WHERE question_id IN (SELECT id FROM questions WHERE course_id = ?)`,
      [courseId]
    );
    db.run(`DELETE FROM questions WHERE course_id = ?`, [courseId]);

    // 6. Delete classes for this course
    db.run(`DELETE FROM classes WHERE course_id = ?`, [courseId]);

    // 7. Delete course access codes for this course
    db.run(`DELETE FROM course_access_codes WHERE course_id = ?`, [courseId]);

    // 8. Delete the course itself
    db.run(`DELETE FROM courses WHERE id = ?`, [courseId]);

    logAction({
      userId: adminUserId,
      username: adminUsername,
      action: 'DELETE_COURSE',
      entityType: 'courses',
      entityId: courseId,
      details: { name: existing.name, code: existing.code }
    });

    return { success: true, deletedId: courseId, name: existing.name };
  });
}

module.exports = {
  createCourse,
  getCourse,
  listCourses,
  updateCourse,
  duplicateCourse,
  setCourseStatus,
  deleteCourse
};
