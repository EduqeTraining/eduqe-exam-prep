const { getDatabase } = require('../db');
const { logAction } = require('./auditService');

function parseUtcDate(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  const s = String(str).trim();
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date(s.replace(' ', 'T') + 'Z');
}

/**
 * RULE: Expired Certification Access Data Purge
 * When a user is enrolled in a certification course/class and access expires,
 * the questions and previous assessment results must be permanently deleted.
 */
function checkAndPurgeExpiredEnrollments({ userId = null, adminUserId = null, adminUsername = 'system' } = {}) {
  const db = getDatabase();
  const now = new Date();

  // Query candidate enrollments
  let sql = `
    SELECT ce.id as enrollment_id, ce.user_id, ce.class_id, ce.access_starts_at, ce.access_expires_at, ce.status as enrollment_status,
           cl.name as class_name, cl.end_date as class_end_date,
           c.id as course_id, c.name as course_name, c.end_date as course_end_date, c.status as course_status,
           u.username
    FROM class_enrollments ce
    JOIN classes cl ON cl.id = ce.class_id
    JOIN courses c ON c.id = cl.course_id
    JOIN users u ON u.id = ce.user_id
    WHERE 1=1
  `;
  const params = [];
  if (userId) {
    sql += ' AND ce.user_id = ?';
    params.push(userId);
  }

  const enrollments = db.all(sql, params);
  const purgedResults = [];

  for (const enroll of enrollments) {
    let isExpired = false;
    let reason = '';

    // 1. Explicitly marked expired
    if (enroll.enrollment_status === 'expired') {
      isExpired = true;
      reason = 'Enrollment status marked as expired';
    }

    // 2. Access expiry timestamp has passed
    if (!isExpired && enroll.access_expires_at) {
      const exp = parseUtcDate(enroll.access_expires_at);
      if (exp && now.getTime() > exp.getTime()) {
        isExpired = true;
        reason = `Certification access period expired on ${enroll.access_expires_at}`;
      }
    }

    // 3. Class end date has passed
    if (!isExpired && enroll.class_end_date) {
      const classExp = parseUtcDate(enroll.class_end_date);
      if (classExp && now.getTime() > classExp.getTime()) {
        isExpired = true;
        reason = `Class training period ended on ${enroll.class_end_date}`;
      }
    }

    // 4. Course end date has passed or course is closed/archived
    if (!isExpired && enroll.course_end_date) {
      const courseExp = parseUtcDate(enroll.course_end_date);
      if (courseExp && now.getTime() > courseExp.getTime()) {
        isExpired = true;
        reason = `Course period ended on ${enroll.course_end_date}`;
      }
    }
    if (!isExpired && (enroll.course_status === 'closed' || enroll.course_status === 'archived')) {
      isExpired = true;
      reason = `Certification course has been closed/archived (${enroll.course_status})`;
    }

    if (isExpired) {
      // Find all student attempts for assessments belonging to this course/class
      const attempts = db.all(
        `SELECT sa.id 
         FROM student_attempts sa
         JOIN assessments a ON a.id = sa.assessment_id
         WHERE sa.user_id = ? AND (sa.class_id = ? OR a.course_id = ?)`,
        [enroll.user_id, enroll.class_id, enroll.course_id]
      );

      const attemptIds = attempts.map(a => a.id);

      if (attemptIds.length > 0) {
        // Rule: Delete attempt answers and previous results
        const placeholders = attemptIds.map(() => '?').join(',');
        db.run(`DELETE FROM attempt_answers WHERE attempt_id IN (${placeholders})`, attemptIds);
        db.run(`DELETE FROM student_attempts WHERE id IN (${placeholders})`, attemptIds);
      }

      // Mark enrollment as expired if not already
      if (enroll.enrollment_status !== 'expired') {
        db.run("UPDATE class_enrollments SET status = 'expired' WHERE id = ?", [enroll.enrollment_id]);
      }

      // Audit log the rule enforcement
      logAction({
        userId: adminUserId || enroll.user_id,
        username: adminUsername || enroll.username,
        action: 'RULE_PURGE_EXPIRED_ENROLLMENT_DATA',
        entityType: 'class_enrollments',
        entityId: enroll.enrollment_id,
        details: {
          rule: 'EXPIRED_CERTIFICATION_DATA_PURGE',
          userId: enroll.user_id,
          username: enroll.username,
          classId: enroll.class_id,
          className: enroll.class_name,
          courseId: enroll.course_id,
          courseName: enroll.course_name,
          reason,
          purgedAttemptsCount: attemptIds.length
        }
      });

      purgedResults.push({
        enrollment_id: enroll.enrollment_id,
        user_id: enroll.user_id,
        username: enroll.username,
        course_name: enroll.course_name,
        class_name: enroll.class_name,
        reason,
        deleted_attempts: attemptIds.length
      });
    }
  }

  return purgedResults;
}

/**
 * Manually expire an enrollment and immediately purge its questions and previous results
 */
function expireEnrollmentAndPurge(enrollmentId, adminUserId = null, adminUsername = 'admin', reason = 'Manual administrator expiration') {
  const db = getDatabase();
  const enroll = db.get(
    `SELECT ce.id as enrollment_id, ce.user_id, ce.class_id,
            cl.name as class_name, c.id as course_id, c.name as course_name, u.username
     FROM class_enrollments ce
     JOIN classes cl ON cl.id = ce.class_id
     JOIN courses c ON c.id = cl.course_id
     JOIN users u ON u.id = ce.user_id
     WHERE ce.id = ?`,
    [enrollmentId]
  );
  if (!enroll) throw new Error('Enrollment not found.');

  // Delete all student attempts and answers
  const attempts = db.all(
    `SELECT sa.id 
     FROM student_attempts sa
     JOIN assessments a ON a.id = sa.assessment_id
     WHERE sa.user_id = ? AND (sa.class_id = ? OR a.course_id = ?)`,
    [enroll.user_id, enroll.class_id, enroll.course_id]
  );
  const attemptIds = attempts.map(a => a.id);

  if (attemptIds.length > 0) {
    const placeholders = attemptIds.map(() => '?').join(',');
    db.run(`DELETE FROM attempt_answers WHERE attempt_id IN (${placeholders})`, attemptIds);
    db.run(`DELETE FROM student_attempts WHERE id IN (${placeholders})`, attemptIds);
  }

  // Update status to expired
  db.run("UPDATE class_enrollments SET status = 'expired' WHERE id = ?", [enrollmentId]);

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'RULE_PURGE_EXPIRED_ENROLLMENT_DATA',
    entityType: 'class_enrollments',
    entityId: enrollmentId,
    details: {
      rule: 'EXPIRED_CERTIFICATION_DATA_PURGE',
      userId: enroll.user_id,
      username: enroll.username,
      classId: enroll.class_id,
      className: enroll.class_name,
      courseId: enroll.course_id,
      courseName: enroll.course_name,
      reason,
      purgedAttemptsCount: attemptIds.length
    }
  });

  return {
    success: true,
    deleted_attempts: attemptIds.length,
    username: enroll.username,
    course_name: enroll.course_name
  };
}

module.exports = {
  checkAndPurgeExpiredEnrollments,
  expireEnrollmentAndPurge,
  parseUtcDate
};
