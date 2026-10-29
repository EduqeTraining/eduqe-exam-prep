const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { initDatabase, setDatabaseInstance } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const courseService = require('../src/services/courseService');
const accessCodeService = require('../src/services/accessCodeService');
const studentService = require('../src/services/studentService');

describe('Course & Access Code Lifecycle Tests', () => {
  beforeEach(() => {
    const db = initDatabase(':memory:');
    setDatabaseInstance(db);
    seedDatabase(':memory:');
  });

  test('Create course with unique identifier and auto-generated access code', () => {
    const course = courseService.createCourse({
      name: 'AZ-204 Developing Solutions for Microsoft Azure',
      code: 'AZ204',
      subject: 'Cloud Development',
      status: 'published'
    });

    assert.ok(course.id);
    assert.strictEqual(course.code, 'AZ204');
    assert.strictEqual(course.status, 'published');
    assert.ok(course.active_code, 'Initial access code should be created');
  });

  test('Duplicate course code throws validation error', () => {
    assert.throws(
      () => courseService.createCourse({
        name: 'Another AZ-104 Course',
        code: 'AZ104' // Already seeded!
      }),
      /already exists/
    );
  });

  test('Valid access code redemption grants course and class access', () => {
    // Create new student
    const { student } = studentService.createStudent({
      first_name: 'Test',
      surname: 'Student',
      email: 'test.student@example.com'
    });

    // Redeem valid active code 'AZ104-CENTURION-01'
    const redemption = accessCodeService.redeemCourseCode({
      userId: student.id,
      rawCode: 'AZ104-CENTURION-01'
    });

    assert.strictEqual(redemption.success, true);
    assert.strictEqual(redemption.course.code, 'AZ104');
    assert.ok(redemption.class.id);

    // Verify enrollment recorded
    const updatedStudent = studentService.getStudent(student.id);
    assert.strictEqual(updatedStudent.enrollments.length, 1);
    assert.strictEqual(updatedStudent.enrollments[0].course_code, 'AZ104');
  });

  test('Invalid course code returns clear specific error', () => {
    const { student } = studentService.createStudent({
      first_name: 'Bob',
      surname: 'Builder',
      email: 'bob@example.com'
    });

    assert.throws(
      () => accessCodeService.redeemCourseCode({
        userId: student.id,
        rawCode: 'NON-EXISTENT-CODE-999'
      }),
      /Invalid course access code/
    );
  });

  test('Inactive code returns clear specific error', () => {
    const course = courseService.getCourse('AZ104');
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');

    const codeRecord = accessCodeService.createCode({
      courseId: az104.id,
      code: 'AZ104-INACTIVE-TEST'
    });

    // Deactivate it
    accessCodeService.setCodeStatus(codeRecord.id, false);

    const { student } = studentService.createStudent({
      first_name: 'Jane',
      surname: 'Doe',
      email: 'jane@example.com'
    });

    assert.throws(
      () => accessCodeService.redeemCourseCode({
        userId: student.id,
        rawCode: 'AZ104-INACTIVE-TEST'
      }),
      /This course access code is currently inactive/
    );
  });

  test('Expired course code returns clear error', () => {
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');

    const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
    accessCodeService.createCode({
      courseId: az104.id,
      code: 'AZ104-EXPIRED-CODE',
      expiresAt: pastDate
    });

    const { student } = studentService.createStudent({
      first_name: 'Eve',
      surname: 'Student',
      email: 'eve@example.com'
    });

    assert.throws(
      () => accessCodeService.redeemCourseCode({
        userId: student.id,
        rawCode: 'AZ104-EXPIRED-CODE'
      }),
      /This course access code has expired/
    );
  });

  test('Duplicate active access code cannot be created', () => {
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');

    assert.throws(
      () => accessCodeService.createCode({
        courseId: az104.id,
        code: 'AZ104-CENTURION-01' // Already active
      }),
      /already exists/
    );
  });

  test('Replacing compromised code deactivates old and creates new code', () => {
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');
    const existingCode = accessCodeService.listCodesForCourse(az104.id)[0];

    const replaced = accessCodeService.replaceCode({
      oldCodeId: existingCode.id,
      newCode: 'AZ104-REPLACED-SECURE',
      reason: 'Key leaked in public chat'
    });

    assert.strictEqual(replaced.code, 'AZ104-REPLACED-SECURE');
    assert.strictEqual(replaced.is_active, 1);

    const oldAfter = accessCodeService.getCodeById(existingCode.id);
    assert.strictEqual(oldAfter.is_active, 0, 'Old code should now be inactive');
  });

  test('Unpublished course code cannot be redeemed by students', () => {
    const draftCourse = courseService.createCourse({
      name: 'Unpublished Draft Course',
      code: 'DRAFT101',
      status: 'draft',
      access_code: 'DRAFT-CODE-01'
    });

    const { student } = studentService.createStudent({
      first_name: 'Draft',
      surname: 'Seeker',
      email: 'seeker@example.com'
    });

    assert.throws(
      () => accessCodeService.redeemCourseCode({
        userId: student.id,
        rawCode: 'DRAFT-CODE-01'
      }),
      /This course is not currently published/
    );
  });
});
