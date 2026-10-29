const { getDatabase } = require('../db');
const { generateId, generateRandomCode } = require('../utils/crypto');
const { logAction } = require('./auditService');

function createCode({ courseId = null, classId = null, code, expiresAt = null, maxUses = null, max_uses = null, adminUserId = null, adminUsername = 'admin' }) {
  const db = getDatabase();
  const trimmedCode = (code || '').trim().toUpperCase();

  if (!trimmedCode) {
    throw new Error('Access code is required.');
  }

  let resolvedCourseId = courseId;
  if (classId && !resolvedCourseId) {
    const cls = db.get('SELECT course_id FROM classes WHERE id = ?', [classId]);
    if (!cls) throw new Error('Associated class not found.');
    resolvedCourseId = cls.course_id;
  }

  if (!resolvedCourseId) {
    throw new Error('Course or class ID is required to create an access code.');
  }

  // Check unique active code
  const existing = db.get('SELECT * FROM course_access_codes WHERE UPPER(code) = ? AND is_active = 1', [trimmedCode]);
  if (existing) {
    throw new Error(`An active access code '${trimmedCode}' already exists.`);
  }

  const rawMax = maxUses !== null && maxUses !== undefined ? maxUses : max_uses;
  const parsedMax = (rawMax !== null && rawMax !== undefined && rawMax !== '') ? parseInt(rawMax, 10) : null;
  if (parsedMax !== null && (isNaN(parsedMax) || parsedMax < 1)) {
    throw new Error('Maximum uses must be a positive number greater than 0.');
  }

  const id = generateId();
  db.run(
    `INSERT INTO course_access_codes (id, course_id, class_id, code, is_active, expires_at, max_uses, used_count, created_by, created_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, 0, ?, datetime('now'))`,
    [id, resolvedCourseId, classId || null, trimmedCode, expiresAt, parsedMax, adminUserId]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'CREATE_ACCESS_CODE',
    entityType: 'course_access_codes',
    entityId: id,
    details: { courseId: resolvedCourseId, classId: classId || null, code: trimmedCode, expiresAt, maxUses: parsedMax }
  });

  return getCodeById(id);
}

function getCodeById(codeId) {
  const db = getDatabase();
  return db.get(
    `SELECT c.*, u.username as creator_username, cl.name as class_name
     FROM course_access_codes c
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN classes cl ON cl.id = c.class_id
     WHERE c.id = ?`,
    [codeId]
  );
}

function listCodesForCourse(courseId) {
  const db = getDatabase();
  return db.all(
    `SELECT c.*, u.username as creator_username, cl.name as class_name
     FROM course_access_codes c
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN classes cl ON cl.id = c.class_id
     WHERE c.course_id = ?
     ORDER BY c.created_at DESC`,
    [courseId]
  );
}

function listCodesForClass(classId) {
  const db = getDatabase();
  const cls = db.get('SELECT id, course_id FROM classes WHERE id = ?', [classId]);
  if (!cls) return [];

  const directCodes = db.all(
    `SELECT c.*, u.username as creator_username, cl.name as class_name
     FROM course_access_codes c
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN classes cl ON cl.id = c.class_id
     WHERE c.class_id = ?
     ORDER BY c.created_at DESC`,
    [classId]
  );

  if (directCodes.length > 0) {
    return directCodes;
  }

  // Fallback for legacy unassigned codes on the parent course
  return db.all(
    `SELECT c.*, u.username as creator_username, cl.name as class_name
     FROM course_access_codes c
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN classes cl ON cl.id = c.class_id
     WHERE c.course_id = ? AND c.class_id IS NULL
     ORDER BY c.created_at DESC`,
    [cls.course_id]
  );
}

function replaceCode({ oldCodeId, newCode = null, adminUserId = null, adminUsername = 'admin', reason = 'Compromised or rotated code' }) {
  const db = getDatabase();
  const old = getCodeById(oldCodeId);
  if (!old) {
    throw new Error('Access code not found.');
  }

  // Deactivate old code
  db.run('UPDATE course_access_codes SET is_active = 0 WHERE id = ?', [oldCodeId]);

  // Generate or use new code
  const generatedCode = newCode ? newCode.trim().toUpperCase() : generateRandomCode('CODE', 6);
  const newCodeRecord = createCode({
    courseId: old.course_id,
    classId: old.class_id || null,
    code: generatedCode,
    expiresAt: old.expires_at,
    maxUses: old.max_uses,
    adminUserId,
    adminUsername
  });

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'REPLACE_COURSE_ACCESS_CODE',
    entityType: 'course_access_codes',
    entityId: newCodeRecord.id,
    details: { oldCodeId, oldCode: old.code, newCode: newCodeRecord.code, classId: old.class_id, reason }
  });

  return newCodeRecord;
}

function setCodeStatus(codeId, isActive, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const code = getCodeById(codeId);
  if (!code) throw new Error('Code not found.');

  db.run('UPDATE course_access_codes SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, codeId]);

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: isActive ? 'ACTIVATE_COURSE_CODE' : 'DEACTIVATE_COURSE_CODE',
    entityType: 'course_access_codes',
    entityId: codeId,
    details: { code: code.code }
  });

  return getCodeById(codeId);
}

function updateCode(codeId, updates = {}, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const codeRecord = getCodeById(codeId);
  if (!codeRecord) {
    throw new Error('Access code not found.');
  }

  const { maxUses, max_uses, expiresAt, expires_at, isActive, is_active } = updates;

  let finalMaxUses = codeRecord.max_uses;
  if (maxUses !== undefined) {
    finalMaxUses = (maxUses === null || maxUses === '') ? null : parseInt(maxUses, 10);
  } else if (max_uses !== undefined) {
    finalMaxUses = (max_uses === null || max_uses === '') ? null : parseInt(max_uses, 10);
  }

  if (finalMaxUses !== null && (isNaN(finalMaxUses) || finalMaxUses < 1)) {
    throw new Error('Maximum uses must be a positive number greater than 0.');
  }

  const finalExpiresAt = (expiresAt !== undefined ? expiresAt : (expires_at !== undefined ? expires_at : codeRecord.expires_at));
  let finalIsActive = codeRecord.is_active;
  if (isActive !== undefined) {
    finalIsActive = isActive ? 1 : 0;
  } else if (is_active !== undefined) {
    finalIsActive = is_active ? 1 : 0;
  }

  db.run(
    `UPDATE course_access_codes
     SET max_uses = ?,
         expires_at = ?,
         is_active = ?
     WHERE id = ?`,
    [finalMaxUses, finalExpiresAt, finalIsActive, codeId]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'UPDATE_ACCESS_CODE',
    entityType: 'course_access_codes',
    entityId: codeId,
    details: { code: codeRecord.code, max_uses: finalMaxUses, expires_at: finalExpiresAt, is_active: finalIsActive }
  });

  return getCodeById(codeId);
}

/**
 * 10-Step Student Access Process
 */
function redeemCourseCode({ userId, rawCode, targetClassId = null }) {
  const db = getDatabase();
  const codeStr = (rawCode || '').trim().toUpperCase();

  // Step 1 & 3: Check student account & status
  const user = db.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    throw new Error('User account not found.');
  }
  if (user.account_status === 'suspended') {
    throw new Error('Your account has been suspended. Please contact your administrator.');
  }
  if (user.account_status === 'deactivated') {
    throw new Error('Your account has been deactivated. Please contact your administrator.');
  }
  if (user.account_status !== 'active') {
    throw new Error(`Your account status is ${user.account_status}. Access denied.`);
  }

  // Step 2 & 4: Check whether code exists
  // 1. Exact match in course_access_codes (case-insensitive)
  let codeRecord = db.get('SELECT * FROM course_access_codes WHERE UPPER(code) = ?', [codeStr]);

  // 2. Normalized match in course_access_codes (stripping '-', '_', spaces)
  if (!codeRecord) {
    const cleanInput = codeStr.replace(/[-\s_]/g, '');
    codeRecord = db.get(
      "SELECT * FROM course_access_codes WHERE UPPER(REPLACE(REPLACE(REPLACE(code, '-', ''), ' ', ''), '_', '')) = ? AND is_active = 1",
      [cleanInput]
    );
  }

  // 3. Fallback match in courses table (matching course code like 'AZ-900', 'AZ900', or course name)
  let matchedCourse = null;
  if (!codeRecord) {
    const cleanInput = codeStr.replace(/[-\s_]/g, '');
    matchedCourse = db.get(
      `SELECT * FROM courses 
       WHERE (UPPER(code) = ? OR UPPER(REPLACE(REPLACE(REPLACE(code, '-', ''), ' ', ''), '_', '')) = ? OR UPPER(name) = ?)
       AND status = 'published'`,
      [codeStr, cleanInput, codeStr]
    );

    if (matchedCourse) {
      // Find active code for this course or create a new matching code
      codeRecord = db.get(
        'SELECT * FROM course_access_codes WHERE course_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
        [matchedCourse.id]
      );

      if (!codeRecord) {
        const newCodeId = generateId();
        const codeValue = (matchedCourse.code || codeStr).trim().toUpperCase();
        db.run(
          `INSERT INTO course_access_codes (id, course_id, code, is_active, created_at, created_by_user_id, created_by_username)
           VALUES (?, ?, ?, 1, datetime('now'), ?, ?)`,
          [newCodeId, matchedCourse.id, codeValue, user.id, user.username]
        );
        codeRecord = db.get('SELECT * FROM course_access_codes WHERE id = ?', [newCodeId]);
      }
    }
  }

  if (!codeRecord) {
    throw new Error(`Invalid course access code '${codeStr}'. Please verify the code and try again.`);
  }

  // Step 5: Check whether code is active
  if (!codeRecord.is_active) {
    throw new Error('This course access code is currently inactive.');
  }

  // Step 6: Check whether code has expired
  if (codeRecord.expires_at) {
    const expires = new Date(codeRecord.expires_at).getTime();
    if (Date.now() > expires) {
      throw new Error('This course access code has expired.');
    }
  }

  // Check max uses if configured
  if (codeRecord.max_uses && codeRecord.used_count >= codeRecord.max_uses) {
    throw new Error(`This course access code has reached its maximum usage limit (${codeRecord.used_count}/${codeRecord.max_uses} used). Please contact your administrator to increase the seat limit.`);
  }

  // Step 7: Check whether course exists and is published
  const course = db.get('SELECT * FROM courses WHERE id = ?', [codeRecord.course_id]);
  if (!course) {
    throw new Error('Associated course not found.');
  }
  if (course.status !== 'published') {
    throw new Error('This course is not currently published.');
  }

  // Step 8 & 9: Check course access period if defined
  const now = Date.now();
  if (course.start_date) {
    const startDate = new Date(course.start_date).getTime();
    if (now < startDate) {
      throw new Error('Course access period has not started yet.');
    }
  }
  if (course.end_date) {
    const endDate = new Date(course.end_date).getTime();
    if (now > endDate) {
      throw new Error('Course access period has expired.');
    }
  }

  // Resolve target class: codeRecord.class_id -> targetClassId -> default/first class under course
  let assignedClass = null;
  if (codeRecord.class_id) {
    assignedClass = db.get('SELECT * FROM classes WHERE id = ?', [codeRecord.class_id]);
    if (assignedClass && assignedClass.status !== 'active') {
      throw new Error('The class associated with this access code is no longer active.');
    }
  }
  if (!assignedClass && targetClassId) {
    assignedClass = db.get("SELECT * FROM classes WHERE id = ? AND course_id = ? AND status = 'active'", [targetClassId, course.id]);
  }
  if (!assignedClass) {
    assignedClass = db.get("SELECT * FROM classes WHERE course_id = ? AND status = 'active' ORDER BY created_at ASC LIMIT 1", [course.id]);
  }
  if (!assignedClass) {
    // If no class exists under the course yet, create a default class
    const defaultClassId = generateId();
    db.run(
      `INSERT INTO classes (id, course_id, name, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`,
      [defaultClassId, course.id, `${course.name} - General Enrolment`, 'Default class for enrolled students']
    );
    assignedClass = db.get('SELECT * FROM classes WHERE id = ?', [defaultClassId]);
  }

  // Check if student is already enrolled in this class
  const existingEnrollment = db.get(
    'SELECT * FROM class_enrollments WHERE class_id = ? AND user_id = ?',
    [assignedClass.id, user.id]
  );

  let enrollmentId = existingEnrollment?.id;

  if (existingEnrollment) {
    if (existingEnrollment.status === 'suspended' || existingEnrollment.status === 'revoked') {
      throw new Error('Your enrolment in this class has been suspended or revoked. Contact your administrator.');
    }
    // Already enrolled and active
  } else {
    // Step 10: Grant access & create enrolment
    enrollmentId = generateId();
    let accessExpiresAt = null;
    if (assignedClass.access_duration_days) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + assignedClass.access_duration_days);
      accessExpiresAt = expDate.toISOString();
    } else if (course.end_date) {
      accessExpiresAt = course.end_date;
    }

    db.run(
      `INSERT INTO class_enrollments (id, class_id, user_id, enrolled_at, access_starts_at, access_expires_at, status, granted_by_code_id)
       VALUES (?, ?, ?, datetime('now'), datetime('now'), ?, 'active', ?)`,
      [enrollmentId, assignedClass.id, user.id, accessExpiresAt, codeRecord.id]
    );

    // Increment code usage
    db.run('UPDATE course_access_codes SET used_count = used_count + 1 WHERE id = ?', [codeRecord.id]);

    logAction({
      userId: user.id,
      username: user.username,
      action: 'REDEEM_COURSE_CODE',
      entityType: 'class_enrollments',
      entityId: enrollmentId,
      details: { courseId: course.id, courseName: course.name, classId: assignedClass.id, code: codeStr }
    });
  }

  // Ensure an assessment exists and is assigned to this class with available questions
  const { assessment: availableAssessment, questions: availableQuestions } = ensureClassAssessment(
    db,
    course.id,
    assignedClass.id,
    course.name,
    user.id
  );

  const qCount = availableQuestions ? availableQuestions.length : 0;
  const enrollmentRecord = enrollmentId ? db.get('SELECT * FROM class_enrollments WHERE id = ?', [enrollmentId]) : null;

  return {
    success: true,
    course: {
      id: course.id,
      name: course.name,
      code: course.code,
      description: course.description,
      subject: course.subject,
      learning_track: course.learning_track
    },
    class: {
      id: assignedClass.id,
      name: assignedClass.name
    },
    enrollment: enrollmentRecord,
    assessment: availableAssessment ? {
      id: availableAssessment.id,
      name: availableAssessment.name,
      duration_minutes: availableAssessment.duration_minutes,
      pass_mark_percentage: availableAssessment.pass_mark_percentage,
      question_count: qCount
    } : null,
    question_count: qCount,
    questions: (availableQuestions || []).map(q => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      topic: q.topic || 'General',
      difficulty: q.difficulty || 'medium'
    })),
    message: qCount > 0 
      ? `Access granted to ${course.name}! ${qCount} question(s) are ready for you to practice.` 
      : `Access granted to ${course.name} (${assignedClass.name}).`
  };
}

function ensureClassAssessment(db, courseId, classId, courseName, adminUserId = 'usr_admin_001') {
  // 1. Check if this class already has an assigned published assessment
  let assignedAssessment = classId ? db.get(
    `SELECT a.* FROM assessments a
     JOIN assessment_classes ac ON ac.assessment_id = a.id
     WHERE ac.class_id = ? AND a.status = 'published'`,
    [classId]
  ) : null;

  // 2. If not, check if any published assessment exists for this course
  if (!assignedAssessment && courseId) {
    assignedAssessment = db.get(
      `SELECT * FROM assessments WHERE course_id = ? AND status = 'published' ORDER BY created_at ASC LIMIT 1`,
      [courseId]
    );

    if (assignedAssessment && classId) {
      // Assign it to this class
      const exists = db.get(
        'SELECT * FROM assessment_classes WHERE assessment_id = ? AND class_id = ?',
        [assignedAssessment.id, classId]
      );
      if (!exists) {
        db.run('INSERT INTO assessment_classes (assessment_id, class_id) VALUES (?, ?)', [assignedAssessment.id, classId]);
      }
    }
  }

  // 3. Find questions for this assessment or course
  let questions = [];
  if (assignedAssessment) {
    questions = db.all(
      `SELECT q.id, q.question_text, q.question_type, q.topic, q.difficulty, q.points 
       FROM assessment_questions aq
       JOIN questions q ON q.id = aq.question_id
       WHERE aq.assessment_id = ?
       ORDER BY aq.order_index ASC`,
      [assignedAssessment.id]
    );
  }

  if (questions.length === 0 && courseId) {
    questions = db.all(
      `SELECT id, question_text, question_type, topic, difficulty, points 
       FROM questions 
       WHERE course_id = ? AND status = 'published'
       ORDER BY created_at ASC`,
      [courseId]
    );
  }

  if (questions.length === 0) {
    // Check for general published questions in question bank
    questions = db.all(
      `SELECT id, question_text, question_type, topic, difficulty, points 
       FROM questions 
       WHERE status = 'published'
       ORDER BY created_at ASC LIMIT 50`
    );
  }

  if (questions.length === 0 && !assignedAssessment) {
    return { assessment: null, questions: [] };
  }

  // 4. If still no assessment exists, auto-create one
  if (!assignedAssessment) {
    const assessId = generateId();
    db.run(
      `INSERT INTO assessments (id, course_id, name, description, duration_minutes, pass_mark_percentage, max_attempts, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 60, 70, 0, 'published', ?, datetime('now'), datetime('now'))`,
      [
        assessId,
        courseId,
        `${courseName || 'Certification Track'} - Exam Practice & Preparation`,
        `Practice and certification assessment covering available questions for ${courseName || 'this course'}.`,
        adminUserId
      ]
    );

    // Link to class
    if (classId) {
      db.run('INSERT INTO assessment_classes (assessment_id, class_id) VALUES (?, ?)', [assessId, classId]);
    }

    // Link all questions to the assessment
    questions.forEach((q, idx) => {
      const aqId = generateId();
      db.run(
        `INSERT INTO assessment_questions (id, assessment_id, question_id, order_index, points_override)
         VALUES (?, ?, ?, ?, ?)`,
        [aqId, assessId, q.id, idx + 1, q.points || 1]
      );
    });

    assignedAssessment = db.get('SELECT * FROM assessments WHERE id = ?', [assessId]);
  } else if (questions.length > 0) {
    // Ensure questions are in this assessment
    questions.forEach((q, idx) => {
      const hasQ = db.get(
        'SELECT id FROM assessment_questions WHERE assessment_id = ? AND question_id = ?',
        [assignedAssessment.id, q.id]
      );
      if (!hasQ) {
        const aqId = generateId();
        db.run(
          `INSERT INTO assessment_questions (id, assessment_id, question_id, order_index, points_override)
           VALUES (?, ?, ?, ?, ?)`,
          [aqId, assignedAssessment.id, q.id, idx + 1, q.points || 1]
        );
      }
    });
  }

  return {
    assessment: assignedAssessment,
    questions
  };
}

module.exports = {
  createCode,
  getCodeById,
  listCodesForCourse,
  listCodesForClass,
  replaceCode,
  setCodeStatus,
  updateCode,
  redeemCourseCode,
  ensureClassAssessment
};
