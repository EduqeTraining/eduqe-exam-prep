const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { initDatabase, setDatabaseInstance } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const courseService = require('../src/services/courseService');
const classService = require('../src/services/classService');
const studentService = require('../src/services/studentService');
const assessmentService = require('../src/services/assessmentService');
const accessCodeService = require('../src/services/accessCodeService');

describe('Multiple Classes & Student Management Tests', () => {
  beforeEach(() => {
    const db = initDatabase(':memory:');
    setDatabaseInstance(db);
    seedDatabase(':memory:');
  });

  test('Create another class under an existing course without duplicating the course', () => {
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');

    const newClass = classService.createClass({
      courseId: az104.id,
      name: 'Corporate Group A - Evening',
      description: 'Dedicated corporate study cohort',
      facilitator_name: 'Dr. Evelyn Reed',
      access_duration_days: 60
    });

    assert.ok(newClass.id);
    assert.strictEqual(newClass.name, 'Corporate Group A - Evening');
    assert.strictEqual(newClass.course_id, az104.id);

    // Verify course now has 3 classes
    const classes = classService.listClasses(az104.id);
    assert.strictEqual(classes.length, 3);
  });

  test('Duplicate a class copies configuration and assessments', () => {
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');
    const existingClass = classService.listClasses(az104.id)[0];

    const duplicated = classService.duplicateClass(existingClass.id, 'November Morning Class - Batch 2');
    assert.strictEqual(duplicated.name, 'November Morning Class - Batch 2');
    assert.strictEqual(duplicated.course_id, az104.id);
    assert.ok(duplicated.assessments.length > 0, 'Assessments should be copied');
  });

  test('Enroll student, move student between classes, and copy student', () => {
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');
    const classes = classService.listClasses(az104.id);
    const class1 = classes[0];
    const class2 = classes[1];

    const { student } = studentService.createStudent({
      first_name: 'David',
      surname: 'Miller',
      email: 'david@example.com'
    });

    // Enroll in Class 1
    classService.enrollStudent(class1.id, student.id);
    let s = studentService.getStudent(student.id);
    assert.strictEqual(s.enrollments.length, 1);
    assert.strictEqual(s.enrollments[0].class_id, class1.id);

    // Move to Class 2
    classService.moveStudent(class1.id, class2.id, student.id);
    s = studentService.getStudent(student.id);
    assert.strictEqual(s.enrollments.length, 1);
    assert.strictEqual(s.enrollments[0].class_id, class2.id);

    // Copy to Class 1 as well (student in multiple classes)
    classService.copyStudent(class1.id, student.id);
    s = studentService.getStudent(student.id);
    assert.strictEqual(s.enrollments.length, 2);
  });

  test('Removing a student from a class preserves user account and does not delete user', () => {
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');
    const class1 = classService.listClasses(az104.id)[0];

    const { student } = studentService.createStudent({
      first_name: 'Fiona',
      surname: 'Gallagher',
      email: 'fiona@example.com'
    });

    classService.enrollStudent(class1.id, student.id);
    classService.removeStudent(class1.id, student.id);

    // Student account must still exist!
    const preservedStudent = studentService.getStudent(student.id);
    assert.ok(preservedStudent, 'Student account must remain intact');
    assert.strictEqual(preservedStudent.enrollments.length, 0);
  });

  test('Assign one assessment to multiple classes', () => {
    const assessments = assessmentService.listAssessments();
    const assessment = assessments[0];

    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');
    const classes = classService.listClasses(az104.id);

    assert.ok(classes.length >= 2);
    // Seeded assessment was assigned to both classA and classB
    const fullAssessment = assessmentService.getAssessment(assessment.id);
    assert.strictEqual(fullAssessment.assigned_classes.length, 2);
  });

  test('Import students using structured template', () => {
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');
    const class1 = classService.listClasses(az104.id)[0];

    const templateRows = [
      { first_name: 'Liam', surname: 'Johnson', email: 'liam@student.example.com', student_number: 'STU-901' },
      { first_name: 'Olivia', surname: 'Smith', email: 'olivia@student.example.com', student_number: 'STU-902' },
      { first_name: 'Noah', surname: 'Williams', email: 'noah@student.example.com', student_number: 'STU-903' }
    ];

    const importResults = studentService.importStudents(templateRows, { defaultClassId: class1.id });
    assert.strictEqual(importResults.imported.length, 3);
    assert.strictEqual(importResults.errors.length, 0);

    const liam = studentService.listStudents({ query: 'liam@student.example.com' })[0];
    assert.ok(liam);
    assert.strictEqual(liam.first_name, 'Liam');
    assert.strictEqual(liam.account_status, 'active');
  });

  test('Class has its own active access code and redeeming it enrolls student in that specific class', () => {
    const accessCodeService = require('../src/services/accessCodeService');
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');

    const customClass = classService.createClass({
      courseId: az104.id,
      name: 'Dedicated Class Cohort',
      access_code: 'AZ104-COHORT-99'
    });

    assert.strictEqual(customClass.active_code, 'AZ104-COHORT-99');

    const { student } = studentService.createStudent({
      first_name: 'Chloe',
      surname: 'Decker',
      email: 'chloe@example.com'
    });

    const redemption = accessCodeService.redeemCourseCode({
      userId: student.id,
      rawCode: 'AZ104-COHORT-99'
    });

    assert.strictEqual(redemption.success, true);
    assert.strictEqual(redemption.class.id, customClass.id);
    assert.strictEqual(redemption.class.name, 'Dedicated Class Cohort');
  });

  test('Class access code maximum usage limit enforcement and increasing limit for new students', () => {
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');

    // 1. Create class with max_uses = 2
    const limitedClass = classService.createClass({
      courseId: az104.id,
      name: 'Limited Seat Cohort',
      access_code: 'AZ104-SEATS-02',
      max_uses: 2
    });

    assert.strictEqual(limitedClass.active_code, 'AZ104-SEATS-02');
    assert.strictEqual(limitedClass.code_max_uses, 2);
    assert.strictEqual(limitedClass.code_used_count, 0);

    // 2. Student 1 redeems code
    const { student: s1 } = studentService.createStudent({
      first_name: 'Student',
      surname: 'One',
      email: 'student1@example.com'
    });
    const r1 = accessCodeService.redeemCourseCode({ userId: s1.id, rawCode: 'AZ104-SEATS-02' });
    assert.strictEqual(r1.success, true);

    // Verify used_count is 1
    let updatedClass = classService.getClass(limitedClass.id);
    assert.strictEqual(updatedClass.code_used_count, 1);

    // 3. Student 2 redeems code (reaches limit 2/2)
    const { student: s2 } = studentService.createStudent({
      first_name: 'Student',
      surname: 'Two',
      email: 'student2@example.com'
    });
    const r2 = accessCodeService.redeemCourseCode({ userId: s2.id, rawCode: 'AZ104-SEATS-02' });
    assert.strictEqual(r2.success, true);

    updatedClass = classService.getClass(limitedClass.id);
    assert.strictEqual(updatedClass.code_used_count, 2);

    // 4. Student 3 attempts to redeem code - must be blocked because limit 2 is reached
    const { student: s3 } = studentService.createStudent({
      first_name: 'Student',
      surname: 'Three',
      email: 'student3@example.com'
    });
    assert.throws(() => {
      accessCodeService.redeemCourseCode({ userId: s3.id, rawCode: 'AZ104-SEATS-02' });
    }, /maximum usage limit/i);

    // 5. Admin increases seat limit from 2 to 3 via classService.updateClass
    classService.updateClass(limitedClass.id, { max_uses: 3 });

    updatedClass = classService.getClass(limitedClass.id);
    assert.strictEqual(updatedClass.code_max_uses, 3);
    assert.strictEqual(updatedClass.code_used_count, 2);

    // 6. Student 3 can now enroll successfully
    const r3 = accessCodeService.redeemCourseCode({ userId: s3.id, rawCode: 'AZ104-SEATS-02' });
    assert.strictEqual(r3.success, true);

    updatedClass = classService.getClass(limitedClass.id);
    assert.strictEqual(updatedClass.code_used_count, 3);

    // 7. Test direct updateCode: remove limit (make unlimited)
    const activeCodeId = updatedClass.active_code_details.id;
    accessCodeService.updateCode(activeCodeId, { max_uses: null });

    const unlimitedCode = accessCodeService.getCodeById(activeCodeId);
    assert.strictEqual(unlimitedCode.max_uses, null);

    // Student 4 can enroll without limit
    const { student: s4 } = studentService.createStudent({
      first_name: 'Student',
      surname: 'Four',
      email: 'student4@example.com'
    });
    const r4 = accessCodeService.redeemCourseCode({ userId: s4.id, rawCode: 'AZ104-SEATS-02' });
    assert.strictEqual(r4.success, true);
  });
});
