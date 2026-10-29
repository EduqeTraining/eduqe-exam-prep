// End-to-End In-Process Integration Tests for Eduque Web Application

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');

const { initDatabase, setDatabaseInstance } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const { createServer } = require('../src/server');

test('End-to-End Application & HTTP API Integration', async (t) => {
  const db = initDatabase(':memory:');
  setDatabaseInstance(db);
  seedDatabase(':memory:');

  const server = createServer();
  // Get the request listener from http.Server
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

  await t.test('1. Static File Serving', async () => {
    const htmlRes = await req('/');
    assert.equal(htmlRes.status, 200);
    assert.ok(htmlRes.data.includes('Eduqe - Exam Preparation Platform'));
    assert.ok(htmlRes.data.includes('modal-change-password'));

    const cssRes = await req('/css/app.css');
    assert.equal(cssRes.status, 200);
    assert.ok(cssRes.data.includes('--primary'));

    const jsRes = await req('/js/app.js');
    assert.equal(jsRes.status, 200);
    assert.ok(jsRes.data.includes('Router'));
  });

  let adminToken = null;
  await t.test('2. Admin Authentication & Dashboard Data', async () => {
    const loginRes = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Admin2026!' }
    });

    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.data.token);
    assert.equal(loginRes.data.user.role, 'administrator');
    adminToken = loginRes.data.token;

    const dashRes = await req('/api/reports/dashboard', { token: adminToken });
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.summary.totalCourses >= 1);
    assert.ok(dashRes.data.summary.totalClasses >= 2);
    assert.ok(dashRes.data.summary.totalStudents >= 2);
  });

  let studentToken = null;
  await t.test('3. Student Login with Mandatory Password Change', async () => {
    const loginRes = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'alex.morgan', password: 'Eduque2026!' }
    });

    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.data.token);
    assert.ok(loginRes.data.user.must_change_password);
    studentToken = loginRes.data.token;

    // Change password
    const changeRes = await req('/api/auth/change-password', {
      method: 'POST',
      body: {
        current_password: 'Eduque2026!',
        new_password: 'AlexMorganSecurePass2026!'
      },
      token: studentToken
    });
    assert.equal(changeRes.status, 200);
    assert.equal(changeRes.data.success, true);

    // Verify login with new password
    const reLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'alex.morgan', password: 'AlexMorganSecurePass2026!' }
    });
    assert.equal(reLogin.status, 200);
    assert.equal(Boolean(reLogin.data.user.must_change_password), false);
    studentToken = reLogin.data.token;
  });

  await t.test('4. 10-Step Course Access Code Redemption Process', async () => {
    // Attempt invalid code
    const badCodeRes = await req('/api/student/redeem-code', {
      method: 'POST',
      body: { code: 'INVALID-CODE-999' },
      token: studentToken
    });
    assert.equal(badCodeRes.status, 400);
    assert.ok(badCodeRes.data.error.includes('Invalid'));

    // Redeem valid code AZ104-CENTURION-01
    const goodCodeRes = await req('/api/student/redeem-code', {
      method: 'POST',
      body: { code: 'AZ104-CENTURION-01' },
      token: studentToken
    });
    assert.equal(goodCodeRes.status, 200);
    assert.equal(goodCodeRes.data.success, true);
    assert.ok(goodCodeRes.data.course);
    assert.ok(goodCodeRes.data.class);
  });

  let assessmentId = null;
  let classId = null;
  await t.test('5. Student Dashboard & Assessment Launch', async () => {
    const dashRes = await req('/api/student/dashboard', { token: studentToken });
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.courses.length >= 1);
    assert.ok(dashRes.data.available_assessments.length >= 1);

    const targetAssessment = dashRes.data.available_assessments[0];
    assessmentId = targetAssessment.id;
    classId = targetAssessment.class_id;

    // Start Attempt
    const startRes = await req('/api/student/attempts/start', {
      method: 'POST',
      body: { assessment_id: assessmentId, class_id: classId },
      token: studentToken
    });
    assert.ok(startRes.status === 200 || startRes.status === 201);
    assert.ok(startRes.data.id);
    assert.ok(startRes.data.deadline_at);
    assert.ok(startRes.data.questions.length > 0);

    const attemptId = startRes.data.id;
    const firstQ = startRes.data.questions[0];

    // Autosave response
    const saveRes = await req(`/api/student/attempts/${attemptId}/autosave`, {
      method: 'POST',
      body: {
        question_id: firstQ.id,
        answer: firstQ.type === 'yes_no' ? 'yes' : ['choice_a'],
        time_spent_seconds: 35
      },
      token: studentToken
    });
    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.data.success, true);

    // Final Submit
    const submitRes = await req(`/api/student/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: { time_spent_seconds: 90 },
      token: studentToken
    });
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.data.status, 'marked');
    assert.ok(typeof submitRes.data.percentage === 'number');
    assert.ok(submitRes.data.is_passed !== undefined);
  });

  await t.test('6. Reporting & CSV Export', async () => {
    const reportRes = await req('/api/reports/assessments', { token: adminToken });
    assert.equal(reportRes.status, 200);
    assert.ok(Array.isArray(reportRes.data));

    const csvRes = await req('/api/reports/export?type=assessments', { token: adminToken });
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.data.includes('name') || csvRes.data.includes('course_name') || csvRes.data.includes('pass_mark'));
  });
});
