const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { initDatabase, setDatabaseInstance } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const authService = require('../src/services/authService');
const studentService = require('../src/services/studentService');
const courseService = require('../src/services/courseService');
const classService = require('../src/services/classService');
const assessmentService = require('../src/services/assessmentService');
const attemptService = require('../src/services/attemptService');
const accessCodeService = require('../src/services/accessCodeService');

describe('Security & Privacy Enforcement Tests', () => {
  beforeEach(() => {
    const db = initDatabase(':memory:');
    setDatabaseInstance(db);
    seedDatabase(':memory:');
  });

  test('Course code ALONE cannot bypass authentication (Rule 1)', () => {
    // Attempting to redeem without a valid authenticated user ID throws error
    assert.throws(
      () => accessCodeService.redeemCourseCode({
        userId: null,
        rawCode: 'AZ104-CENTURION-01'
      }),
      /User account not found/
    );
  });

  test('Student cannot view another student’s attempt (Section 31 Rule)', () => {
    const alex = studentService.listStudents({ query: 'alex.morgan' })[0];
    const sarah = studentService.listStudents({ query: 'sarah.chen' })[0];
    const az104 = courseService.listCourses().find(c => c.code === 'AZ104');
    const classA = classService.listClasses(az104.id)[0];
    const assessment = assessmentService.listAssessments()[0];

    // Alex starts attempt
    const alexAttempt = attemptService.startAttempt({
      userId: alex.id,
      assessmentId: assessment.id,
      classId: classA.id
    });

    // Sarah tries to view Alex's attempt -> MUST BE DENIED!
    assert.throws(
      () => attemptService.getAttemptState(alexAttempt.id, sarah.id),
      /Access denied/
    );

    // Admin can view Alex's attempt
    const admin = authService.login({ username: 'admin', password: 'Admin2026!' });
    const adminView = attemptService.getAttemptState(alexAttempt.id, admin.user.id);
    assert.ok(adminView, 'Admin should have oversight access');
  });

  test('Server-side deadline is authoritative: timer tampering cannot extend attempt deadline', () => {
    const alex = studentService.listStudents({ query: 'alex.morgan' })[0];
    const az104 = courseService.listCourses().find(c => c.code === 'AZ104');
    const classA = classService.listClasses(az104.id)[0];
    const assessment = assessmentService.listAssessments()[0];

    // Start attempt
    const attempt = attemptService.startAttempt({
      userId: alex.id,
      assessmentId: assessment.id,
      classId: classA.id
    });

    // Manually simulate expired server deadline in database (time travel)
    const { getDatabase } = require('../src/db');
    getDatabase().run(
      "UPDATE student_attempts SET deadline_at = datetime('now', '-1 minute') WHERE id = ?",
      [attempt.id]
    );

    // Any subsequent autosave after server deadline automatically submits and rejects editing!
    assert.throws(
      () => attemptService.autosaveAnswer({
        attemptId: attempt.id,
        userId: alex.id,
        questionId: attempt.questions[0].id,
        savedAnswer: 'Yes'
      }),
      /Assessment timer has expired/
    );

    // Verify attempt is now submitted
    const updatedAttempt = attemptService.getAttemptState(attempt.id, alex.id);
    assert.notStrictEqual(updatedAttempt.status, 'in_progress', 'Attempt must be auto-submitted');
  });

  test('Suspending or deactivating a student account immediately invalidates their active session', () => {
    const sarah = authService.login({ username: 'sarah.chen', password: 'Eduque2026!' });
    assert.ok(authService.validateSession(sarah.token), 'Session should be valid initially');

    // Admin suspends Sarah
    studentService.setStudentStatus(sarah.user.id, 'suspended');

    // Session validation must immediately return null and terminate session
    const validated = authService.validateSession(sarah.token);
    assert.strictEqual(validated, null, 'Suspended user session must be revoked');
  });
});
