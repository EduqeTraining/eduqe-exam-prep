const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { initDatabase, setDatabaseInstance, getDatabase } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const courseService = require('../src/services/courseService');
const classService = require('../src/services/classService');
const studentService = require('../src/services/studentService');
const assessmentService = require('../src/services/assessmentService');
const attemptService = require('../src/services/attemptService');
const expirationRuleService = require('../src/services/expirationRuleService');
const auditService = require('../src/services/auditService');

describe('Rule: Expired Certification Access Data Purge', () => {
  beforeEach(() => {
    const db = initDatabase(':memory:');
    setDatabaseInstance(db);
    seedDatabase(':memory:');
  });

  test('When certification enrollment expires, questions and previous results are deleted', () => {
    const db = getDatabase();
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');
    const classA = classService.listClasses(az104.id)[0];
    const sarah = studentService.listStudents({ query: 'sarah.chen' })[0];
    const assessments = assessmentService.listAssessments({ courseId: az104.id });
    const assessment = assessments[0];

    // 1. Sarah takes the assessment and records a result
    const attempt = attemptService.startAttempt({
      userId: sarah.id,
      assessmentId: assessment.id,
      classId: classA.id
    });

    attemptService.autosaveAnswer({
      attemptId: attempt.id,
      userId: sarah.id,
      questionId: attempt.questions[0].id,
      savedAnswer: 'Yes'
    });

    const submitted = attemptService.submitAttempt({
      attemptId: attempt.id,
      userId: sarah.id
    });
    assert.strictEqual(submitted.status, 'marked');

    // Verify attempt and answers exist in database
    const initialAttempts = db.all('SELECT * FROM student_attempts WHERE user_id = ? AND assessment_id = ?', [sarah.id, assessment.id]);
    assert.ok(initialAttempts.length >= 1, 'Attempt record should exist before expiry');
    const initialAnswers = db.all('SELECT * FROM attempt_answers WHERE attempt_id = ?', [attempt.id]);
    assert.ok(initialAnswers.length > 0, 'Attempt answers should exist before expiry');

    // 2. Set enrollment access_expires_at to a date in the past (yesterday)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    db.run(
      'UPDATE class_enrollments SET access_expires_at = ? WHERE class_id = ? AND user_id = ?',
      [yesterday, classA.id, sarah.id]
    );

    // 3. Enforce the rule (automatically invoked when student checks dashboard or via rule service)
    const purged = expirationRuleService.checkAndPurgeExpiredEnrollments({ userId: sarah.id });
    assert.strictEqual(purged.length, 1, 'Should find and purge the expired enrollment');
    assert.ok(purged[0].deleted_attempts >= 1, 'Should report deleted attempts count');

    // 4. Verify previous results (student_attempts and attempt_answers) are completely deleted
    const attemptsAfter = db.all('SELECT * FROM student_attempts WHERE user_id = ? AND assessment_id = ?', [sarah.id, assessment.id]);
    assert.strictEqual(attemptsAfter.length, 0, 'All student attempts for expired certification must be deleted');

    const answersAfter = db.all('SELECT * FROM attempt_answers WHERE attempt_id = ?', [attempt.id]);
    assert.strictEqual(answersAfter.length, 0, 'All attempt answers for expired certification must be deleted');

    // 5. Verify enrollment status is now 'expired'
    const enrollment = db.get('SELECT * FROM class_enrollments WHERE class_id = ? AND user_id = ?', [classA.id, sarah.id]);
    assert.strictEqual(enrollment.status, 'expired');

    // 6. Verify studentService.getStudent reflects rule: 0 attempts and expired enrollment
    const studentData = studentService.getStudent(sarah.id);
    const courseAttempts = studentData.attempts.filter(att => att.course_id === az104.id);
    assert.strictEqual(courseAttempts.length, 0, 'Student profile must not return purged attempts');

    // 7. Verify student cannot start a new attempt on the expired course
    assert.throws(
      () => attemptService.startAttempt({
        userId: sarah.id,
        assessmentId: assessment.id,
        classId: classA.id
      }),
      /certification access period has expired/i
    );

    // 8. Verify audit log recorded the purge action
    const auditLogs = auditService.listLogs({ action: 'RULE_PURGE_EXPIRED_ENROLLMENT_DATA' });
    assert.ok(auditLogs.length >= 1, 'Audit log should record the purge rule execution');
    assert.strictEqual(auditLogs[0].details.rule, 'EXPIRED_CERTIFICATION_DATA_PURGE');
  });

  test('expireEnrollmentAndPurge manually expires enrollment and purges results', () => {
    const db = getDatabase();
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');
    const classA = classService.listClasses(az104.id)[0];
    const sarah = studentService.listStudents({ query: 'sarah.chen' })[0];
    const assessment = assessmentService.listAssessments({ courseId: az104.id })[0];

    // Complete an attempt
    const attempt = attemptService.startAttempt({
      userId: sarah.id,
      assessmentId: assessment.id,
      classId: classA.id
    });
    attemptService.submitAttempt({ attemptId: attempt.id, userId: sarah.id });

    const admin = db.get("SELECT id FROM users WHERE role = 'administrator'");
    const enroll = db.get('SELECT id FROM class_enrollments WHERE class_id = ? AND user_id = ?', [classA.id, sarah.id]);
    const res = expirationRuleService.expireEnrollmentAndPurge(enroll.id, admin.id, 'admin', 'Cohort ended');
    assert.strictEqual(res.success, true);
    assert.ok(res.deleted_attempts >= 1);

    // Verify attempts deleted
    const attempts = db.all('SELECT * FROM student_attempts WHERE user_id = ? AND assessment_id = ?', [sarah.id, assessment.id]);
    assert.strictEqual(attempts.length, 0);
  });
});
