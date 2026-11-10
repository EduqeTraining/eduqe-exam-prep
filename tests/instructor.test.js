// Instructor Management, Class Allocation & Cohort Progress Tests

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');

const { initDatabase, setDatabaseInstance, getDatabase } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const { createServer } = require('../src/server');

test('Instructor Management, Class Allocation & Instructor Portal API', async (t) => {
  const db = initDatabase(':memory:');
  setDatabaseInstance(db);
  seedDatabase(':memory:');

  const server = createServer();
  const requestListener = server.listeners('request')[0];

  function req(urlPath, { method = 'GET', body = null, token = null } = {}) {
    return new Promise((resolve, reject) => {
      const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

      const reqStream = new Readable({
        read() {
          if (payload) {
            this.push(Buffer.from(payload));
          }
          this.push(null);
        }
      });

      reqStream.method = method;
      reqStream.url = urlPath;
      reqStream.socket = { remoteAddress: '127.0.0.1' };
      reqStream.headers = {
        host: 'localhost',
        ...(payload ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      };

      let statusCode = 200;
      const resHeaders = {};
      const resChunks = [];

      const res = new EventEmitter();
      res.writeHead = (status, hdrs) => {
        statusCode = status;
        if (hdrs) Object.assign(resHeaders, hdrs);
        return res;
      };
      res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
      res.getHeader = (k) => resHeaders[k.toLowerCase()];
      res.write = (chunk) => {
        if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      };
      res.end = (chunk) => {
        if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const resBody = Buffer.concat(resChunks).toString('utf8');
        let data = resBody;
        const ct = (resHeaders['content-type'] || resHeaders['Content-Type'] || '');
        if (ct.includes('application/json')) {
          try { data = JSON.parse(resBody); } catch (_) {}
        }
        resolve({ status: statusCode, headers: resHeaders, data });
      };

      try {
        requestListener(reqStream, res);
      } catch (err) {
        reject(err);
      }
    });
  }

  let adminToken;
  let seededInstructorToken;
  let seededInstructorId;
  let newInstructorToken;
  let newInstructorId;
  let allocatedClassId;

  await t.test('1. Admin can list seeded instructors and create a new instructor with username & password', async () => {
    const loginRes = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Admin2026!' }
    });
    assert.equal(loginRes.status, 200);
    adminToken = loginRes.data.token;

    // List instructors (should include seeded Dr. Evelyn Reed)
    const listRes = await req('/api/instructors', { token: adminToken });
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.data));
    assert.ok(listRes.data.some(i => i.username === 'evelyn.reed'));

    // Create a new instructor with explicit username & password
    const createRes = await req('/api/instructors', {
      method: 'POST',
      token: adminToken,
      body: {
        first_name: 'Marcus',
        surname: 'Vance',
        email: 'marcus.vance@eduqe.com',
        username: 'marcus.vance',
        password: 'InstructorPass99!'
      }
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.data.instructor.username, 'marcus.vance');
    assert.equal(createRes.data.instructor.role, 'instructor');
    assert.equal(createRes.data.temporary_password, 'InstructorPass99!');
    newInstructorId = createRes.data.instructor.id;
  });

  await t.test('2. Admin can allocate an instructor when creating and updating a class', async () => {
    const coursesRes = await req('/api/courses', { token: adminToken });
    assert.equal(coursesRes.status, 200);
    const courseId = coursesRes.data[0].id;

    // Create a class allocated to the new instructor
    const createClassRes = await req('/api/classes', {
      method: 'POST',
      token: adminToken,
      body: {
        course_id: courseId,
        name: 'December Executive Cohort',
        instructor_id: newInstructorId,
        start_date: '2026-12-01',
        end_date: '2026-12-15',
        default_access_duration_value: 30,
        default_access_duration_unit: 'days'
      }
    });
    assert.equal(createClassRes.status, 201);
    assert.equal(createClassRes.data.instructor_id, newInstructorId);
    assert.equal(createClassRes.data.instructor_name, 'Marcus Vance');
    assert.equal(createClassRes.data.facilitator_name, 'Marcus Vance');
    allocatedClassId = createClassRes.data.id;

    // Verify classes list includes instructor allocation info
    const classesListRes = await req('/api/classes', { token: adminToken });
    assert.equal(classesListRes.status, 200);
    const found = classesListRes.data.find(c => c.id === allocatedClassId);
    assert.ok(found);
    assert.equal(found.instructor_id, newInstructorId);
    assert.equal(found.instructor_name, 'Marcus Vance');
  });

  await t.test('3. Newly created instructor and seeded instructor can sign in and view cohort progress & stats', async () => {
    // Login as newly created instructor
    const loginNew = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'marcus.vance', password: 'InstructorPass99!' }
    });
    assert.equal(loginNew.status, 200);
    assert.equal(loginNew.data.user.role, 'instructor');
    newInstructorToken = loginNew.data.token;

    // Check assigned classes for Marcus Vance
    const myClassesRes = await req('/api/instructor/classes', { token: newInstructorToken });
    assert.equal(myClassesRes.status, 200);
    assert.equal(myClassesRes.data.length, 1);
    assert.equal(myClassesRes.data[0].id, allocatedClassId);

    // Login as seeded instructor Dr. Evelyn Reed (assigned to November Morning Class with student attempts)
    const loginSeeded = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'evelyn.reed', password: 'Eduqe2026!' }
    });
    assert.equal(loginSeeded.status, 200);
    assert.equal(loginSeeded.data.user.role, 'instructor');
    seededInstructorToken = loginSeeded.data.token;
    seededInstructorId = loginSeeded.data.user.id;

    // Fetch cohort progress & stats for Dr. Evelyn Reed
    const progressRes = await req('/api/instructor/progress', { token: seededInstructorToken });
    assert.equal(progressRes.status, 200);
    assert.ok(progressRes.data.selected_class);
    assert.equal(progressRes.data.selected_class.name, 'November Morning Class');
    assert.ok(progressRes.data.summary.total_enrolled >= 2);
    assert.ok(Array.isArray(progressRes.data.students));
    assert.ok(progressRes.data.students.length >= 2);
    assert.ok(Array.isArray(progressRes.data.questions_analysis));
  });

  await t.test('4. Instructor can export class roster & performance CSV report', async () => {
    const progressRes = await req('/api/instructor/progress', { token: seededInstructorToken });
    const classId = progressRes.data.selected_class.id;

    const exportRes = await req(`/api/instructor/export-class?class_id=${classId}`, {
      token: seededInstructorToken
    });
    assert.equal(exportRes.status, 200);
    const ct = exportRes.headers['content-type'] || exportRes.headers['Content-Type'] || '';
    assert.ok(ct.includes('text/csv'));
    assert.ok(exportRes.data.includes('Student Name,Username,Email'));
    assert.ok(exportRes.data.includes('Sarah Chen'));
  });

  await t.test('5. Role-based access control prevents students from accessing instructor endpoints', async () => {
    const studentLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'sarah.chen', password: 'Eduqe2026!' }
    });
    assert.equal(studentLogin.status, 200);
    const studentToken = studentLogin.data.token;

    const forbiddenProgress = await req('/api/instructor/progress', { token: studentToken });
    assert.equal(forbiddenProgress.status, 403);

    const forbiddenAdminInstructors = await req('/api/instructors', { token: newInstructorToken });
    assert.equal(forbiddenAdminInstructors.status, 403);
  });

  await t.test('6. Deleting a class or course in Admin removes it from Student and Instructor portals', async () => {
    // 1. Delete the allocatedClassId created in test 2
    const delClassRes = await req(`/api/classes/${allocatedClassId}`, {
      method: 'DELETE',
      token: adminToken
    });
    assert.equal(delClassRes.status, 200);
    assert.equal(delClassRes.data.success, true);

    // Verify the instructor (Marcus Vance) no longer has that class in their portal
    const instClassesAfterClassDel = await req('/api/instructor/classes', { token: newInstructorToken });
    assert.equal(instClassesAfterClassDel.status, 200);
    assert.equal(instClassesAfterClassDel.data.length, 0);

    // 2. Create a temporary course, a class allocated to Marcus Vance, and enroll a student
    const createCourseRes = await req('/api/courses', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Temp Security Course',
        code: 'SC900',
        access_code: 'SC900-TEMP',
        status: 'published'
      }
    });
    assert.equal(createCourseRes.status, 201);
    const tempCourseId = createCourseRes.data.id;

    const createTempClassRes = await req('/api/classes', {
      method: 'POST',
      token: adminToken,
      body: {
        course_id: tempCourseId,
        name: 'SC900 Cohort 1',
        instructor_id: newInstructorId
      }
    });
    assert.equal(createTempClassRes.status, 201);

    // Student redeems course code to enroll
    const studentLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'sarah.chen', password: 'Eduqe2026!' }
    });
    const studentToken = studentLogin.data.token;

    const redeemRes = await req('/api/student/redeem-code', {
      method: 'POST',
      token: studentToken,
      body: { code: 'SC900' }
    });
    assert.equal(redeemRes.status, 200);

    // Verify student and instructor see the new course/class
    const stuDashBefore = await req('/api/student/dashboard', { token: studentToken });
    assert.ok(stuDashBefore.data.courses.some(c => c.course_id === tempCourseId));

    const instClassesBefore = await req('/api/instructor/classes', { token: newInstructorToken });
    assert.equal(instClassesBefore.data.length, 1);

    // 3. Admin deletes the course
    const delCourseRes = await req(`/api/courses/${tempCourseId}`, {
      method: 'DELETE',
      token: adminToken
    });
    assert.equal(delCourseRes.status, 200);
    assert.equal(delCourseRes.data.success, true);

    // Verify course & class are removed from Student Portal and Instructor Portal
    const stuDashAfter = await req('/api/student/dashboard', { token: studentToken });
    assert.ok(!stuDashAfter.data.courses.some(c => c.course_id === tempCourseId));

    const instClassesAfter = await req('/api/instructor/classes', { token: newInstructorToken });
    assert.equal(instClassesAfter.data.length, 0);
  });

  await t.test('7. Assessments include 3 default sections, support adding more sections, and track section help on Instructor Portal', async () => {
    const coursesRes = await req('/api/courses', { token: adminToken });
    const courseId = coursesRes.data[0].id;

    // Create assessment without specifying sections -> should default to 3 sections
    const createAssRes = await req('/api/assessments', {
      method: 'POST',
      token: adminToken,
      body: {
        course_id: courseId,
        name: 'Multi-Section Cloud Architecture Exam',
        duration_minutes: 45,
        pass_mark_percentage: 70,
        status: 'published'
      }
    });
    assert.equal(createAssRes.status, 201);
    assert.deepEqual(createAssRes.data.section_names, ['Section 1', 'Section 2', 'Section 3']);
    assert.equal(createAssRes.data.sections.length, 3);
    const assessmentId = createAssRes.data.id;

    // Update assessment to add a 4th section
    const updateAssRes = await req(`/api/assessments/${assessmentId}`, {
      method: 'PUT',
      token: adminToken,
      body: {
        sections: ['Section 1', 'Section 2', 'Section 3', 'Section 4']
      }
    });
    assert.equal(updateAssRes.status, 200);
    assert.deepEqual(updateAssRes.data.section_names, ['Section 1', 'Section 2', 'Section 3', 'Section 4']);

    // Verify Instructor Portal returns sections_analysis and per-student section_breakdown
    const studentLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'sarah.chen', password: 'Eduqe2026!' }
    });
    const studentToken = studentLogin.data.token;
    const stuDash = await req('/api/student/dashboard', { token: studentToken });
    const seededAssId = stuDash.data.available_assessments[0].id;
    const startRes = await req(`/api/student/attempts/start`, {
      method: 'POST',
      token: studentToken,
      body: { assessment_id: seededAssId }
    });
    assert.equal(startRes.status, 200);
    assert.ok(Array.isArray(startRes.data.sections));
    assert.ok(startRes.data.sections.length >= 3);

    const submitRes = await req(`/api/student/attempts/${startRes.data.id}/submit`, {
      method: 'POST',
      token: studentToken
    });
    assert.equal(submitRes.status, 200);

    const progressRes = await req('/api/instructor/progress', { token: seededInstructorToken });
    assert.equal(progressRes.status, 200);
    assert.ok(Array.isArray(progressRes.data.sections_analysis));
    assert.ok(progressRes.data.sections_analysis.length >= 3);
    const firstSec = progressRes.data.sections_analysis[0];
    assert.equal(firstSec.name, 'Section 1');
    assert.equal(firstSec.section_name, 'Section 1');
    assert.ok(firstSec.completed_students_count >= 1);
    assert.ok(firstSec.total_attempts_count >= 1);
    assert.ok(Array.isArray(firstSec.all_student_results));
    assert.ok(firstSec.all_student_results.length >= 1);
    assert.ok(firstSec.students_needing_help[0].student_name.includes('Sarah Chen'));

    const studentWithAttempts = progressRes.data.students.find(s => s.attempt_count > 0);
    assert.ok(studentWithAttempts);
    assert.ok(Array.isArray(studentWithAttempts.section_breakdown));
    assert.ok(studentWithAttempts.section_breakdown.length >= 3);
    assert.equal(studentWithAttempts.section_breakdown[0].name, 'Section 1');
    assert.equal(studentWithAttempts.section_breakdown[0].is_completed, true);
    assert.ok(Array.isArray(studentWithAttempts.section_breakdown[0].attempt_history));
    assert.ok(Array.isArray(studentWithAttempts.sections_needing_help));
    assert.ok(studentWithAttempts.sections_needing_help.length >= 3);
  });

  await t.test('8. Admin can delete an instructor: unassigns their allocated classes and permanently removes their account', async () => {
    // 1. Create a temporary instructor
    const createRes = await req('/api/instructors', {
      method: 'POST',
      token: adminToken,
      body: {
        first_name: 'ToDelete',
        surname: 'Instructor',
        email: 'todelete.instructor@eduqe.example.com',
        password: 'PasswordToDelete123!'
      }
    });
    assert.equal(createRes.status, 201);
    const instId = createRes.data.instructor.id;

    // 2. Assign instructor to a class
    const coursesRes = await req('/api/courses', { token: adminToken });
    const courseId = coursesRes.data[0].id;
    const createClassRes = await req('/api/classes', {
      method: 'POST',
      token: adminToken,
      body: {
        course_id: courseId,
        name: 'Class For Instructor Deletion Test',
        instructor_id: instId,
        start_date: '2026-11-01T08:00:00Z',
        end_date: '2026-11-30T17:00:00Z'
      }
    });
    assert.equal(createClassRes.status, 201);
    const classId = createClassRes.data.id;
    assert.equal(createClassRes.data.instructor_id, instId);

    // 3. Non-admin (student) cannot delete an instructor (403 forbidden)
    const studentLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'sarah.chen', password: 'Eduqe2026!' }
    });
    const studentToken = studentLogin.data.token;
    const forbiddenDel = await req(`/api/instructors/${instId}`, {
      method: 'DELETE',
      token: studentToken
    });
    assert.equal(forbiddenDel.status, 403);

    // 4. Admin deletes the instructor
    const delRes = await req(`/api/instructors/${instId}`, {
      method: 'DELETE',
      token: adminToken
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.data.success, true);

    // 5. Verify instructor is no longer in list
    const listAfter = await req('/api/instructors', { token: adminToken });
    assert.ok(!listAfter.data.some(i => i.id === instId));

    // 6. Verify class is still intact but instructor_id is unassigned (null)
    const classAfter = await req(`/api/classes/${classId}`, { token: adminToken });
    assert.equal(classAfter.data.instructor_id, null);
    assert.equal(classAfter.data.instructor_name, null);

    // 7. Verify deleted instructor cannot log in
    const loginDeleted = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'todelete.instructor', password: 'PasswordToDelete123!' }
    });
    assert.ok(loginDeleted.status === 400 || loginDeleted.status === 401);
  });

  await t.test('9. Delegate registration, code enrollment, and completed assessment pulls through immediately to Instructor Dashboard', async () => {
    // 1. Delegate self-registers with course access code
    const registerRes = await req('/api/auth/register', {
      method: 'POST',
      body: {
        first_name: 'Jane',
        surname: 'Delegate',
        email: 'jane.delegate@example.com',
        username: 'jane.delegate',
        password: 'Password123!',
        student_number: 'DEL-2026-99',
        course_code: 'AZ104-CENTURION-01'
      }
    });
    assert.equal(registerRes.status, 201);
    assert.ok(registerRes.data.user);
    assert.ok(registerRes.data.token);
    const delegateToken = registerRes.data.token;
    const delegateId = registerRes.data.user.id;

    // 2. Delegate checks dashboard
    const dashRes = await req('/api/student/dashboard', { token: delegateToken });
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.courses && dashRes.data.courses.length >= 1);
    assert.ok(dashRes.data.available_assessments && dashRes.data.available_assessments.length >= 1);

    const targetAssessment = dashRes.data.available_assessments[0];
    const targetClassId = targetAssessment.class_id;
    assert.ok(targetAssessment.id);
    assert.ok(targetClassId);

    // 3. Delegate starts the assessment
    const startRes = await req('/api/student/attempts/start', {
      method: 'POST',
      token: delegateToken,
      body: {
        assessment_id: targetAssessment.id,
        class_id: targetClassId
      }
    });
    assert.equal(startRes.status, 200);
    const attemptId = startRes.data.id || startRes.data.attempt?.id;
    assert.ok(attemptId);

    // 4. Delegate answers first question and submits
    const firstQ = startRes.data.questions[0];
    assert.ok(firstQ);
    const autosaveRes = await req(`/api/student/attempts/${attemptId}/autosave`, {
      method: 'POST',
      token: delegateToken,
      body: {
        question_id: firstQ.id,
        saved_answer: JSON.stringify(firstQ.answer_options?.[0] || 'A')
      }
    });
    assert.equal(autosaveRes.status, 200);

    const submitRes = await req(`/api/student/attempts/${attemptId}/submit`, {
      method: 'POST',
      token: delegateToken
    });
    assert.equal(submitRes.status, 200);
    assert.ok(submitRes.data.status === 'marked' || submitRes.data.status === 'awaiting_review');

    // 5. Instructor views the class progress
    const instructorProgressRes = await req(`/api/instructor/progress?class_id=${targetClassId}`, {
      token: seededInstructorToken
    });
    assert.equal(instructorProgressRes.status, 200);

    // 6. Verify delegate appears on instructor dashboard with their attempt
    const foundDelegate = instructorProgressRes.data.students.find(s => s.id === delegateId || s.username === 'jane.delegate');
    assert.ok(foundDelegate, 'Delegate must be present in instructor class roster');
    assert.equal(foundDelegate.attempt_count, 1, 'Delegate attempt count must be 1 on instructor dashboard');
    assert.equal(foundDelegate.completed_attempt_count, 1, 'Delegate completed attempt count must be 1');
    assert.ok(foundDelegate.latest_score !== null, 'Delegate latest score must pull through');

    // 7. Verify delegate attempt is recorded in recent_attempts stream
    const recentFound = instructorProgressRes.data.recent_attempts.find(ra => ra.id === attemptId || ra.user_id === delegateId);
    assert.ok(recentFound, 'Delegate attempt must appear in instructor recent attempts stream');
  });

  await t.test('10. Smart cohort selection, "all" cohorts aggregation, and empty duplicate class deduplication', async () => {
    // 1. Create a second empty class assigned to the instructor
    const coursesRes = await req('/api/courses', { token: adminToken });
    const courseId = coursesRes.data[0].id;
    const createClassRes = await req('/api/classes', {
      method: 'POST',
      token: adminToken,
      body: {
        course_id: courseId,
        name: 'Empty Extra Class',
        instructor_id: seededInstructorId,
        start_date: '2026-11-01T08:00:00Z',
        end_date: '2026-11-30T17:00:00Z'
      }
    });
    assert.equal(createClassRes.status, 201);
    const emptyClassId = createClassRes.data.id;

    // 2. Querying without class_id should smartly default to the active class with enrolled learners, NOT the empty class
    const defaultRes = await req('/api/instructor/progress', { token: seededInstructorToken });
    assert.equal(defaultRes.status, 200);
    assert.ok(defaultRes.data.selected_class.id !== emptyClassId, 'Smart selection must not default to an empty class when active classes exist');
    assert.ok(defaultRes.data.summary.total_enrolled > 0, 'Default selection must have enrolled learners');

    // 3. Querying with class_id=all aggregates across all assigned classes
    const allRes = await req('/api/instructor/progress?class_id=all', { token: seededInstructorToken });
    assert.equal(allRes.status, 200);
    assert.equal(allRes.data.selected_class.id, 'all');
    assert.ok(allRes.data.summary.total_enrolled >= defaultRes.data.summary.total_enrolled, 'All cohorts must include all learners');
    assert.ok(allRes.data.sections_analysis.length > 0, 'Sections analysis must be present for all cohorts');

    // 4. Duplicate class creation: creating a class with identical name and course when empty reuses existing
    const dupRes = await req('/api/classes', {
      method: 'POST',
      token: adminToken,
      body: {
        course_id: courseId,
        name: 'Empty Extra Class',
        instructor_id: seededInstructorId
      }
    });
    assert.equal(dupRes.status, 201);
    assert.equal(dupRes.data.id, emptyClassId, 'Reuses empty class ID instead of creating duplicate ghost class');
  });

  await t.test('11. Strict cohort code isolation: students redeeming Code A must not leak into Cohort B sharing same course/assessment', async () => {
    const coursesRes = await req('/api/courses', { token: adminToken });
    const courseId = coursesRes.data[0].id;

    // Create Cohort Alpha with code ALPHA-CODE-99
    const alphaClassRes = await req('/api/classes', {
      method: 'POST',
      token: adminToken,
      body: {
        course_id: courseId,
        name: 'Cohort Alpha',
        instructor_id: seededInstructorId,
        access_code: 'ALPHA-CODE-99'
      }
    });
    assert.equal(alphaClassRes.status, 201);
    const alphaClassId = alphaClassRes.data.id;

    // Create Cohort Beta with code BETA-CODE-99
    const betaClassRes = await req('/api/classes', {
      method: 'POST',
      token: adminToken,
      body: {
        course_id: courseId,
        name: 'Cohort Beta',
        instructor_id: seededInstructorId,
        access_code: 'BETA-CODE-99'
      }
    });
    assert.equal(betaClassRes.status, 201);
    const betaClassId = betaClassRes.data.id;

    // Register Student Alpha with ALPHA-CODE-99
    const regAlpha = await req('/api/auth/register', {
      method: 'POST',
      body: {
        first_name: 'AlphaUser',
        surname: 'Student',
        email: 'alpha.student@example.com',
        username: 'alpha.student',
        password: 'Password123!',
        student_number: 'STU-ALPHA',
        course_code: 'ALPHA-CODE-99'
      }
    });
    assert.equal(regAlpha.status, 201);
    const alphaUserId = regAlpha.data.user.id;

    // Register Student Beta with BETA-CODE-99
    const regBeta = await req('/api/auth/register', {
      method: 'POST',
      body: {
        first_name: 'BetaUser',
        surname: 'Student',
        email: 'beta.student@example.com',
        username: 'beta.student',
        password: 'Password123!',
        student_number: 'STU-BETA',
        course_code: 'BETA-CODE-99'
      }
    });
    assert.equal(regBeta.status, 201);
    const betaUserId = regBeta.data.user.id;

    // Instructor views Cohort Alpha
    const alphaProgress = await req(`/api/instructor/progress?class_id=${alphaClassId}`, {
      token: seededInstructorToken
    });
    assert.equal(alphaProgress.status, 200);
    assert.equal(alphaProgress.data.summary.total_enrolled, 1, 'Cohort Alpha must have exactly 1 enrolled student');
    assert.ok(alphaProgress.data.students.some(s => s.id === alphaUserId), 'AlphaUser must be in Cohort Alpha');
    assert.ok(!alphaProgress.data.students.some(s => s.id === betaUserId), 'BetaUser must NOT be in Cohort Alpha');

    // Instructor views Cohort Beta
    const betaProgress = await req(`/api/instructor/progress?class_id=${betaClassId}`, {
      token: seededInstructorToken
    });
    assert.equal(betaProgress.status, 200);
    assert.equal(betaProgress.data.summary.total_enrolled, 1, 'Cohort Beta must have exactly 1 enrolled student');
    assert.ok(betaProgress.data.students.some(s => s.id === betaUserId), 'BetaUser must be in Cohort Beta');
    assert.ok(!betaProgress.data.students.some(s => s.id === alphaUserId), 'AlphaUser must NOT be in Cohort Beta');
  });

  await t.test('12. Instructor progress question analytics handles attempt answers for orphan questions without idx is not defined error', async () => {
    const db = getDatabase();
    const allocatedClass = db.get(`SELECT id, instructor_id, course_id FROM classes WHERE instructor_id IS NOT NULL LIMIT 1`);
    assert.ok(allocatedClass, 'Must find an allocated class');

    const asm = db.get(`SELECT id FROM assessments LIMIT 1`);
    assert.ok(asm, 'Must find an assessment');

    db.run(
      `INSERT OR IGNORE INTO assessment_classes (id, assessment_id, class_id)
       VALUES ('ac_orphan_test_999', ?, ?)`,
      [asm.id, allocatedClass.id]
    );

    // Insert an orphan question not tied to any assessment
    const orphanQId = 'q_orphan_test_999';
    db.run(
      `INSERT OR REPLACE INTO questions (id, question_text, question_type, topic, difficulty, status, answer_options, correct_answer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orphanQId, 'What is orphan testing?', 'single_choice', 'Testing', 'easy', 'published', JSON.stringify(['A', 'B']), 'A']
    );

    // Create an attempt answer referencing this orphan question for this class
    const dummyAttemptId = 'att_orphan_test_999';
    db.run(
      `INSERT OR REPLACE INTO student_attempts (id, user_id, assessment_id, class_id, attempt_number, status, deadline_at, score, max_score, percentage)
       VALUES (?, ?, ?, ?, 1, 'completed', datetime('now', '+1 hour'), 1, 1, 100)`,
      [dummyAttemptId, 'usr_admin_001', asm.id, allocatedClass.id]
    );

    db.run(
      `INSERT OR REPLACE INTO attempt_answers (id, attempt_id, question_id, saved_answer, is_correct, section_name)
       VALUES (?, ?, ?, ?, 1, 'Section 1')`,
      ['aa_orphan_test_999', dummyAttemptId, orphanQId, 'A']
    );

    // Fetch instructor progress for this specific class - must succeed with 200 and return question analytics with question_number
    const progressRes = await req(`/api/instructor/progress?class_id=${allocatedClass.id}`, {
      token: adminToken
    });
    assert.equal(progressRes.status, 200, 'Must not throw 500/400 idx is not defined');
    assert.ok(Array.isArray(progressRes.data.questions_analysis), 'Must return questions_analysis');
    const orphanAnalysis = progressRes.data.questions_analysis.find(q => q.id === orphanQId);
    assert.ok(orphanAnalysis, 'Orphan question must be present in analysis');
    assert.ok(typeof orphanAnalysis.question_number === 'number', 'Orphan question must have a numeric question_number');
  });

  await t.test('13. Class sections isolation: foreign attempts and foreign section names from another class/assessment do not leak into cohort tracker', async () => {
    const db = getDatabase();

    const existingCourse = db.get(`SELECT id FROM courses LIMIT 1`);
    const existingInstructor = db.get(`SELECT id FROM users WHERE role = 'instructor' LIMIT 1`);
    const existingStudent = db.get(`SELECT id FROM users WHERE role = 'student' OR role = 'delegate' OR role = 'learner' LIMIT 1`);
    assert.ok(existingCourse && existingInstructor && existingStudent, 'Must find seeded course, instructor, and student');

    const testCourseId = existingCourse.id;
    const testInstructorId = existingInstructor.id;
    const studentId = existingStudent.id;

    // 1. Create a class with 2 configured sections
    const testClassId = 'cls_isolate_test_101';
    db.run(
      `INSERT OR REPLACE INTO classes (id, course_id, instructor_id, name, status)
       VALUES (?, ?, ?, 'Isolate Test Class', 'active')`,
      [testClassId, testCourseId, testInstructorId]
    );

    // 2. Create an assessment with exactly 2 sections: 'Section 1' and 'Section 2'
    const testAsmId = 'asm_isolate_test_101';
    db.run(
      `INSERT OR REPLACE INTO assessments (id, course_id, name, duration_minutes, pass_mark_percentage, status, sections)
       VALUES (?, ?, 'Isolate Test Assessment', 60, 70, 'published', ?)`,
      [testAsmId, testCourseId, JSON.stringify(['Section 1', 'Section 2'])]
    );

    db.run(
      `INSERT OR REPLACE INTO assessment_classes (id, assessment_id, class_id)
       VALUES ('ac_isolate_101', ?, ?)`,
      [testAsmId, testClassId]
    );

    // Add 2 questions for this assessment
    db.run(
      `INSERT OR REPLACE INTO questions (id, course_id, question_text, question_type, topic, difficulty, status, answer_options, correct_answer)
       VALUES ('q_iso_1', ?, 'Question 1', 'single_choice', 'Cloud', 'easy', 'published', '["A","B"]', 'A'),
              ('q_iso_2', ?, 'Question 2', 'single_choice', 'Cloud', 'easy', 'published', '["A","B"]', 'A')`,
      [testCourseId, testCourseId]
    );
    db.run(
      `INSERT OR REPLACE INTO assessment_questions (id, assessment_id, question_id, section_name, order_index)
       VALUES ('aq_iso_1', ?, 'q_iso_1', 'Section 1', 1),
              ('aq_iso_2', ?, 'q_iso_2', 'Section 2', 2)`,
      [testAsmId, testAsmId]
    );

    // 3. Enroll student in this class
    db.run(
      `INSERT OR REPLACE INTO class_enrollments (id, class_id, user_id, status)
       VALUES ('ce_iso_101', ?, ?, 'active')`,
      [testClassId, studentId]
    );

    // 4. Simulate that student has an attempt from a DIFFERENT class/assessment with a rogue section name
    const foreignClassId = 'cls_other_test_999';
    const foreignAsmId = 'asm_other_test_999';
    db.run(
      `INSERT OR REPLACE INTO classes (id, course_id, instructor_id, name, status)
       VALUES (?, ?, ?, 'Other Class', 'active')`,
      [foreignClassId, testCourseId, testInstructorId]
    );
    db.run(
      `INSERT OR REPLACE INTO assessments (id, course_id, name, duration_minutes, pass_mark_percentage, status, sections)
       VALUES (?, ?, 'Other Assessment', 60, 70, 'published', ?)`,
      [foreignAsmId, testCourseId, JSON.stringify(['Objective 1: Identity, Governance, Security & Storage'])]
    );

    const foreignAttemptId = 'att_foreign_leak_999';
    db.run(
      `INSERT OR REPLACE INTO student_attempts (id, user_id, assessment_id, class_id, attempt_number, status, deadline_at, score, max_score, percentage)
       VALUES (?, ?, ?, ?, 1, 'completed', datetime('now', '+1 hour'), 1, 5, 20)`,
      [foreignAttemptId, studentId, foreignAsmId, foreignClassId]
    );
    db.run(
      `INSERT OR REPLACE INTO attempt_answers (id, attempt_id, question_id, saved_answer, is_correct, section_name)
       VALUES ('aa_foreign_leak_1', ?, 'q_iso_1', 'A', 1, 'Objective 1: Identity, Governance, Security & Storage')`,
      [foreignAttemptId]
    );

    // 5. Query instructor progress for testClassId
    const progressRes = await req(`/api/instructor/progress?class_id=${testClassId}`, {
      token: adminToken
    });

    assert.equal(progressRes.status, 200);
    assert.ok(Array.isArray(progressRes.data.sections_analysis), 'Must return sections_analysis');

    const sectionNames = progressRes.data.sections_analysis.map(s => s.name);
    assert.deepEqual(sectionNames, ['Section 1', 'Section 2'], 'Must strictly contain ONLY Section 1 and Section 2');
    assert.ok(!sectionNames.includes('Objective 1: Identity, Governance, Security & Storage'), 'Must NOT leak foreign objective from another class');

    const studentRecord = progressRes.data.students.find(s => s.id === studentId);
    assert.ok(studentRecord, 'Student must be listed in roster');
    assert.equal(studentRecord.attempt_count, 0, 'Student has not started this class assessment, so attempt_count must be 0');
    assert.equal(studentRecord.status_label, 'Not Started', 'Status must be Not Started');
    assert.equal(studentRecord.best_score, null, 'Best score must be null');
    assert.deepEqual(studentRecord.sections_needing_help, [], 'Must not need help in foreign objective');

    const studentSecNames = studentRecord.section_breakdown.map(s => s.name);
    assert.deepEqual(studentSecNames, ['Section 1', 'Section 2'], 'Student section breakdown must strictly only have Section 1 and Section 2');
  });

  await t.test('14. In-progress attempt with completed section persists score and status without resetting to Not Started on refresh or sync', async () => {
    const db = getDatabase();
    const testClassId = 'cls_persist_test_14';
    const testCourseId = db.get('SELECT id FROM courses LIMIT 1').id;
    const studentUser = db.get("SELECT id FROM users WHERE role = 'student' LIMIT 1");
    const testAsm = db.get("SELECT id FROM assessments WHERE status = 'published' LIMIT 1");

    db.run(
      `INSERT OR REPLACE INTO classes (id, course_id, name, status)
       VALUES (?, ?, 'Section Persistence Test Class', 'active')`,
      [testClassId, testCourseId]
    );

    db.run(
      `INSERT OR REPLACE INTO assessment_classes (id, assessment_id, class_id)
       VALUES ('ac_test_14', ?, ?)`,
      [testAsm.id, testClassId]
    );

    db.run(
      `INSERT OR REPLACE INTO class_enrollments (id, user_id, class_id, status, enrolled_at)
       VALUES ('ce_test_14', ?, ?, 'active', datetime('now'))`,
      [studentUser.id, testClassId]
    );

    const attemptId = 'att_sec_pers_test_14';
    db.run(
      `INSERT OR REPLACE INTO student_attempts (id, user_id, assessment_id, class_id, attempt_number, status, started_at, deadline_at, score, max_score, percentage, completed_sections)
       VALUES (?, ?, ?, ?, 1, 'in_progress', datetime('now'), datetime('now', '+1 hour'), 8, 25, 32.0, ?)`,
      [attemptId, studentUser.id, testAsm.id, testClassId, JSON.stringify(['Section 1'])]
    );

    db.run(
      `INSERT INTO eduque_settings (id, key, value, updated_at)
       VALUES ('set_compsec_14', ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [`completed_sections_attempt_${attemptId}`, JSON.stringify(['Section 1'])]
    );

    // Initial check
    const progressRes1 = await req(`/api/instructor/progress?class_id=${testClassId}`, { token: adminToken });
    assert.equal(progressRes1.status, 200);

    const studentRec1 = progressRes1.data.students.find(s => s.id === studentUser.id);
    assert.ok(studentRec1, 'Student must be found in class roster');
    assert.equal(studentRec1.attempt_count, 1, 'Attempt count must be 1');
    assert.equal(studentRec1.status_label, 'In Progress', 'Status must be In Progress');
    assert.equal(studentRec1.best_score, 32.0, 'Best score must reflect completed section percentage');
    assert.equal(studentRec1.latest_score, 32.0, 'Latest score must reflect completed section percentage');

    const sec1 = studentRec1.section_breakdown.find(s => s.name === 'Section 1');
    assert.ok(sec1, 'Section 1 must be present in breakdown');
    assert.equal(sec1.is_completed, true, 'Section 1 must be marked completed');
    assert.equal(sec1.percentage, 32.0, 'Section 1 percentage must be 32%');

    // Simulate second refresh / subsequent poll
    const progressRes2 = await req(`/api/instructor/progress?class_id=${testClassId}`, { token: adminToken });
    assert.equal(progressRes2.status, 200);

    const studentRec2 = progressRes2.data.students.find(s => s.id === studentUser.id);
    assert.equal(studentRec2.attempt_count, 1, 'Attempt count must remain 1 after refresh');
    assert.equal(studentRec2.status_label, 'In Progress', 'Status must remain In Progress across refreshes');
    assert.equal(studentRec2.best_score, 32.0, 'Best score must not disappear');
    assert.equal(studentRec2.latest_score, 32.0, 'Latest score must not disappear');
  });

  await t.test('15. Question Weak Spots and Bank questions are sequentially numbered per section (Question 1 to N) matching delegate view', async () => {
    const progressRes = await req('/api/instructor/progress', { token: seededInstructorToken });
    assert.equal(progressRes.status, 200);
    const questions = progressRes.data.questions_analysis;
    assert.ok(Array.isArray(questions) && questions.length > 0, 'Must return questions array');

    // Group by section
    const bySection = new Map();
    questions.forEach(q => {
      const s = q.section_name || 'Section 1';
      if (!bySection.has(s)) bySection.set(s, []);
      bySection.get(s).push(q);
    });

    // Check each section starts at Question 1 and increments sequentially
    for (const [secName, secQuestions] of bySection.entries()) {
      for (let i = 0; i < secQuestions.length; i++) {
        assert.equal(
          secQuestions[i].question_number,
          i + 1,
          `In ${secName}, question at index ${i} must have question_number ${i + 1}`
        );
      }
    }
  });

  await t.test('16. Question mastery analytics uses best result per delegate: 1 delegate with multiple attempts shows 100% (1/1) not (2/3), and 4 delegates show 4/4 not 6/8', async () => {
    const db = getDatabase();
    const testClassId = 'cls_best_metric_test_16';
    const testCourseId = db.get('SELECT id FROM courses LIMIT 1').id;
    const testInstructor = db.get("SELECT id FROM users WHERE role = 'instructor' LIMIT 1");
    const testAsmId = 'asm_best_metric_16';
    const testQ1 = 'q_best_metric_16_1';
    const testQ2 = 'q_best_metric_16_2';

    db.run(
      `INSERT OR REPLACE INTO classes (id, course_id, instructor_id, name, status)
       VALUES (?, ?, ?, 'Delegate Best Metric Test Class', 'active')`,
      [testClassId, testCourseId, testInstructor.id]
    );

    db.run(
      `INSERT OR REPLACE INTO assessments (id, course_id, name, duration_minutes, pass_mark_percentage, status, sections)
       VALUES (?, ?, 'Metric Test Assessment', 60, 70, 'published', ?)`,
      [testAsmId, testCourseId, JSON.stringify(['Section 1'])]
    );

    db.run(
      `INSERT OR REPLACE INTO assessment_classes (id, assessment_id, class_id)
       VALUES ('ac_metric_16', ?, ?)`,
      [testAsmId, testClassId]
    );

    db.run(
      `INSERT OR REPLACE INTO questions (id, course_id, question_text, question_type, section_module, status, points, answer_options, correct_answer)
       VALUES (?, ?, 'Question 1 Best Metric Test', 'single_choice', 'Section 1', 'published', 1, '["A","B"]', '"A"')`,
      [testQ1, testCourseId]
    );
    db.run(
      `INSERT OR REPLACE INTO questions (id, course_id, question_text, question_type, section_module, status, points, answer_options, correct_answer)
       VALUES (?, ?, 'Question 2 Best Metric Test', 'single_choice', 'Section 1', 'published', 1, '["A","B"]', '"A"')`,
      [testQ2, testCourseId]
    );

    db.run(
      `INSERT OR REPLACE INTO assessment_questions (id, assessment_id, question_id, section_name, order_index)
       VALUES ('aq_metric_1', ?, ?, 'Section 1', 1)`,
      [testAsmId, testQ1]
    );
    db.run(
      `INSERT OR REPLACE INTO assessment_questions (id, assessment_id, question_id, section_name, order_index)
       VALUES ('aq_metric_2', ?, ?, 'Section 1', 2)`,
      [testAsmId, testQ2]
    );

    // Scenario A: 1 Delegate taking multiple attempts
    const userA = 'usr_metric_delegate_a';
    db.run(
      `INSERT OR REPLACE INTO users (id, first_name, surname, username, email, password_hash, role)
       VALUES (?, 'DelegateA', 'Single', 'del_a_16', 'del_a_16@test.com', 'hash', 'student')`,
      [userA]
    );
    db.run(
      `INSERT OR REPLACE INTO class_enrollments (id, user_id, class_id, status, enrolled_at)
       VALUES ('ce_metric_a', ?, ?, 'active', datetime('now'))`,
      [userA, testClassId]
    );

    // Attempt 1: Delegate A got Question 1 WRONG
    const attA1 = 'att_metric_a_1';
    db.run(
      `INSERT OR REPLACE INTO student_attempts (id, user_id, assessment_id, class_id, attempt_number, status, started_at, deadline_at)
       VALUES (?, ?, ?, ?, 1, 'marked', datetime('now', '-3 hours'), datetime('now', '-2 hours'))`,
      [attA1, userA, testAsmId, testClassId]
    );
    db.run(
      `INSERT OR REPLACE INTO attempt_answers (id, attempt_id, question_id, saved_answer, is_correct, section_name)
       VALUES ('aa_m_a1_q1', ?, ?, 'wrong', 0, 'Section 1')`,
      [attA1, testQ1]
    );

    // Check after Attempt 1: 0% and 0/1 correct
    let progressRes = await req(`/api/instructor/progress?class_id=${testClassId}`, { token: adminToken });
    assert.equal(progressRes.status, 200);
    let q1Analytic = progressRes.data.questions_analysis.find(q => q.id === testQ1);
    assert.ok(q1Analytic, 'Q1 must be found');
    assert.equal(q1Analytic.total_answers, 1, '1 delegate attempted');
    assert.equal(q1Analytic.correct_answers, 0, '0 delegates correct on attempt 1');
    assert.equal(q1Analytic.success_percentage, 0, 'Success percentage must be 0% on attempt 1');

    // Attempt 2: Delegate A got Question 1 RIGHT
    const attA2 = 'att_metric_a_2';
    db.run(
      `INSERT OR REPLACE INTO student_attempts (id, user_id, assessment_id, class_id, attempt_number, status, started_at, deadline_at)
       VALUES (?, ?, ?, ?, 2, 'marked', datetime('now', '-2 hours'), datetime('now', '-1 hour'))`,
      [attA2, userA, testAsmId, testClassId]
    );
    db.run(
      `INSERT OR REPLACE INTO attempt_answers (id, attempt_id, question_id, saved_answer, is_correct, section_name)
       VALUES ('aa_m_a2_q1', ?, ?, 'correct', 1, 'Section 1')`,
      [attA2, testQ1]
    );

    // Attempt 3: Delegate A got Question 1 RIGHT again
    const attA3 = 'att_metric_a_3';
    db.run(
      `INSERT OR REPLACE INTO student_attempts (id, user_id, assessment_id, class_id, attempt_number, status, started_at, deadline_at)
       VALUES (?, ?, ?, ?, 3, 'marked', datetime('now', '-1 hour'), datetime('now'))`,
      [attA3, userA, testAsmId, testClassId]
    );
    db.run(
      `INSERT OR REPLACE INTO attempt_answers (id, attempt_id, question_id, saved_answer, is_correct, section_name)
       VALUES ('aa_m_a3_q1', ?, ?, 'correct', 1, 'Section 1')`,
      [attA3, testQ1]
    );

    // Check after 3 attempts: Must show 100% and 1/1 correct (NOT 2/3 or 67%)
    progressRes = await req(`/api/instructor/progress?class_id=${testClassId}`, { token: adminToken });
    assert.equal(progressRes.status, 200);
    q1Analytic = progressRes.data.questions_analysis.find(q => q.id === testQ1);
    assert.equal(q1Analytic.total_answers, 1, '1 delegate attempted across all attempts');
    assert.equal(q1Analytic.correct_answers, 1, 'Best result for Delegate A is correct (1)');
    assert.equal(q1Analytic.success_percentage, 100, 'Success percentage must be 100% for 1 delegate who got it right in best attempt');

    // Scenario B: 4 delegates attending
    const users = ['usr_metric_del_1', 'usr_metric_del_2', 'usr_metric_del_3', 'usr_metric_del_4'];
    for (let i = 0; i < 4; i++) {
      db.run(
        `INSERT OR REPLACE INTO users (id, first_name, surname, username, email, password_hash, role)
         VALUES (?, ?, 'CohortLearner', ?, ?, 'hash', 'student')`,
        [users[i], `Learner${i + 1}`, `learner_${i + 1}_16`, `learner_${i + 1}_16@test.com`]
      );
      db.run(
        `INSERT OR REPLACE INTO class_enrollments (id, user_id, class_id, status, enrolled_at)
         VALUES (?, ?, ?, 'active', datetime('now'))`,
        [`ce_m_${i}`, users[i], testClassId]
      );
    }

    // Attempt 1: 2 got it correct, 2 got it wrong
    for (let i = 0; i < 4; i++) {
      const attId = `att_m_b1_${i}`;
      const isCorr = i < 2 ? 1 : 0; // Learners 0 & 1 correct, 2 & 3 wrong
      db.run(
        `INSERT OR REPLACE INTO student_attempts (id, user_id, assessment_id, class_id, attempt_number, status, started_at, deadline_at)
         VALUES (?, ?, ?, ?, 1, 'marked', datetime('now', '-2 hours'), datetime('now', '-1 hour'))`,
        [attId, users[i], testAsmId, testClassId]
      );
      db.run(
        `INSERT OR REPLACE INTO attempt_answers (id, attempt_id, question_id, saved_answer, is_correct, section_name)
         VALUES (?, ?, ?, 'ans', ?, 'Section 1')`,
        [`aa_m_b1_${i}`, attId, testQ2, isCorr]
      );
    }

    // Verify after Attempt 1: 2/4 correct (50%)
    progressRes = await req(`/api/instructor/progress?class_id=${testClassId}`, { token: adminToken });
    let q2Analytic = progressRes.data.questions_analysis.find(q => q.id === testQ2);
    assert.equal(q2Analytic.total_answers, 4, '4 delegates attempted');
    assert.equal(q2Analytic.correct_answers, 2, '2 delegates correct on attempt 1');
    assert.equal(q2Analytic.success_percentage, 50, 'Success percentage must be 50% (2/4 correct)');

    // Attempt 2: All 4 delegates get it right
    for (let i = 0; i < 4; i++) {
      const attId = `att_m_b2_${i}`;
      db.run(
        `INSERT OR REPLACE INTO student_attempts (id, user_id, assessment_id, class_id, attempt_number, status, started_at, deadline_at)
         VALUES (?, ?, ?, ?, 2, 'marked', datetime('now', '-1 hour'), datetime('now'))`,
        [attId, users[i], testAsmId, testClassId]
      );
      db.run(
        `INSERT OR REPLACE INTO attempt_answers (id, attempt_id, question_id, saved_answer, is_correct, section_name)
         VALUES (?, ?, ?, 'ans', 1, 'Section 1')`,
        [`aa_m_b2_${i}`, attId, testQ2]
      );
    }

    // Verify after Attempt 2: 4/4 correct (100%), NOT 6/8
    progressRes = await req(`/api/instructor/progress?class_id=${testClassId}`, { token: adminToken });
    q2Analytic = progressRes.data.questions_analysis.find(q => q.id === testQ2);
    assert.equal(q2Analytic.total_answers, 4, 'Total delegates attempted must be 4, NOT 8');
    assert.equal(q2Analytic.correct_answers, 4, 'All 4 delegates now got it correct in best attempt, NOT 6');
    assert.equal(q2Analytic.success_percentage, 100, 'Success percentage must be 100% (4/4 correct), NOT 75% (6/8)');
  });
});
