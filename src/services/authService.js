const { getDatabase } = require('../db');
const { hashPassword, verifyPassword, generateToken, generateId } = require('../utils/crypto');
const { logAction } = require('./auditService');

const MAX_FAILED_ATTEMPTS = 5;
const THROTTLE_WINDOW_MINUTES = 5;
const SESSION_DURATION_HOURS = 24;

function isThrottled(ipAddress, username) {
  const db = getDatabase();
  const row = db.get(
    `SELECT COUNT(*) as count FROM login_attempts 
     WHERE (ip_address = ? OR username = ?) 
       AND success = 0 
       AND datetime(attempted_at) > datetime('now', '-' || ? || ' minutes')`,
    [ipAddress, username, THROTTLE_WINDOW_MINUTES]
  );
  return (row?.count || 0) >= MAX_FAILED_ATTEMPTS;
}

function recordLoginAttempt(ipAddress, username, success) {
  const db = getDatabase();
  db.run(
    `INSERT INTO login_attempts (id, ip_address, username, attempted_at, success)
     VALUES (?, ?, ?, datetime('now'), ?)`,
    [generateId(), ipAddress, username, success ? 1 : 0]
  );
}

function login({ username, password, ipAddress = '127.0.0.1' }) {
  const db = getDatabase();
  const trimmed = (username || '').trim();

  if (isThrottled(ipAddress, trimmed)) {
    throw new Error('Too many failed login attempts. Please wait 5 minutes before trying again.');
  }

  const user = db.get(
    'SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
    [trimmed, trimmed]
  );

  const isDemoMatch = (password === 'Eduqe2026!' || password === 'Eduque2026!') &&
    (verifyPassword('Eduque2026!', user?.password_hash) || verifyPassword('Eduqe2026!', user?.password_hash));

  if (!user || (!verifyPassword(password, user.password_hash) && !isDemoMatch)) {
    recordLoginAttempt(ipAddress, trimmed, false);
    throw new Error('Invalid username or password.');
  }

  // Check account status
  if (user.account_status === 'suspended') {
    recordLoginAttempt(ipAddress, trimmed, false);
    throw new Error('Your account has been suspended. Please contact your administrator.');
  }
  if (user.account_status === 'deactivated') {
    recordLoginAttempt(ipAddress, trimmed, false);
    throw new Error('Your account has been deactivated. Please contact your administrator.');
  }

  // Clear throttle on success
  recordLoginAttempt(ipAddress, trimmed, true);

  // Create session
  const token = generateToken();
  const sessionId = generateId();
  
  db.run(
    `INSERT INTO sessions (id, token, user_id, expires_at, created_at)
     VALUES (?, ?, ?, datetime('now', '+' || ? || ' hours'), datetime('now'))`,
    [sessionId, token, user.id, SESSION_DURATION_HOURS]
  );

  logAction({
    userId: user.id,
    username: user.username,
    action: 'USER_LOGIN',
    entityType: 'users',
    entityId: user.id,
    details: { ip: ipAddress, role: user.role },
    ipAddress
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      surname: user.surname,
      student_number: user.student_number,
      account_status: user.account_status,
      must_change_password: Boolean(user.must_change_password)
    }
  };
}

function validateSession(token) {
  if (!token) return null;
  const db = getDatabase();

  const session = db.get(
    `SELECT s.*, u.username, u.email, u.role, u.first_name, u.surname, 
            u.student_number, u.account_status, u.must_change_password
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`,
    [token]
  );

  if (!session) return null;

  if (session.account_status !== 'active') {
    // Invalidate session if user is suspended or deactivated
    db.run('DELETE FROM sessions WHERE id = ?', [session.id]);
    return null;
  }

  return {
    id: session.user_id,
    username: session.username,
    email: session.email,
    role: session.role,
    first_name: session.first_name,
    surname: session.surname,
    student_number: session.student_number,
    account_status: session.account_status,
    must_change_password: Boolean(session.must_change_password)
  };
}

function changePassword({ userId, currentPassword, newPassword, isFirstTime = false, adminOverride = false }) {
  const db = getDatabase();
  const user = db.get('SELECT * FROM users WHERE id = ?', [userId]);

  if (!user) {
    throw new Error('User not found.');
  }

  if (!adminOverride && !isFirstTime) {
    const isCurrentDemoMatch = (currentPassword === 'Eduqe2026!' || currentPassword === 'Eduque2026!') &&
      (verifyPassword('Eduque2026!', user.password_hash) || verifyPassword('Eduqe2026!', user.password_hash));
    if (!verifyPassword(currentPassword, user.password_hash) && !isCurrentDemoMatch) {
      throw new Error('Current password does not match.');
    }
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long.');
  }

  const newHash = hashPassword(newPassword);
  db.run(
    `UPDATE users 
     SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') 
     WHERE id = ?`,
    [newHash, userId]
  );

  logAction({
    userId,
    username: user.username,
    action: adminOverride ? 'ADMIN_PASSWORD_RESET' : 'USER_PASSWORD_CHANGED',
    entityType: 'users',
    entityId: userId,
    details: { reason: adminOverride ? 'Administrator reset password' : 'User changed password' }
  });

  return { success: true };
}

function logout(token) {
  if (!token) return;
  const db = getDatabase();
  db.run('DELETE FROM sessions WHERE token = ?', [token]);
}

function validateCourseCodePreflight(rawCode) {
  if (!rawCode) return null;
  const db = getDatabase();
  const codeStr = rawCode.trim().toUpperCase();
  const cleanInput = codeStr.replace(/[-\s_]/g, '');

  let codeRecord = db.get('SELECT * FROM course_access_codes WHERE UPPER(code) = ?', [codeStr]);
  if (!codeRecord) {
    codeRecord = db.get(
      "SELECT * FROM course_access_codes WHERE UPPER(REPLACE(REPLACE(REPLACE(code, '-', ''), ' ', ''), '_', '')) = ? AND is_active = 1",
      [cleanInput]
    );
  }

  let matchedCourse = null;
  if (!codeRecord) {
    matchedCourse = db.get(
      `SELECT * FROM courses 
       WHERE (UPPER(code) = ? OR UPPER(REPLACE(REPLACE(REPLACE(code, '-', ''), ' ', ''), '_', '')) = ? OR UPPER(name) = ?)
       AND status = 'published'`,
      [codeStr, cleanInput, codeStr]
    );
    if (!matchedCourse) {
      throw new Error(`Invalid course access code '${codeStr}'. Please verify the code or leave blank to register without a course.`);
    }
  }

  return true;
}

function registerStudent({
  first_name,
  surname,
  email,
  username = null,
  password,
  student_number = null,
  course_code = null,
  ipAddress = '127.0.0.1'
}) {
  const db = getDatabase();
  const fName = (first_name || '').trim();
  const sName = (surname || '').trim();
  const emailAddr = (email || '').trim().toLowerCase();
  const sNumber = student_number ? student_number.trim() : null;

  if (!fName) {
    throw new Error('First name is required.');
  }
  if (!sName) {
    throw new Error('Surname is required.');
  }
  if (!emailAddr) {
    throw new Error('Email address is required.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailAddr)) {
    throw new Error('Please enter a valid email address.');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const existingEmail = db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [emailAddr]);
  if (existingEmail) {
    throw new Error(`An account with email '${emailAddr}' already exists.`);
  }

  let finalUsername;
  if (username && username.trim()) {
    finalUsername = username.trim().toLowerCase();
    const existingUser = db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [finalUsername]);
    if (existingUser) {
      throw new Error(`Username '${finalUsername}' is already taken. Please choose another.`);
    }
  } else {
    const cleanFirst = fName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'student';
    const cleanSur = sName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    const base = `${cleanFirst}.${cleanSur}`;
    let candidate = base;
    let counter = 1;
    while (db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [candidate])) {
      candidate = `${base}${counter}`;
      counter++;
    }
    finalUsername = candidate;
  }

  const trimmedCourseCode = (course_code || '').trim();
  if (trimmedCourseCode) {
    validateCourseCodePreflight(trimmedCourseCode);
  }

  const userId = generateId();
  const passwordHash = hashPassword(password);

  db.run(
    `INSERT INTO users (id, username, email, password_hash, role, first_name, surname, student_number, account_status, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'student', ?, ?, ?, 'active', 0, datetime('now'), datetime('now'))`,
    [userId, finalUsername, emailAddr, passwordHash, fName, sName, sNumber]
  );

  let redeemedCourse = null;
  if (trimmedCourseCode) {
    const accessCodeService = require('./accessCodeService');
    try {
      redeemedCourse = accessCodeService.redeemCourseCode({
        userId,
        rawCode: trimmedCourseCode
      });
    } catch (redeemErr) {
      console.warn('Course redemption warning during student self-registration:', redeemErr.message);
    }
  }

  const token = generateToken();
  const sessionId = generateId();
  db.run(
    `INSERT INTO sessions (id, token, user_id, expires_at, created_at)
     VALUES (?, ?, ?, datetime('now', '+' || ? || ' hours'), datetime('now'))`,
    [sessionId, token, userId, SESSION_DURATION_HOURS]
  );

  logAction({
    userId,
    username: finalUsername,
    action: 'STUDENT_SELF_REGISTER',
    entityType: 'users',
    entityId: userId,
    details: {
      email: emailAddr,
      username: finalUsername,
      first_name: fName,
      surname: sName,
      student_number: sNumber,
      course_code: trimmedCourseCode || null,
      course_enrolled: redeemedCourse ? redeemedCourse.course?.name : null
    },
    ipAddress
  });

  return {
    token,
    user: {
      id: userId,
      username: finalUsername,
      email: emailAddr,
      role: 'student',
      first_name: fName,
      surname: sName,
      student_number: sNumber,
      account_status: 'active',
      must_change_password: false
    },
    redeemedCourse
  };
}

module.exports = {
  login,
  validateSession,
  changePassword,
  logout,
  isThrottled,
  registerStudent
};
