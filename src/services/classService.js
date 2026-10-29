const { getDatabase } = require('../db');
const { generateId, generateRandomCode } = require('../utils/crypto');
const { logAction } = require('./auditService');
const { createCode } = require('./accessCodeService');

function createClass({
  courseId,
  name,
  description = '',
  facilitator_name = '',
  instructor_id = null,
  start_date = null,
  end_date = null,
  access_duration_days = null,
  access_code = null,
  max_uses = null,
  maxUses = null,
  status = 'active',
  adminUserId = null,
  adminUsername = 'admin'
}) {
  const db = getDatabase();
  const trimmedName = (name || '').trim();

  if (!courseId) throw new Error('Associated Course ID is required.');
  if (!trimmedName) throw new Error('Class name is required.');

  const course = db.get('SELECT id, code FROM courses WHERE id = ?', [courseId]);
  if (!course) throw new Error('Course not found.');

  let finalFacilitator = facilitator_name || '';
  if (instructor_id) {
    const inst = db.get('SELECT first_name, surname FROM users WHERE id = ?', [instructor_id]);
    if (inst && !finalFacilitator) {
      finalFacilitator = `${inst.first_name} ${inst.surname}`;
    }
  }

  const rawMax = max_uses !== undefined && max_uses !== null ? max_uses : maxUses;
  const parsedMaxUses = (rawMax !== undefined && rawMax !== null && rawMax !== '') ? parseInt(rawMax, 10) : null;
  if (parsedMaxUses !== null && (isNaN(parsedMaxUses) || parsedMaxUses < 1)) {
    throw new Error('Maximum uses must be a positive number greater than 0.');
  }

  const classId = generateId();
  db.run(
    `INSERT INTO classes (id, course_id, name, description, facilitator_name, instructor_id, start_date, end_date, access_duration_days, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [classId, courseId, trimmedName, description, finalFacilitator, instructor_id || null, start_date, end_date, access_duration_days, status]
  );

  // Assign or generate active access code for this class
  const requestedCode = access_code ? access_code.trim().toUpperCase() : null;
  if (requestedCode) {
    // Check if an unassigned course code matches requestedCode
    const existingCode = db.get(
      'SELECT * FROM course_access_codes WHERE UPPER(code) = ? AND course_id = ? AND class_id IS NULL',
      [requestedCode, courseId]
    );
    if (existingCode) {
      db.run('UPDATE course_access_codes SET class_id = ?, is_active = 1, max_uses = ? WHERE id = ?', [
        classId,
        parsedMaxUses !== null ? parsedMaxUses : existingCode.max_uses,
        existingCode.id
      ]);
    } else {
      createCode({
        courseId,
        classId,
        code: requestedCode,
        expiresAt: end_date,
        maxUses: parsedMaxUses,
        adminUserId,
        adminUsername
      });
    }
  } else {
    // Check if there is an unassigned active code on the course to claim for its first class
    const unassignedCode = db.get(
      'SELECT * FROM course_access_codes WHERE course_id = ? AND class_id IS NULL AND is_active = 1 ORDER BY created_at ASC LIMIT 1',
      [courseId]
    );
    if (unassignedCode) {
      if (parsedMaxUses !== null) {
        db.run('UPDATE course_access_codes SET class_id = ?, max_uses = ? WHERE id = ?', [classId, parsedMaxUses, unassignedCode.id]);
      } else {
        db.run('UPDATE course_access_codes SET class_id = ? WHERE id = ?', [classId, unassignedCode.id]);
      }
    } else {
      const autoCode = generateRandomCode(course.code || 'CLS', 4);
      createCode({
        courseId,
        classId,
        code: autoCode,
        expiresAt: end_date,
        maxUses: parsedMaxUses,
        adminUserId,
        adminUsername
      });
    }
  }

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'CREATE_CLASS',
    entityType: 'classes',
    entityId: classId,
    details: { courseId, name: trimmedName, instructor_id, facilitator_name: finalFacilitator, status, max_uses: parsedMaxUses }
  });

  return getClass(classId);
}

function getClass(classId) {
  const db = getDatabase();
  const cls = db.get(
    `SELECT cl.*, c.name as course_name, c.code as course_code, c.status as course_status,
            u_inst.first_name as instructor_first_name, u_inst.surname as instructor_surname,
            u_inst.email as instructor_email, u_inst.username as instructor_username
     FROM classes cl
     LEFT JOIN courses c ON c.id = cl.course_id
     LEFT JOIN users u_inst ON u_inst.id = cl.instructor_id
     WHERE cl.id = ?`,
    [classId]
  );

  if (!cls) return null;

  if (cls.instructor_first_name && cls.instructor_surname) {
    cls.instructor_name = `${cls.instructor_first_name} ${cls.instructor_surname}`;
  } else {
    cls.instructor_name = cls.facilitator_name || null;
  }

  // Active access code for this class (with fallback to unassigned course code)
  const activeCode = db.get(
    `SELECT * FROM course_access_codes
     WHERE (class_id = ? OR (course_id = ? AND class_id IS NULL)) AND is_active = 1
     ORDER BY CASE WHEN class_id = ? THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
    [classId, cls.course_id, classId]
  );

  // Enrolled students
  const students = db.all(
    `SELECT u.id, u.username, u.email, u.first_name, u.surname, u.student_number, u.account_status,
            ce.id as enrollment_id, ce.enrolled_at, ce.access_starts_at, ce.access_expires_at, ce.status as enrollment_status,
            (SELECT COUNT(*) FROM student_attempts sa WHERE sa.user_id = u.id AND sa.class_id = cl.id) as attempt_count
     FROM class_enrollments ce
     LEFT JOIN users u ON u.id = ce.user_id
     JOIN classes cl ON cl.id = ce.class_id
     WHERE ce.class_id = ?
     ORDER BY u.surname, u.first_name`,
    [classId]
  );

  // Assigned assessments
  let assessments = db.all(
    `SELECT a.id, a.name, a.duration_minutes, a.pass_mark_percentage, a.status, a.available_from, a.available_to,
            ac.id as assignment_id,
            (
              (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id AND aq.question_id IS NOT NULL) +
              COALESCE((SELECT SUM(COALESCE(qp.random_count, 5)) FROM assessment_questions aq JOIN question_pools qp ON qp.id = aq.pool_id WHERE aq.assessment_id = a.id), 0)
            ) as question_count
     FROM assessment_classes ac
     JOIN assessments a ON a.id = ac.assessment_id
     WHERE ac.class_id = ?
     ORDER BY a.created_at DESC`,
    [classId]
  );

  // Fallback to published assessments for this course if none explicitly linked via assessment_classes
  if (assessments.length === 0 && cls.course_id) {
    assessments = db.all(
      `SELECT a.id, a.name, a.duration_minutes, a.pass_mark_percentage, a.status, a.available_from, a.available_to,
              NULL as assignment_id,
              (
                (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id AND aq.question_id IS NOT NULL) +
                COALESCE((SELECT SUM(COALESCE(qp.random_count, 5)) FROM assessment_questions aq JOIN question_pools qp ON qp.id = aq.pool_id WHERE aq.assessment_id = a.id), 0)
              ) as question_count
       FROM assessments a
       WHERE a.course_id = ? AND a.status = 'published'
       ORDER BY a.created_at DESC`,
      [cls.course_id]
    );
  }

  return {
    ...cls,
    active_code: activeCode?.code || null,
    code_max_uses: activeCode?.max_uses ?? null,
    code_used_count: activeCode?.used_count ?? 0,
    active_code_details: activeCode || null,
    students,
    assessments
  };
}

function listClasses(courseId = null) {
  const db = getDatabase();
  let sql = `
    SELECT cl.*, c.name as course_name, c.code as course_code,
           u_inst.first_name as instructor_first_name, u_inst.surname as instructor_surname,
           u_inst.email as instructor_email,
           (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = cl.id AND ce.status = 'active') as student_count,
           (SELECT COUNT(*) FROM assessment_classes ac WHERE ac.class_id = cl.id) as assessment_count,
           COALESCE(
             (SELECT cac.code FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
             (SELECT cac.code FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1)
           ) as active_code,
           COALESCE(
             (SELECT cac.max_uses FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
             (SELECT cac.max_uses FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1)
           ) as code_max_uses,
           COALESCE(
             (SELECT cac.used_count FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
             (SELECT cac.used_count FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
             0
           ) as code_used_count
    FROM classes cl
    LEFT JOIN courses c ON c.id = cl.course_id
    LEFT JOIN users u_inst ON u_inst.id = cl.instructor_id
    WHERE 1=1
  `;
  const params = [];

  if (courseId) {
    sql += ' AND cl.course_id = ?';
    params.push(courseId);
  }

  sql += ' ORDER BY cl.created_at DESC';
  const classes = db.all(sql, params);
  return classes.map(c => ({
    ...c,
    instructor_name: (c.instructor_first_name && c.instructor_surname) 
      ? `${c.instructor_first_name} ${c.instructor_surname}` 
      : (c.facilitator_name || null)
  }));
}

function updateClass(classId, data, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const existing = getClass(classId);
  if (!existing) throw new Error('Class not found.');

  const { name, description, facilitator_name, instructor_id, start_date, end_date, access_duration_days, access_code, max_uses, maxUses, status } = data;

  let finalFacilitator = facilitator_name !== undefined ? facilitator_name : existing.facilitator_name;
  let finalInstructorId = instructor_id !== undefined ? (instructor_id || null) : existing.instructor_id;

  if (finalInstructorId && !finalFacilitator) {
    const inst = db.get('SELECT first_name, surname FROM users WHERE id = ?', [finalInstructorId]);
    if (inst) finalFacilitator = `${inst.first_name} ${inst.surname}`;
  }

  db.run(
    `UPDATE classes
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         facilitator_name = ?,
         instructor_id = ?,
         start_date = ?,
         end_date = ?,
         access_duration_days = ?,
         status = COALESCE(?, status),
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      name ? name.trim() : null,
      description !== undefined ? description : null,
      finalFacilitator,
      finalInstructorId,
      start_date !== undefined ? start_date : existing.start_date,
      end_date !== undefined ? end_date : existing.end_date,
      access_duration_days !== undefined ? access_duration_days : existing.access_duration_days,
      status || null,
      classId
    ]
  );

  const rawMax = max_uses !== undefined ? max_uses : maxUses;
  const parsedMaxUses = (rawMax !== undefined && rawMax !== null && rawMax !== '')
    ? parseInt(rawMax, 10)
    : (rawMax === null || rawMax === '' ? null : undefined);

  if (parsedMaxUses !== undefined && parsedMaxUses !== null && (isNaN(parsedMaxUses) || parsedMaxUses < 1)) {
    throw new Error('Maximum uses must be a positive number greater than 0.');
  }

  if (access_code !== undefined && access_code !== null) {
    const trimmedCode = access_code.trim().toUpperCase();
    if (trimmedCode && trimmedCode !== (existing.active_code || '').toUpperCase()) {
      // Deactivate previous active codes for this class
      db.run('UPDATE course_access_codes SET is_active = 0 WHERE class_id = ?', [classId]);
      // Check if this code already exists for this class or course
      const existingCodeRow = db.get('SELECT * FROM course_access_codes WHERE UPPER(code) = ?', [trimmedCode]);
      if (existingCodeRow) {
        if (existingCodeRow.is_active && existingCodeRow.class_id && existingCodeRow.class_id !== classId) {
          throw new Error(`An active access code '${trimmedCode}' is already assigned to another class.`);
        }
        db.run('UPDATE course_access_codes SET class_id = ?, course_id = ?, is_active = 1, max_uses = ? WHERE id = ?', [
          classId,
          existing.course_id,
          parsedMaxUses !== undefined ? parsedMaxUses : existingCodeRow.max_uses,
          existingCodeRow.id
        ]);
      } else {
        createCode({
          courseId: existing.course_id,
          classId,
          code: trimmedCode,
          expiresAt: end_date !== undefined ? end_date : existing.end_date,
          maxUses: parsedMaxUses !== undefined ? parsedMaxUses : null,
          adminUserId,
          adminUsername
        });
      }
    } else if (parsedMaxUses !== undefined && existing.active_code_details) {
      // Code string didn't change, but max_uses may have been updated
      db.run('UPDATE course_access_codes SET max_uses = ? WHERE id = ?', [
        parsedMaxUses,
        existing.active_code_details.id
      ]);
    }
  } else if (parsedMaxUses !== undefined && existing.active_code_details) {
    // Only max_uses was updated
    db.run('UPDATE course_access_codes SET max_uses = ? WHERE id = ?', [
      parsedMaxUses,
      existing.active_code_details.id
    ]);
  }

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'UPDATE_CLASS',
    entityType: 'classes',
    entityId: classId,
    details: { changes: data }
  });

  return getClass(classId);
}

function listClassesForInstructor(instructorId) {
  const db = getDatabase();
  const sql = `
    SELECT cl.*, c.name as course_name, c.code as course_code,
           (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = cl.id AND ce.status = 'active') as student_count,
           (SELECT COUNT(*) FROM assessment_classes ac WHERE ac.class_id = cl.id) as assessment_count,
           COALESCE(
             (SELECT cac.code FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
             (SELECT cac.code FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1)
           ) as active_code,
           COALESCE(
             (SELECT cac.max_uses FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
             (SELECT cac.max_uses FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1)
           ) as code_max_uses,
           COALESCE(
             (SELECT cac.used_count FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
             (SELECT cac.used_count FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
             0
           ) as code_used_count
    FROM classes cl
    LEFT JOIN courses c ON c.id = cl.course_id
    WHERE cl.instructor_id = ?
    ORDER BY cl.created_at DESC
  `;
  return db.all(sql, [instructorId]);
}

function duplicateClass(classId, newName, copyAssessments = true, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const source = getClass(classId);
  if (!source) throw new Error('Source class not found.');

  const duplicatedName = (newName || `${source.name} (Copy)`).trim();
  const newClass = createClass({
    courseId: source.course_id,
    name: duplicatedName,
    description: source.description,
    facilitator_name: source.facilitator_name,
    instructor_id: source.instructor_id,
    start_date: source.start_date,
    end_date: source.end_date,
    access_duration_days: source.access_duration_days,
    status: 'active',
    adminUserId,
    adminUsername
  });

  if (copyAssessments && source.assessments?.length) {
    for (const a of source.assessments) {
      assignAssessmentToClass(a.id, newClass.id, adminUserId, adminUsername);
    }
  }

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'DUPLICATE_CLASS',
    entityType: 'classes',
    entityId: newClass.id,
    details: { sourceClassId: classId, newClassId: newClass.id, copyAssessments }
  });

  return getClass(newClass.id);
}

function archiveClass(classId, adminUserId = null, adminUsername = 'admin') {
  return updateClass(classId, { status: 'archived' }, adminUserId, adminUsername);
}

function reactivateClass(classId, adminUserId = null, adminUsername = 'admin') {
  return updateClass(classId, { status: 'active' }, adminUserId, adminUsername);
}

function enrollStudent(classId, userId, { accessStartsAt = null, accessExpiresAt = null } = {}, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const user = db.get('SELECT id, username FROM users WHERE id = ?', [userId]);
  if (!user) throw new Error('Student user not found.');

  const cls = db.get('SELECT id, name FROM classes WHERE id = ?', [classId]);
  if (!cls) throw new Error('Class not found.');

  const existing = db.get('SELECT id, status FROM class_enrollments WHERE class_id = ? AND user_id = ?', [classId, userId]);

  if (existing) {
    db.run(
      `UPDATE class_enrollments 
       SET status = 'active', access_starts_at = COALESCE(?, access_starts_at), access_expires_at = COALESCE(?, access_expires_at)
       WHERE id = ?`,
      [accessStartsAt, accessExpiresAt, existing.id]
    );
    return { id: existing.id, updated: true };
  }

  const enrollmentId = generateId();
  db.run(
    `INSERT INTO class_enrollments (id, class_id, user_id, enrolled_at, access_starts_at, access_expires_at, status)
     VALUES (?, ?, ?, datetime('now'), COALESCE(?, datetime('now')), ?, 'active')`,
    [enrollmentId, classId, userId, accessStartsAt, accessExpiresAt]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'ENROLL_STUDENT_IN_CLASS',
    entityType: 'class_enrollments',
    entityId: enrollmentId,
    details: { classId, className: cls.name, studentId: userId, studentUsername: user.username }
  });

  return { id: enrollmentId, created: true };
}

function removeStudent(classId, userId, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  // Removing student must not delete account or historical attempts!
  db.run('DELETE FROM class_enrollments WHERE class_id = ? AND user_id = ?', [classId, userId]);

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'REMOVE_STUDENT_FROM_CLASS',
    entityType: 'class_enrollments',
    entityId: `${classId}_${userId}`,
    details: { classId, studentId: userId }
  });

  return { success: true };
}

function moveStudent(fromClassId, toClassId, userId, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  if (fromClassId === toClassId) {
    throw new Error('Source and destination classes are identical.');
  }

  enrollStudent(toClassId, userId, {}, adminUserId, adminUsername);
  removeStudent(fromClassId, userId, adminUserId, adminUsername);

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'MOVE_STUDENT_CLASS',
    entityType: 'class_enrollments',
    entityId: `${toClassId}_${userId}`,
    details: { fromClassId, toClassId, studentId: userId }
  });

  return { success: true };
}

function copyStudent(toClassId, userId, adminUserId = null, adminUsername = 'admin') {
  return enrollStudent(toClassId, userId, {}, adminUserId, adminUsername);
}

function assignAssessmentToClass(assessmentId, classId, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const existing = db.get('SELECT id FROM assessment_classes WHERE assessment_id = ? AND class_id = ?', [assessmentId, classId]);
  if (existing) return { id: existing.id, assigned: true };

  const id = generateId();
  db.run('INSERT INTO assessment_classes (id, assessment_id, class_id) VALUES (?, ?, ?)', [id, assessmentId, classId]);

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'ASSIGN_ASSESSMENT_TO_CLASS',
    entityType: 'assessment_classes',
    entityId: id,
    details: { assessmentId, classId }
  });

  return { id, assigned: true };
}

function removeAssessmentFromClass(assessmentId, classId, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  db.run('DELETE FROM assessment_classes WHERE assessment_id = ? AND class_id = ?', [assessmentId, classId]);

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'REMOVE_ASSESSMENT_FROM_CLASS',
    entityType: 'assessment_classes',
    entityId: `${assessmentId}_${classId}`,
    details: { assessmentId, classId }
  });

  return { success: true };
}

function deleteClass(classId, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const existing = getClass(classId);
  if (!existing) {
    throw new Error('Class not found.');
  }

  return db.transaction(() => {
    // 1. Delete attempt answers and student attempts for this class
    db.run(
      `DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM student_attempts WHERE class_id = ?)`,
      [classId]
    );
    db.run(`DELETE FROM student_attempts WHERE class_id = ?`, [classId]);

    // 2. Delete student enrollments in this class
    db.run(`DELETE FROM class_enrollments WHERE class_id = ?`, [classId]);

    // 3. Delete assessment assignments for this class
    db.run(`DELETE FROM assessment_classes WHERE class_id = ?`, [classId]);

    // 4. Delete access codes assigned to this class
    db.run(`DELETE FROM course_access_codes WHERE class_id = ?`, [classId]);

    // 5. Delete the class itself
    db.run(`DELETE FROM classes WHERE id = ?`, [classId]);

    logAction({
      userId: adminUserId,
      username: adminUsername,
      action: 'DELETE_CLASS',
      entityType: 'classes',
      entityId: classId,
      details: { name: existing.name, courseId: existing.course_id, instructorId: existing.instructor_id }
    });

    return { success: true, deletedId: classId, name: existing.name };
  });
}

module.exports = {
  createClass,
  getClass,
  listClasses,
  listClassesForInstructor,
  updateClass,
  duplicateClass,
  archiveClass,
  reactivateClass,
  deleteClass,
  enrollStudent,
  removeStudent,
  moveStudent,
  copyStudent,
  assignAssessmentToClass,
  removeAssessmentFromClass
};
