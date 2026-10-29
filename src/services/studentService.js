const { getDatabase } = require('../db');
const { hashPassword, generateTemporaryPassword, generateId } = require('../utils/crypto');
const { logAction } = require('./auditService');
const { enrollStudent } = require('./classService');
const expirationRuleService = require('./expirationRuleService');

function generateUsername(firstName, surname) {
  const cleanFirst = (firstName || 'student').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanSur = (surname || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = `${cleanFirst}.${cleanSur}`;
  const db = getDatabase();

  let candidate = base;
  let counter = 1;
  while (db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [candidate])) {
    candidate = `${base}${counter}`;
    counter++;
  }
  return candidate;
}

function createStudent({
  first_name,
  surname,
  username = null,
  email,
  student_number = null,
  temporary_password = null,
  account_status = 'active',
  must_change_password = true,
  class_ids = [],
  adminUserId = null,
  adminUsername = 'admin'
}) {
  const db = getDatabase();
  const fName = (first_name || '').trim();
  const sName = (surname || '').trim();
  const emailAddr = (email || '').trim().toLowerCase();

  if (!fName || !sName) throw new Error('First name and surname are required.');
  if (!emailAddr) throw new Error('Email address is required.');

  // Check unique email
  const existingEmail = db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [emailAddr]);
  if (existingEmail) throw new Error(`A user with email '${emailAddr}' already exists.`);

  const finalUsername = (username ? username.trim().toLowerCase() : generateUsername(fName, sName));
  const existingUsername = db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [finalUsername]);
  if (existingUsername) throw new Error(`Username '${finalUsername}' is already taken.`);

  const tempPassword = temporary_password || generateTemporaryPassword();
  const passwordHash = hashPassword(tempPassword);
  const userId = generateId();

  db.run(
    `INSERT INTO users (id, username, email, password_hash, role, first_name, surname, student_number, account_status, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'student', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [userId, finalUsername, emailAddr, passwordHash, fName, sName, student_number, account_status, must_change_password ? 1 : 0]
  );

  // Enroll in any specified classes
  if (Array.isArray(class_ids)) {
    for (const cId of class_ids) {
      if (cId) enrollStudent(cId, userId, {}, adminUserId, adminUsername);
    }
  }

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'CREATE_STUDENT',
    entityType: 'users',
    entityId: userId,
    details: { username: finalUsername, email: emailAddr, first_name: fName, surname: sName }
  });

  return {
    student: getStudent(userId),
    temporary_password: tempPassword
  };
}

function getStudent(userId) {
  const db = getDatabase();

  // Enforce rule: Purge questions and previous results for expired certification enrollments
  try {
    expirationRuleService.checkAndPurgeExpiredEnrollments({ userId });
  } catch (err) {
    // If table doesn't exist during initial migrations, continue gracefully
  }

  const user = db.get(
    `SELECT id, username, email, role, first_name, surname, student_number, account_status, must_change_password, created_at, updated_at
     FROM users WHERE id = ?`,
    [userId]
  );
  if (!user) return null;

  // Enrolled classes & courses
  const enrollments = db.all(
    `SELECT ce.id as enrollment_id, ce.enrolled_at, ce.access_starts_at, ce.access_expires_at, ce.status as enrollment_status,
            cl.id as class_id, cl.name as class_name,
            c.id as course_id, c.name as course_name, c.code as course_code
     FROM class_enrollments ce
     JOIN classes cl ON cl.id = ce.class_id
     JOIN courses c ON c.id = cl.course_id
     WHERE ce.user_id = ?
     ORDER BY ce.enrolled_at DESC`,
    [userId]
  );

  // Assessment attempts
  const attempts = db.all(
    `SELECT sa.id as attempt_id, sa.attempt_number, sa.started_at, sa.submitted_at, sa.status,
            sa.score, sa.max_score, sa.percentage, sa.is_passed,
            a.id as assessment_id, a.name as assessment_name, a.duration_minutes, a.pass_mark_percentage,
            c.name as course_name, c.id as course_id,
            cl.name as class_name, cl.id as class_id,
            (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.attempt_id = sa.id AND aa.saved_answer IS NOT NULL) as questions_answered,
            (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.attempt_id = sa.id) as total_questions
     FROM student_attempts sa
     JOIN assessments a ON a.id = sa.assessment_id
     JOIN courses c ON c.id = a.course_id
     LEFT JOIN classes cl ON cl.id = sa.class_id
     WHERE sa.user_id = ?
     ORDER BY sa.started_at DESC`,
    [userId]
  );

  const enrichedAttempts = (attempts || []).map(att => {
    let timeSpent = 0;
    if (att.submitted_at && att.started_at) {
      const startMs = new Date(att.started_at.endsWith('Z') ? att.started_at : att.started_at.replace(' ', 'T') + 'Z').getTime();
      const endMs = new Date(att.submitted_at.endsWith('Z') ? att.submitted_at : att.submitted_at.replace(' ', 'T') + 'Z').getTime();
      timeSpent = Math.max(0, Math.round((endMs - startMs) / 1000));
    }
    return {
      ...att,
      time_spent_seconds: timeSpent
    };
  });

  return {
    ...user,
    must_change_password: Boolean(user.must_change_password),
    enrollments,
    attempts: enrichedAttempts
  };
}

function listStudents({ query = '', account_status = '', class_id = '', course_id = '' } = {}) {
  const db = getDatabase();
  let sql = `
    SELECT u.id, u.username, u.email, u.role, u.first_name, u.surname, u.student_number, 
           u.account_status, u.must_change_password, u.created_at,
           (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.user_id = u.id AND ce.status = 'active') as class_count,
           (SELECT COUNT(*) FROM student_attempts sa WHERE sa.user_id = u.id) as attempt_count
    FROM users u
    WHERE u.role = 'student'
  `;
  const params = [];

  if (query) {
    sql += " AND (LOWER(u.username) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.first_name) LIKE ? OR LOWER(u.surname) LIKE ? OR LOWER(COALESCE(u.student_number, '')) LIKE ?)";
    const q = `%${query.toLowerCase()}%`;
    params.push(q, q, q, q, q);
  }
  if (account_status) {
    sql += ' AND u.account_status = ?';
    params.push(account_status);
  }
  if (class_id) {
    sql += ' AND EXISTS (SELECT 1 FROM class_enrollments ce WHERE ce.user_id = u.id AND ce.class_id = ?)';
    params.push(class_id);
  }
  if (course_id) {
    sql += ' AND EXISTS (SELECT 1 FROM class_enrollments ce JOIN classes cl ON cl.id = ce.class_id WHERE ce.user_id = u.id AND cl.course_id = ?)';
    params.push(course_id);
  }

  sql += ' ORDER BY u.surname, u.first_name';
  return db.all(sql, params).map(u => ({ ...u, must_change_password: Boolean(u.must_change_password) }));
}

function updateStudent(userId, data, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const existing = getStudent(userId);
  if (!existing) throw new Error('Student not found.');

  const { first_name, surname, student_number, account_status, email } = data;

  if (email && email.toLowerCase() !== existing.email.toLowerCase()) {
    const check = db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?', [email.trim(), userId]);
    if (check) throw new Error(`Email '${email}' is already in use.`);
  }

  db.run(
    `UPDATE users
     SET first_name = COALESCE(?, first_name),
         surname = COALESCE(?, surname),
         student_number = COALESCE(?, student_number),
         account_status = COALESCE(?, account_status),
         email = COALESCE(?, email),
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      first_name ? first_name.trim() : null,
      surname ? surname.trim() : null,
      student_number !== undefined ? student_number : null,
      account_status || null,
      email ? email.trim().toLowerCase() : null,
      userId
    ]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'UPDATE_STUDENT',
    entityType: 'users',
    entityId: userId,
    details: { changes: data }
  });

  return getStudent(userId);
}

function resetStudentPassword(userId, newTempPassword = null, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const student = getStudent(userId);
  if (!student) throw new Error('Student not found.');

  const tempPassword = newTempPassword || generateTemporaryPassword();
  const newHash = hashPassword(tempPassword);

  db.run(
    `UPDATE users
     SET password_hash = ?, must_change_password = 1, updated_at = datetime('now')
     WHERE id = ?`,
    [newHash, userId]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'ADMIN_RESET_PASSWORD',
    entityType: 'users',
    entityId: userId,
    details: { username: student.username }
  });

  return {
    success: true,
    temporary_password: tempPassword
  };
}

function setStudentStatus(userId, status, adminUserId = null, adminUsername = 'admin') {
  const valid = ['active', 'suspended', 'deactivated'];
  if (!valid.includes(status)) throw new Error(`Invalid status: ${status}`);
  return updateStudent(userId, { account_status: status }, adminUserId, adminUsername);
}

function importStudents(rows, { defaultClassId = null, adminUserId = null, adminUsername = 'admin' } = {}) {
  const results = {
    total: rows.length,
    imported: [],
    errors: []
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const fName = row.first_name || row.FirstName || row['First Name'];
      const sName = row.surname || row.Surname || row.last_name || row['Last Name'];
      const email = row.email || row.Email;
      const studentNum = row.student_number || row.student_id || row['Student Number'];
      const classId = row.class_id || defaultClassId;

      if (!fName || !sName || !email) {
        throw new Error('Missing required fields: first_name, surname, or email');
      }

      const res = createStudent({
        first_name: fName,
        surname: sName,
        email,
        student_number: studentNum,
        class_ids: classId ? [classId] : [],
        adminUserId,
        adminUsername
      });

      results.imported.push({
        row: i + 1,
        username: res.student.username,
        email: res.student.email,
        temporary_password: res.temporary_password
      });
    } catch (err) {
      results.errors.push({
        row: i + 1,
        data: row,
        error: err.message
      });
    }
  }

  return results;
}

module.exports = {
  createStudent,
  getStudent,
  listStudents,
  updateStudent,
  resetStudentPassword,
  setStudentStatus,
  importStudents,
  checkAndPurgeExpiredEnrollments: expirationRuleService.checkAndPurgeExpiredEnrollments,
  expireEnrollmentAndPurge: expirationRuleService.expireEnrollmentAndPurge
};
