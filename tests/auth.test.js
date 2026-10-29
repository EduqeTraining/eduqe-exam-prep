const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { initDatabase, setDatabaseInstance } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const authService = require('../src/services/authService');
const studentService = require('../src/services/studentService');

describe('Authentication & Account Lifecycle Tests', () => {
  beforeEach(() => {
    const db = initDatabase(':memory:');
    setDatabaseInstance(db);
    seedDatabase(':memory:');
  });

  test('Correct login with valid credentials returns token and user profile', () => {
    const res = authService.login({ username: 'admin', password: 'Admin2026!' });
    assert.ok(res.token, 'Session token should be returned');
    assert.strictEqual(res.user.username, 'admin');
    assert.strictEqual(res.user.role, 'administrator');
    assert.strictEqual(res.user.account_status, 'active');
  });

  test('Incorrect password fails with descriptive error', () => {
    assert.throws(
      () => authService.login({ username: 'admin', password: 'WrongPassword!' }),
      /Invalid username or password/
    );
  });

  test('Non-existent username fails with descriptive error', () => {
    assert.throws(
      () => authService.login({ username: 'ghost_user', password: 'AnyPassword!' }),
      /Invalid username or password/
    );
  });

  test('Suspended account prevents sign in', () => {
    // Create a student and suspend them
    const { student } = studentService.createStudent({
      first_name: 'Suspended',
      surname: 'User',
      email: 'suspended@example.com',
      temporary_password: 'Password123!'
    });

    studentService.setStudentStatus(student.id, 'suspended');

    assert.throws(
      () => authService.login({ username: student.username, password: 'Password123!' }),
      /Your account has been suspended/
    );
  });

  test('Deactivated account prevents sign in', () => {
    const { student } = studentService.createStudent({
      first_name: 'Deactivated',
      surname: 'User',
      email: 'deactivated@example.com',
      temporary_password: 'Password123!'
    });

    studentService.setStudentStatus(student.id, 'deactivated');

    assert.throws(
      () => authService.login({ username: student.username, password: 'Password123!' }),
      /Your account has been deactivated/
    );
  });

  test('Required password change flag is returned on first sign-in', () => {
    // alex.morgan was seeded with must_change_password = true
    const res = authService.login({ username: 'alex.morgan', password: 'Eduque2026!' });
    assert.strictEqual(res.user.must_change_password, true, 'must_change_password should be true on first sign-in');

    // Change password
    authService.changePassword({
      userId: res.user.id,
      currentPassword: 'Eduque2026!',
      newPassword: 'MyNewSecurePassword2026!',
      isFirstTime: true
    });

    // Sign in again with new password
    const res2 = authService.login({ username: 'alex.morgan', password: 'MyNewSecurePassword2026!' });
    assert.strictEqual(res2.user.must_change_password, false, 'must_change_password should now be false');
  });

  test('Valid session can be validated and revoked on logout', () => {
    const res = authService.login({ username: 'sarah.chen', password: 'Eduque2026!' });
    const user = authService.validateSession(res.token);
    assert.ok(user, 'Session should be valid');
    assert.strictEqual(user.username, 'sarah.chen');

    authService.logout(res.token);
    const expiredUser = authService.validateSession(res.token);
    assert.strictEqual(expiredUser, null, 'Session should be invalidated after logout');
  });

  test('Stateless signed token validates across new database/serverless container without sessions row', () => {
    const res = authService.login({ username: 'admin', password: 'Admin2026!' });
    assert.ok(res.token, 'Should return signed token');

    // Simulate switching to a brand new container instance with a fresh SQLite DB where sessions table is empty
    const freshDb = initDatabase(':memory:');
    setDatabaseInstance(freshDb);
    seedDatabase(':memory:');

    // Verify sessions table in freshDb has 0 sessions
    const sessionCount = freshDb.get('SELECT COUNT(*) as c FROM sessions').c;
    assert.strictEqual(sessionCount, 0, 'New container sessions table must be completely empty');

    // Validating token on new container must succeed statelessly
    const restoredUser = authService.validateSession(res.token);
    assert.ok(restoredUser, 'Stateless session must validate on new container without sessions row');
    assert.strictEqual(restoredUser.username, 'admin');
    assert.strictEqual(restoredUser.role, 'administrator');
  });

  test('Student self-registration creates active account and returns authenticated session', () => {
    const reg = authService.registerStudent({
      first_name: 'David',
      surname: 'Kruger',
      email: 'david.kruger@example.com',
      password: 'MyPassword2026!'
    });

    assert.ok(reg.token, 'Should return active session token');
    assert.strictEqual(reg.user.first_name, 'David');
    assert.strictEqual(reg.user.surname, 'Kruger');
    assert.strictEqual(reg.user.email, 'david.kruger@example.com');
    assert.strictEqual(reg.user.username, 'david.kruger');
    assert.strictEqual(reg.user.role, 'student');
    assert.strictEqual(reg.user.account_status, 'active');
    assert.strictEqual(reg.user.must_change_password, false, 'Self-registered students should not be forced to change password');

    // Verify session is active
    const sessionUser = authService.validateSession(reg.token);
    assert.ok(sessionUser, 'Session should be valid');
    assert.strictEqual(sessionUser.id, reg.user.id);
  });

  test('Student self-registration with custom username and student number', () => {
    const reg = authService.registerStudent({
      first_name: 'Elena',
      surname: 'Rostova',
      email: 'elena@example.com',
      username: 'elena_r26',
      student_number: 'STU-9921',
      password: 'SecurePass2026!'
    });

    assert.strictEqual(reg.user.username, 'elena_r26');
    assert.strictEqual(reg.user.student_number, 'STU-9921');
  });

  test('Student self-registration enforces email and password validation', () => {
    // Missing first name
    assert.throws(
      () => authService.registerStudent({ first_name: '', surname: 'Smith', email: 'smith@test.com', password: 'password123' }),
      /First name is required/
    );

    // Invalid email
    assert.throws(
      () => authService.registerStudent({ first_name: 'John', surname: 'Smith', email: 'not-an-email', password: 'password123' }),
      /Please enter a valid email address/
    );

    // Short password
    assert.throws(
      () => authService.registerStudent({ first_name: 'John', surname: 'Smith', email: 'smith@test.com', password: '123' }),
      /Password must be at least 6 characters long/
    );

    // Duplicate email
    assert.throws(
      () => authService.registerStudent({ first_name: 'Sarah', surname: 'Duplicate', email: 'sarah.chen@student.eduqe.example.com', password: 'password123' }),
      /already exists/
    );

    // Duplicate username
    assert.throws(
      () => authService.registerStudent({ first_name: 'Another', surname: 'Admin', email: 'unique@test.com', username: 'admin', password: 'password123' }),
      /already taken/
    );
  });

  test('Student self-registration with course access code automatically enrolls student', () => {
    const reg = authService.registerStudent({
      first_name: 'Liam',
      surname: 'OConnor',
      email: 'liam@example.com',
      password: 'LiamPassword2026!',
      course_code: 'AZ104-CENTURION-01'
    });

    assert.ok(reg.token, 'Should return session token');
    assert.ok(reg.redeemedCourse, 'Should return redeemed course information');
    assert.strictEqual(reg.redeemedCourse.course.code, 'AZ104');
    assert.ok(reg.redeemedCourse.question_count > 0, 'Should have questions available');
  });

  test('Student self-registration with invalid course code fails before creating user', () => {
    assert.throws(
      () => authService.registerStudent({
        first_name: 'Invalid',
        surname: 'CodeStudent',
        email: 'invalidcode@example.com',
        password: 'Password2026!',
        course_code: 'NON_EXISTENT_CODE_9999'
      }),
      /Invalid course access code/
    );
  });
});
