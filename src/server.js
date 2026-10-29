const http = require('node:http');
const url = require('node:url');
const path = require('node:path');
const fs = require('node:fs');

const { initDatabase, getDatabase } = require('./db');
const { seedDatabase } = require('./db/seed');
const authService = require('./services/authService');
const courseService = require('./services/courseService');
const accessCodeService = require('./services/accessCodeService');
const classService = require('./services/classService');
const studentService = require('./services/studentService');
const questionService = require('./services/questionService');
const poolService = require('./services/poolService');
const assessmentService = require('./services/assessmentService');
const attemptService = require('./services/attemptService');
const reportService = require('./services/reportService');
const auditService = require('./services/auditService');
const expirationRuleService = require('./services/expirationRuleService');
const instructorService = require('./services/instructorService');
const supabaseService = require('./services/supabaseService');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');
const PHOTOS_DIR = path.join(__dirname, '../Photos');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    // Handle pre-parsed bodies from serverless environments (e.g. Vercel)
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'object') return resolve(req.body);
      if (typeof req.body === 'string') {
        try {
          return resolve(JSON.parse(req.body));
        } catch (err) {
          return resolve({});
        }
      }
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function authenticateRequest(req) {
  const authHeader = req.headers['authorization'] || '';
  let token = null;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = req.headers['x-session-token'];
  }
  if (!token) return null;
  return authService.validateSession(token);
}

function requireAuth(req, res, requiredRole = null) {
  const user = authenticateRequest(req);
  if (!user) {
    sendJson(res, 401, { error: 'Authentication required. Please sign in.' });
    return null;
  }
  if (requiredRole && user.role !== requiredRole && user.role !== 'administrator') {
    sendJson(res, 403, { error: 'Access denied: You do not have permission to perform this action.' });
    return null;
  }
  return user;
}

function serveStatic(req, res, pathname) {
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') safePath = '/index.html';

  let filePath = path.join(PUBLIC_DIR, safePath);

  // Allow direct serving from root /Photos folder if not found in public
  if (!fs.existsSync(filePath) && safePath.replace(/\\/g, '/').toLowerCase().startsWith('/photos/')) {
    const relPhoto = safePath.replace(/^[\/\\]?photos[\/\\]/i, '');
    const candidate = path.join(PHOTOS_DIR, relPhoto);
    if (fs.existsSync(candidate)) {
      filePath = candidate;
    }
  }

  // If path has no extension and is not an API call, try .html or index.html
  if (!path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    } else {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // SPA fallback
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
    return true;
  }

  return false;
}

let isAppInitialized = false;

function ensureAppInitialized(dbPath = null) {
  if (!isAppInitialized) {
    try {
      initDatabase(dbPath);
      seedDatabase(dbPath);
    } catch (err) {
      console.warn('Database initialization warning:', err.message);
    }
    isAppInitialized = true;
  }
}

async function handleRequest(req, res) {
  ensureAppInitialized();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-Token'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let query = { ...parsedUrl.query, ...(req.query || {}) };
  let pathname = parsedUrl.pathname;

  // Support Vercel catch-all [...slug] or rewrites where route is passed in query or headers
  if (query.__route) {
    pathname = query.__route;
    delete query.__route;
  } else if (req.query && req.query.slug) {
    const slugPath = Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug;
    if (!pathname || pathname === '/api' || pathname === '/api/' || pathname.includes('[') || !pathname.startsWith('/api/')) {
      pathname = `/api/${slugPath}`;
    }
  } else if (req.headers['x-matched-path'] && req.headers['x-matched-path'].startsWith('/api')) {
    pathname = req.headers['x-matched-path'].split('?')[0];
  } else if (req.headers['x-forwarded-uri'] && req.headers['x-forwarded-uri'].startsWith('/api')) {
    pathname = req.headers['x-forwarded-uri'].split('?')[0];
  }

  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';

  try {
    // Health / readiness check
    if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/api')) {
      return sendJson(res, 200, {
        status: 'ok',
        platform: 'Eduqe Exam Preparation Platform',
        timestamp: new Date().toISOString()
      });
    }
      // -------------------------------------------------------------
      // 1. AUTHENTICATION ENDPOINTS
      // -------------------------------------------------------------
      if (req.method === 'POST' && pathname === '/api/auth/login') {
        const body = await parseBody(req);
        try {
          const result = authService.login({
            username: body.username,
            password: body.password,
            ipAddress: clientIp
          });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'POST' && pathname === '/api/auth/register') {
        const body = await parseBody(req);
        try {
          const result = authService.registerStudent({
            first_name: body.first_name,
            surname: body.surname,
            email: body.email,
            username: body.username,
            password: body.password,
            student_number: body.student_number,
            course_code: body.course_code,
            ipAddress: clientIp
          });
          if (result && result.user) {
            supabaseService.syncUserToSupabase(result.user).catch(() => {});
          }
          return sendJson(res, 201, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'POST' && pathname === '/api/auth/logout') {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer /, '').trim();
        authService.logout(token);
        return sendJson(res, 200, { success: true });
      }

      if (req.method === 'GET' && pathname === '/api/auth/me') {
        const user = requireAuth(req, res);
        if (!user) return;
        return sendJson(res, 200, { user });
      }

      if (req.method === 'POST' && pathname === '/api/auth/change-password') {
        const user = requireAuth(req, res);
        if (!user) return;
        const body = await parseBody(req);
        try {
          const result = authService.changePassword({
            userId: user.id,
            currentPassword: body.currentPassword || body.current_password,
            newPassword: body.newPassword || body.new_password,
            isFirstTime: Boolean(user.must_change_password)
          });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // -------------------------------------------------------------
      // 2. COURSE ACCESS CODES REDEMPTION (Student)
      // -------------------------------------------------------------
      if (req.method === 'POST' && pathname === '/api/student/redeem-code') {
        const user = requireAuth(req, res, 'student');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const result = accessCodeService.redeemCourseCode({
            userId: user.id,
            rawCode: body.code,
            targetClassId: body.class_id
          });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // -------------------------------------------------------------
      // 3. STUDENT DASHBOARD & ATTEMPTS
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/student/dashboard') {
        const user = requireAuth(req, res, 'student');
        if (!user) return;

        // Enforce rule: Purge questions and previous results for any expired certifications
        expirationRuleService.checkAndPurgeExpiredEnrollments({ userId: user.id });

        const student = studentService.getStudent(user.id);
        const availableAssessments = [];
        const completedAssessments = [];
        const db = getDatabase();

        // Check assessments for each enrolled class
        if (student?.enrollments) {
          for (const enroll of student.enrollments) {
            if (enroll.enrollment_status === 'active') {
              // Ensure class has an assessment if questions exist for this course
              accessCodeService.ensureClassAssessment(db, enroll.course_id, enroll.class_id, enroll.course_name, user.id);

              // Fetch questions available for this course
              const courseQuestions = db.all(
                `SELECT id, question_text, question_type, topic, difficulty, points 
                 FROM questions 
                 WHERE course_id = ? AND status = 'published'
                 ORDER BY created_at ASC`,
                [enroll.course_id]
              );
              enroll.available_questions = courseQuestions;

              const cls = classService.getClass(enroll.class_id);
              if (cls?.assessments) {
                for (const a of cls.assessments) {
                  const fullAssessment = assessmentService.getAssessment(a.id);
                  if (fullAssessment && fullAssessment.status === 'published') {
                    // Get attempts by this student for this assessment
                    const studentAttempts = student.attempts.filter(att => att.assessment_id === a.id);
                    const completedCount = studentAttempts.filter(att => att.status === 'marked' || att.status === 'submitted').length;
                    const inProgressAttempt = studentAttempts.find(att => att.status === 'in_progress');

                    const maxLimit = (fullAssessment.max_attempts !== null && fullAssessment.max_attempts !== undefined) ? Number(fullAssessment.max_attempts) : 0;
                    const isUnlimited = maxLimit <= 0;
                    const canRetake = isUnlimited || completedCount < maxLimit;

                    const itemData = {
                      id: fullAssessment.id,
                      name: fullAssessment.name,
                      description: fullAssessment.description,
                      course_name: enroll.course_name,
                      course_id: enroll.course_id,
                      class_name: enroll.class_name,
                      class_id: enroll.class_id,
                      duration_minutes: fullAssessment.duration_minutes,
                      pass_mark_percentage: fullAssessment.pass_mark_percentage,
                      question_count: fullAssessment.question_count || courseQuestions.length,
                      max_attempts: maxLimit,
                      is_unlimited: isUnlimited,
                      attempts_taken: completedCount,
                      in_progress_attempt_id: inProgressAttempt?.attempt_id || null,
                      available_from: fullAssessment.available_from,
                      available_to: fullAssessment.available_to,
                      is_available: true,
                      can_retake: canRetake,
                      available_questions: courseQuestions
                    };

                    availableAssessments.push(itemData);
                    if (!isUnlimited && completedCount >= maxLimit) {
                      completedAssessments.push(itemData);
                    }
                  }
                }
              }
            }
          }
        }

        return sendJson(res, 200, {
          student,
          courses: student.enrollments,
          available_assessments: availableAssessments,
          completed_assessments: completedAssessments,
          past_attempts: student.attempts || [],
          recent_results: student.attempts || []
        });
      }

      if (req.method === 'POST' && pathname === '/api/student/attempts/start') {
        const user = requireAuth(req, res, 'student');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const attemptState = attemptService.startAttempt({
            userId: user.id,
            assessmentId: body.assessment_id,
            classId: body.class_id,
            forceNew: Boolean(body.force_new || body.restart),
            submitExisting: Boolean(body.submit_existing)
          });
          return sendJson(res, 200, attemptState);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const attemptMatch = pathname.match(/^\/api\/student\/attempts\/([^\/]+)$/);
      if (req.method === 'GET' && attemptMatch) {
        const user = requireAuth(req, res);
        if (!user) return;
        const attemptId = attemptMatch[1];
        try {
          const state = attemptService.getAttemptState(attemptId, user.id);
          return sendJson(res, 200, state);
        } catch (err) {
          return sendJson(res, 403, { error: err.message });
        }
      }

      const autosaveMatch = pathname.match(/^\/api\/student\/attempts\/([^\/]+)\/autosave$/);
      if (req.method === 'POST' && autosaveMatch) {
        const user = requireAuth(req, res, 'student');
        if (!user) return;
        const attemptId = autosaveMatch[1];
        const body = await parseBody(req);
        try {
          const result = attemptService.autosaveAnswer({
            attemptId,
            userId: user.id,
            questionId: body.question_id,
            savedAnswer: body.saved_answer,
            isFlagged: body.is_flagged
          });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const submitMatch = pathname.match(/^\/api\/student\/attempts\/([^\/]+)\/(submit|end)$/);
      if (req.method === 'POST' && submitMatch) {
        const user = requireAuth(req, res, 'student');
        if (!user) return;
        const attemptId = submitMatch[1];
        try {
          const result = attemptService.submitAttempt({
            attemptId,
            userId: user.id,
            isAuto: false
          });
          supabaseService.syncAttemptToSupabase(attemptId).catch(() => {});
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const restartMatch = pathname.match(/^\/api\/student\/attempts\/([^\/]+)\/restart$/);
      if (req.method === 'POST' && restartMatch) {
        const user = requireAuth(req, res, 'student');
        if (!user) return;
        const attemptId = restartMatch[1];
        const body = await parseBody(req);
        try {
          const result = attemptService.restartAttempt({
            attemptId,
            userId: user.id,
            assessmentId: body.assessment_id || null,
            classId: body.class_id || null,
            submitExisting: Boolean(body.submit_existing)
          });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // -------------------------------------------------------------
      // 4. COURSES (Admin)
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/courses') {
        const courses = courseService.listCourses({
          query: query.q || query.query || '',
          status: query.status || '',
          subject: query.subject || '',
          learning_track: query.learning_track || ''
        });
        return sendJson(res, 200, courses);
      }

      const courseIdMatch = pathname.match(/^\/api\/courses\/([^\/]+)$/);
      if (req.method === 'GET' && courseIdMatch) {
        const course = courseService.getCourse(courseIdMatch[1]);
        if (!course) return sendJson(res, 404, { error: 'Course not found' });
        return sendJson(res, 200, course);
      }

      if (req.method === 'POST' && pathname === '/api/courses') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const created = courseService.createCourse({
            ...body,
            adminUserId: user.id,
            adminUsername: user.username
          });
          return sendJson(res, 201, created);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'PUT' && courseIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = courseService.updateCourse(courseIdMatch[1], body, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'DELETE' && courseIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        try {
          const result = courseService.deleteCourse(courseIdMatch[1], user.id, user.username);
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const courseDupMatch = pathname.match(/^\/api\/courses\/([^\/]+)\/duplicate$/);
      if (req.method === 'POST' && courseDupMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const dup = courseService.duplicateCourse(courseDupMatch[1], body.name, body.code, user.id, user.username);
          return sendJson(res, 201, dup);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const courseStatusMatch = pathname.match(/^\/api\/courses\/([^\/]+)\/status$/);
      if (req.method === 'POST' && courseStatusMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = courseService.setCourseStatus(courseStatusMatch[1], body.status, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Course Access Code management
      const courseCodesMatch = pathname.match(/^\/api\/courses\/([^\/]+)\/codes$/);
      if (req.method === 'GET' && courseCodesMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const codes = accessCodeService.listCodesForCourse(courseCodesMatch[1]);
        return sendJson(res, 200, codes);
      }

      if (req.method === 'POST' && courseCodesMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const created = accessCodeService.createCode({
            courseId: courseCodesMatch[1],
            code: body.code,
            expiresAt: body.expires_at,
            maxUses: body.max_uses,
            adminUserId: user.id,
            adminUsername: user.username
          });
          return sendJson(res, 201, created);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const codeReplaceMatch = pathname.match(/^\/api\/courses\/codes\/([^\/]+)\/replace$/);
      if (req.method === 'POST' && codeReplaceMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const rep = accessCodeService.replaceCode({
            oldCodeId: codeReplaceMatch[1],
            newCode: body.new_code,
            adminUserId: user.id,
            adminUsername: user.username,
            reason: body.reason
          });
          return sendJson(res, 200, rep);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const codeStatusMatch = pathname.match(/^\/api\/courses\/codes\/([^\/]+)\/status$/);
      if (req.method === 'PUT' && codeStatusMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = accessCodeService.setCodeStatus(codeStatusMatch[1], body.is_active, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // -------------------------------------------------------------
      // 5. CLASSES (Multiple Classes per Course)
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/classes') {
        const classes = classService.listClasses(query.course_id || null);
        return sendJson(res, 200, classes);
      }

      const classIdMatch = pathname.match(/^\/api\/classes\/([^\/]+)$/);
      if (req.method === 'GET' && classIdMatch) {
        const cls = classService.getClass(classIdMatch[1]);
        if (!cls) return sendJson(res, 404, { error: 'Class not found' });
        return sendJson(res, 200, cls);
      }

      if (req.method === 'POST' && pathname === '/api/classes') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const created = classService.createClass({
            ...body,
            courseId: body.course_id,
            adminUserId: user.id,
            adminUsername: user.username
          });
          return sendJson(res, 201, created);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'PUT' && classIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = classService.updateClass(classIdMatch[1], body, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'DELETE' && classIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        try {
          const result = classService.deleteClass(classIdMatch[1], user.id, user.username);
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const classDupMatch = pathname.match(/^\/api\/classes\/([^\/]+)\/duplicate$/);
      if (req.method === 'POST' && classDupMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const dup = classService.duplicateClass(classDupMatch[1], body.name, body.copy_assessments !== false, user.id, user.username);
          return sendJson(res, 201, dup);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Class Access Code management
      const classCodesMatch = pathname.match(/^\/api\/classes\/([^\/]+)\/codes$/);
      if (req.method === 'GET' && classCodesMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const codes = accessCodeService.listCodesForClass(classCodesMatch[1]);
        return sendJson(res, 200, codes);
      }

      if (req.method === 'POST' && classCodesMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const created = accessCodeService.createCode({
            classId: classCodesMatch[1],
            code: body.code,
            expiresAt: body.expires_at,
            maxUses: body.max_uses,
            adminUserId: user.id,
            adminUsername: user.username
          });
          return sendJson(res, 201, created);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const classCodeReplaceMatch = pathname.match(/^\/api\/classes\/codes\/([^\/]+)\/replace$/);
      if (req.method === 'POST' && classCodeReplaceMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const rep = accessCodeService.replaceCode({
            oldCodeId: classCodeReplaceMatch[1],
            newCode: body.new_code,
            adminUserId: user.id,
            adminUsername: user.username,
            reason: body.reason
          });
          return sendJson(res, 200, rep);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const classCodeStatusMatch = pathname.match(/^\/api\/classes\/codes\/([^\/]+)\/status$/);
      if (req.method === 'PUT' && classCodeStatusMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = accessCodeService.setCodeStatus(classCodeStatusMatch[1], body.is_active, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const classCodeUpdateMatch = pathname.match(/^\/api\/classes\/codes\/([^\/]+)$/);
      if (req.method === 'PUT' && classCodeUpdateMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = accessCodeService.updateCode(classCodeUpdateMatch[1], body, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Class Student Enrollment Operations
      const classEnrollMatch = pathname.match(/^\/api\/classes\/([^\/]+)\/students$/);
      if (req.method === 'POST' && classEnrollMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const resEnroll = classService.enrollStudent(classEnrollMatch[1], body.user_id, body.access_dates || {}, user.id, user.username);
          return sendJson(res, 200, resEnroll);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const classRemoveStudentMatch = pathname.match(/^\/api\/classes\/([^\/]+)\/students\/([^\/]+)$/);
      if (req.method === 'DELETE' && classRemoveStudentMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const [_, cId, uId] = classRemoveStudentMatch;
        classService.removeStudent(cId, uId, user.id, user.username);
        return sendJson(res, 200, { success: true });
      }

      const classMoveStudentMatch = pathname.match(/^\/api\/classes\/([^\/]+)\/students\/([^\/]+)\/move$/);
      if (req.method === 'POST' && classMoveStudentMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const [_, cId, uId] = classMoveStudentMatch;
        const body = await parseBody(req);
        try {
          classService.moveStudent(cId, body.to_class_id, uId, user.id, user.username);
          return sendJson(res, 200, { success: true });
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const classCopyStudentMatch = pathname.match(/^\/api\/classes\/([^\/]+)\/students\/([^\/]+)\/copy$/);
      if (req.method === 'POST' && classCopyStudentMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const [_, cId, uId] = classCopyStudentMatch;
        const body = await parseBody(req);
        try {
          classService.copyStudent(body.to_class_id, uId, user.id, user.username);
          return sendJson(res, 200, { success: true });
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Expire Student Enrollment and Purge Questions/Results (Rule Enforcement)
      const classExpireStudentMatch = pathname.match(/^\/api\/classes\/([^\/]+)\/students\/([^\/]+)\/expire$/);
      if (req.method === 'POST' && classExpireStudentMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const [_, cId, uId] = classExpireStudentMatch;
        const enroll = getDatabase().get('SELECT id FROM class_enrollments WHERE class_id = ? AND user_id = ?', [cId, uId]);
        if (!enroll) return sendJson(res, 404, { error: 'Enrollment not found.' });
        try {
          const result = expirationRuleService.expireEnrollmentAndPurge(enroll.id, user.id, user.username);
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Enforce Expiration Rule across all students
      if (req.method === 'POST' && pathname === '/api/admin/enforce-expiration-rule') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const purged = expirationRuleService.checkAndPurgeExpiredEnrollments({
          adminUserId: user.id,
          adminUsername: user.username
        });
        return sendJson(res, 200, { success: true, count: purged.length, purged });
      }

      // Assign/Remove Assessment to Class
      const classAssessMatch = pathname.match(/^\/api\/classes\/([^\/]+)\/assessments$/);
      if (req.method === 'POST' && classAssessMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        const resAssign = classService.assignAssessmentToClass(body.assessment_id, classAssessMatch[1], user.id, user.username);
        return sendJson(res, 200, resAssign);
      }

      const classRemoveAssessMatch = pathname.match(/^\/api\/classes\/([^\/]+)\/assessments\/([^\/]+)$/);
      if (req.method === 'DELETE' && classRemoveAssessMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const [_, cId, aId] = classRemoveAssessMatch;
        classService.removeAssessmentFromClass(aId, cId, user.id, user.username);
        return sendJson(res, 200, { success: true });
      }

      // -------------------------------------------------------------
      // 6. STUDENTS MANAGEMENT
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/students') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const students = studentService.listStudents({
          query: query.q || '',
          account_status: query.account_status || '',
          class_id: query.class_id || '',
          course_id: query.course_id || ''
        });
        return sendJson(res, 200, students);
      }

      const studentIdMatch = pathname.match(/^\/api\/students\/([^\/]+)$/);
      if (req.method === 'GET' && studentIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const stu = studentService.getStudent(studentIdMatch[1]);
        if (!stu) return sendJson(res, 404, { error: 'Student not found' });
        return sendJson(res, 200, stu);
      }

      if (req.method === 'POST' && pathname === '/api/students') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const result = studentService.createStudent({
            ...body,
            adminUserId: user.id,
            adminUsername: user.username
          });
          return sendJson(res, 201, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'PUT' && studentIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = studentService.updateStudent(studentIdMatch[1], body, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const studentResetPwdMatch = pathname.match(/^\/api\/students\/([^\/]+)\/reset-password$/);
      if (req.method === 'POST' && studentResetPwdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const resPwd = studentService.resetStudentPassword(studentResetPwdMatch[1], body.temporary_password, user.id, user.username);
          return sendJson(res, 200, resPwd);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const studentStatusMatch = pathname.match(/^\/api\/students\/([^\/]+)\/status$/);
      if (req.method === 'POST' && studentStatusMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = studentService.setStudentStatus(studentStatusMatch[1], body.status, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // -------------------------------------------------------------
      // 6b. INSTRUCTORS MANAGEMENT & INSTRUCTOR PORTAL
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/instructors') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const instructors = instructorService.listInstructors({
          query: query.q || '',
          status: query.status || ''
        });
        return sendJson(res, 200, instructors);
      }

      const instructorIdMatch = pathname.match(/^\/api\/instructors\/([^\/]+)$/);
      if (req.method === 'GET' && instructorIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const inst = instructorService.getInstructor(instructorIdMatch[1]);
        if (!inst) return sendJson(res, 404, { error: 'Instructor not found' });
        return sendJson(res, 200, inst);
      }

      if (req.method === 'POST' && pathname === '/api/instructors') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const result = instructorService.createInstructor({
            ...body,
            adminUserId: user.id,
            adminUsername: user.username
          });
          return sendJson(res, 201, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'PUT' && instructorIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = instructorService.updateInstructor(instructorIdMatch[1], body, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'DELETE' && instructorIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        try {
          const result = instructorService.deleteInstructor(instructorIdMatch[1], user.id, user.username);
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Instructor's own assigned classes
      if (req.method === 'GET' && pathname === '/api/instructor/classes') {
        const user = requireAuth(req, res);
        if (!user) return;
        if (user.role !== 'instructor' && user.role !== 'administrator') {
          return sendJson(res, 403, { error: 'Access denied: Instructor or administrator portal only.' });
        }
        const classes = classService.listClassesForInstructor(user.id);
        return sendJson(res, 200, classes);
      }

      // Instructor's class progress & analytics
      if (req.method === 'GET' && pathname === '/api/instructor/progress') {
        const user = requireAuth(req, res);
        if (!user) return;
        if (user.role !== 'instructor' && user.role !== 'administrator') {
          return sendJson(res, 403, { error: 'Access denied: Instructor or administrator portal only.' });
        }
        try {
          const targetInstructorId = user.role === 'administrator' ? (query.instructor_id || null) : user.id;
          const progress = instructorService.getInstructorClassProgress(targetInstructorId, query.class_id || null);
          return sendJson(res, 200, progress);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Export class progress CSV
      if (req.method === 'GET' && pathname === '/api/instructor/export-class') {
        const user = requireAuth(req, res);
        if (!user) return;
        if (user.role !== 'instructor' && user.role !== 'administrator') {
          return sendJson(res, 403, { error: 'Access denied: Instructor portal only.' });
        }
        try {
          const targetInstructorId = user.role === 'administrator' ? (query.instructor_id || null) : user.id;
          const csv = instructorService.exportClassReport(targetInstructorId, query.class_id || null);
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="class_progress_${query.class_id || 'report'}.csv"`,
            'Access-Control-Allow-Origin': '*'
          });
          return res.end(csv);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'POST' && pathname === '/api/students/import') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        const rows = Array.isArray(body) ? body : (body.students || []);
        const results = studentService.importStudents(rows, {
          defaultClassId: body.default_class_id,
          adminUserId: user.id,
          adminUsername: user.username
        });
        return sendJson(res, 200, results);
      }

      // -------------------------------------------------------------
      // 7. QUESTION BANK & QUESTIONS
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/questions') {
        const questions = questionService.listQuestions({
          course_id: query.course_id || '',
          assessment_id: query.assessment_id || '',
          question_type: query.question_type || '',
          topic: query.topic || '',
          difficulty: query.difficulty || '',
          status: query.status || '',
          search: query.q || query.search || '',
          tags: query.tags || ''
        });
        return sendJson(res, 200, questions);
      }

      const questionIdMatch = pathname.match(/^\/api\/questions\/([^\/]+)$/);
      if (req.method === 'GET' && questionIdMatch) {
        const q = questionService.getQuestion(questionIdMatch[1]);
        if (!q) return sendJson(res, 404, { error: 'Question not found' });
        return sendJson(res, 200, q);
      }

      if (req.method === 'POST' && pathname === '/api/questions') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const created = questionService.createQuestion({
            ...body,
            adminUserId: user.id,
            adminUsername: user.username
          });
          return sendJson(res, 201, created);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'PUT' && questionIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = questionService.updateQuestion(questionIdMatch[1], body.data || body, {
            versionMode: body.version_mode || 'future_only',
            changeReason: body.change_reason || 'Correction',
            adminUserId: user.id,
            adminUsername: user.username
          });
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const qDuplicateMatch = pathname.match(/^\/api\/questions\/([^\/]+)\/duplicate$/);
      if (req.method === 'POST' && qDuplicateMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        try {
          const dup = questionService.duplicateQuestion(qDuplicateMatch[1], user.id, user.username);
          return sendJson(res, 201, dup);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'DELETE' && questionIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        try {
          questionService.deleteQuestion(questionIdMatch[1], user.id, user.username);
          return sendJson(res, 200, { success: true });
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Bulk Delete Questions
      if ((req.method === 'POST' && pathname === '/api/questions/bulk-delete') || (req.method === 'DELETE' && pathname === '/api/questions')) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        const ids = body.question_ids || body.ids || [];
        if (!Array.isArray(ids) || ids.length === 0) {
          return sendJson(res, 400, { error: 'Please provide question_ids array to delete.' });
        }
        try {
          const result = questionService.deleteQuestions(ids, user.id, user.username, { force: body.force !== false });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'POST' && pathname === '/api/questions/import') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        const items = Array.isArray(body) ? body : (body.questions || []);
        const result = questionService.importQuestions(items, {
          courseId: body.course_id,
          adminUserId: user.id,
          adminUsername: user.username
        });

        // If imported for a specific course, also link imported questions to existing course assessments
        if (body.course_id && body.auto_add_to_assessment !== false && result.imported?.length > 0) {
          const courseAssessments = getDatabase().all('SELECT id FROM assessments WHERE course_id = ?', [body.course_id]);
          for (const assess of courseAssessments) {
            for (const q of result.imported) {
              assessmentService.addQuestionToAssessment(assess.id, q.id, {}, user.id, user.username);
            }
          }
        }

        return sendJson(res, 200, result);
      }

      // -------------------------------------------------------------
      // 8. QUESTION POOLS
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/pools') {
        const pools = poolService.listPools(query.course_id || null);
        return sendJson(res, 200, pools);
      }

      const poolIdMatch = pathname.match(/^\/api\/pools\/([^\/]+)$/);
      if (req.method === 'GET' && poolIdMatch) {
        const p = poolService.getPool(poolIdMatch[1]);
        if (!p) return sendJson(res, 404, { error: 'Pool not found' });
        return sendJson(res, 200, p);
      }

      if (req.method === 'DELETE' && poolIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        try {
          const result = poolService.deletePool(poolIdMatch[1], user.id, user.username);
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'POST' && pathname === '/api/pools') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const created = poolService.createPool({
            ...body,
            courseId: body.course_id,
            adminUserId: user.id,
            adminUsername: user.username
          });
          return sendJson(res, 201, created);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const poolAddQMatch = pathname.match(/^\/api\/pools\/([^\/]+)\/questions$/);
      if (req.method === 'POST' && poolAddQMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        const resAdd = poolService.addQuestionToPool(poolAddQMatch[1], body.question_id);
        return sendJson(res, 200, resAdd);
      }

      const poolRemoveQMatch = pathname.match(/^\/api\/pools\/([^\/]+)\/questions\/([^\/]+)$/);
      if (req.method === 'DELETE' && poolRemoveQMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        poolService.removeQuestionFromPool(poolRemoveQMatch[1], poolRemoveQMatch[2]);
        return sendJson(res, 200, { success: true });
      }

      // -------------------------------------------------------------
      // 9. ASSESSMENTS & ASSESSMENT BUILDER
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/assessments') {
        const assessments = assessmentService.listAssessments({
          course_id: query.course_id || '',
          status: query.status || '',
          class_id: query.class_id || '',
          search: query.q || ''
        });
        return sendJson(res, 200, assessments);
      }

      const assessIdMatch = pathname.match(/^\/api\/assessments\/([^\/]+)$/);
      if (req.method === 'GET' && assessIdMatch) {
        const a = assessmentService.getAssessment(assessIdMatch[1]);
        if (!a) return sendJson(res, 404, { error: 'Assessment not found' });
        return sendJson(res, 200, a);
      }

      if (req.method === 'POST' && pathname === '/api/assessments') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const created = assessmentService.createAssessment({
            ...body,
            course_id: body.course_id,
            adminUserId: user.id,
            adminUsername: user.username
          });
          return sendJson(res, 201, created);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      if (req.method === 'PUT' && assessIdMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = assessmentService.updateAssessment(assessIdMatch[1], body, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const assessDupMatch = pathname.match(/^\/api\/assessments\/([^\/]+)\/duplicate$/);
      if (req.method === 'POST' && assessDupMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const dup = assessmentService.duplicateAssessment(assessDupMatch[1], body.name, user.id, user.username);
          return sendJson(res, 201, dup);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      const assessStatusMatch = pathname.match(/^\/api\/assessments\/([^\/]+)\/status$/);
      if (req.method === 'POST' && assessStatusMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = assessmentService.setAssessmentStatus(assessStatusMatch[1], body.status, user.id, user.username);
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Add existing question to assessment
      const assessAddQMatch = pathname.match(/^\/api\/assessments\/([^\/]+)\/questions$/);
      if (req.method === 'POST' && assessAddQMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const resAdd = assessmentService.addQuestionToAssessment(assessAddQMatch[1], body.question_id, {
            sectionName: body.section_name || 'Section 1',
            pointsOverride: body.points_override
          }, user.id, user.username);
          return sendJson(res, 200, resAdd);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Create new question inline from inside Assessment Builder (Rule 7 & 12)
      const assessCreateQMatch = pathname.match(/^\/api\/assessments\/([^\/]+)\/questions\/new$/);
      if (req.method === 'POST' && assessCreateQMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const resCreate = assessmentService.createQuestionInAssessment(assessCreateQMatch[1], body.question, {
            sectionName: body.section_name || 'Section 1',
            pointsOverride: body.points_override
          }, user.id, user.username);
          return sendJson(res, 201, resCreate);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // Reorder questions in assessment
      const assessReorderMatch = pathname.match(/^\/api\/assessments\/([^\/]+)\/reorder$/);
      if (req.method === 'POST' && assessReorderMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        assessmentService.reorderAssessmentQuestions(assessReorderMatch[1], body.ordered_ids || []);
        return sendJson(res, 200, { success: true });
      }

      // Remove question from assessment
      const assessRemoveQMatch = pathname.match(/^\/api\/assessments\/(?:[^\/]+\/)?questions\/([^\/]+)$/);
      if (req.method === 'DELETE' && assessRemoveQMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        assessmentService.removeQuestionFromAssessment(assessRemoveQMatch[1], user.id, user.username);
        return sendJson(res, 200, { success: true });
      }

      // Add pool to assessment
      const assessAddPoolMatch = pathname.match(/^\/api\/assessments\/([^\/]+)\/pools$/);
      if (req.method === 'POST' && assessAddPoolMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const resPool = assessmentService.addPoolToAssessment(assessAddPoolMatch[1], body.pool_id, {
            sectionName: body.section_name || 'Section 1'
          }, user.id, user.username);
          return sendJson(res, 200, resPool);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // -------------------------------------------------------------
      // 10. ATTEMPT REVIEWS & RECALCULATION (Admin)
      // -------------------------------------------------------------
      const adminRecalcMatch = pathname.match(/^\/api\/admin\/attempts\/([^\/]+)\/recalculate$/);
      if (req.method === 'POST' && adminRecalcMatch) {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          const updated = attemptService.recalculateAttemptScore(
            adminRecalcMatch[1],
            body.reason || 'Answer key correction recalculation',
            user.id,
            user.username
          );
          return sendJson(res, 200, updated);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // -------------------------------------------------------------
      // 11. REPORTS & EXPORTS
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/reports/dashboard') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const metrics = reportService.getDashboardMetrics();
        return sendJson(res, 200, metrics);
      }

      if (req.method === 'GET' && pathname === '/api/reports/assessments') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const data = reportService.getAssessmentReport(query.assessment_id || null);
        return sendJson(res, 200, data);
      }

      if (req.method === 'GET' && pathname === '/api/reports/courses') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const data = reportService.getCourseReport(query.course_id || null);
        return sendJson(res, 200, data);
      }

      if (req.method === 'GET' && pathname === '/api/reports/classes') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const data = reportService.getClassReport(query.class_id || null);
        return sendJson(res, 200, data);
      }

      if (req.method === 'GET' && pathname === '/api/reports/students') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const data = reportService.getStudentReport(query.user_id || null);
        return sendJson(res, 200, data);
      }

      if (req.method === 'GET' && pathname === '/api/reports/topics') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const data = reportService.getTopicReport();
        return sendJson(res, 200, data);
      }

      if (req.method === 'GET' && pathname === '/api/reports/export') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const reportType = query.type || 'dashboard';

        let data = [];
        let name = reportType;
        if (reportType === 'assessments') {
          data = reportService.getAssessmentReport();
          name = 'assessments_report';
        } else if (reportType === 'courses') {
          data = reportService.getCourseReport();
          name = 'courses_report';
        } else if (reportType === 'classes') {
          data = reportService.getClassReport();
          name = 'classes_report';
        } else if (reportType === 'students') {
          data = reportService.getStudentReport();
          name = 'students_report';
        } else if (reportType === 'topics') {
          data = reportService.getTopicReport();
          name = 'topics_report';
        }

        const csv = reportService.exportToCsv(data, null, name, user.id, user.username);
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${name}_${Date.now()}.csv"`
        });
        return res.end(csv);
      }

      // -------------------------------------------------------------
      // 12. AUDIT LOGS
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/audit-logs') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const logs = auditService.listLogs({
          entityType: query.entity_type,
          entityId: query.entity_id,
          userId: query.user_id,
          limit: parseInt(query.limit || '100', 10),
          offset: parseInt(query.offset || '0', 10)
        });
        return sendJson(res, 200, logs);
      }

      // -------------------------------------------------------------
      // 13. SUPABASE INTEGRATION ENDPOINTS
      // -------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/supabase/status') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const status = await supabaseService.testSupabaseConnection();
        return sendJson(res, 200, status);
      }

      if (req.method === 'POST' && pathname === '/api/supabase/sync') {
        const user = requireAuth(req, res, 'administrator');
        if (!user) return;
        const body = await parseBody(req);
        try {
          let result;
          if (body.action === 'pull') {
            result = await supabaseService.pullFromSupabase();
          } else {
            result = await supabaseService.pushAllToSupabase();
          }
          return sendJson(res, 200, { success: true, result });
        } catch (err) {
          return sendJson(res, 500, { error: err.message });
        }
      }

      // -------------------------------------------------------------
      // 14. STATIC FRONTEND SERVING
      // -------------------------------------------------------------
      const served = serveStatic(req, res, pathname);
      if (served) return;

      // 404 for unmatched API routes
      if (pathname.startsWith('/api/')) {
        return sendJson(res, 404, { error: `Endpoint ${req.method} ${pathname} not found.` });
      }

      return sendText(res, 404, 'Not Found');
    } catch (error) {
      console.error('Unhandled server error:', error);
      return sendJson(res, 500, { error: 'Internal server error', message: error.message });
    }
}

function createServer() {
  return http.createServer(handleRequest);
}

function startServer(port = PORT, dbPath = null) {
  ensureAppInitialized(dbPath);

  const server = createServer();
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Eduqe server running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer();
}

handleRequest.createServer = createServer;
handleRequest.startServer = startServer;
handleRequest.handleRequest = handleRequest;
handleRequest.ensureAppInitialized = ensureAppInitialized;

module.exports = handleRequest;
