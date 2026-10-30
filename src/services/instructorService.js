const { getDatabase } = require('../db');
const { hashPassword, generateTemporaryPassword, generateId } = require('../utils/crypto');
const { logAction } = require('./auditService');
const { parseStoredSections, DEFAULT_SECTIONS } = require('./assessmentService');
const { evaluateQuestion } = require('./scoringService');

function isAnswerProvided(rawSavedAnswer) {
  if (rawSavedAnswer === null || rawSavedAnswer === undefined || rawSavedAnswer === '') return false;
  let parsed = rawSavedAnswer;
  if (typeof rawSavedAnswer === 'string') {
    try {
      parsed = JSON.parse(rawSavedAnswer);
    } catch (e) {
      return rawSavedAnswer.trim().length > 0;
    }
  }
  if (parsed === null || parsed === undefined || parsed === '') return false;
  if (Array.isArray(parsed)) return parsed.length > 0;
  if (typeof parsed === 'object') return Object.keys(parsed).length > 0;
  return true;
}

function generateUsername(firstName, surname) {
  const cleanFirst = (firstName || 'instructor').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanSur = (surname || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = `${cleanFirst}.${cleanSur}`;
  const db = getDatabase();

  let candidate = base;
  let counter = 1;
  while (db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [candidate])) {
    candidate = `${base}${counter}`;
    counter++;
  }
  return candidate;
}

function listInstructors({ query = null, status = null } = {}) {
  const db = getDatabase();
  let sql = `
    SELECT u.id, u.username, u.email, u.first_name, u.surname, u.student_number, u.account_status, u.created_at,
           (SELECT COUNT(*) FROM classes WHERE instructor_id = u.id) as assigned_class_count,
           (SELECT COUNT(DISTINCT ce.user_id) 
            FROM classes cl 
            JOIN class_enrollments ce ON ce.class_id = cl.id 
            WHERE cl.instructor_id = u.id AND ce.status = 'active') as total_student_count
    FROM users u
    WHERE u.role = 'instructor'
  `;
  const params = [];

  if (status) {
    sql += ' AND u.account_status = ?';
    params.push(status);
  }

  if (query) {
    sql += ' AND (LOWER(u.first_name) LIKE ? OR LOWER(u.surname) LIKE ? OR LOWER(u.username) LIKE ? OR LOWER(u.email) LIKE ?)';
    const q = `%${query.toLowerCase()}%`;
    params.push(q, q, q, q);
  }

  sql += ' ORDER BY u.surname, u.first_name';
  return db.all(sql, params);
}

function createInstructor({
  first_name,
  surname,
  email,
  username = null,
  password = null,
  temporary_password = null,
  account_status = 'active',
  adminUserId = null,
  adminUsername = 'admin'
}) {
  const db = getDatabase();
  const fName = (first_name || '').trim();
  const sName = (surname || '').trim();
  const emailAddr = (email || '').trim().toLowerCase();

  if (!fName || !sName) throw new Error('First name and surname are required.');
  if (!emailAddr) throw new Error('Email address is required.');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailAddr)) {
    throw new Error('Please enter a valid email address.');
  }

  // Check unique email
  const existingEmail = db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [emailAddr]);
  if (existingEmail) throw new Error(`A user with email '${emailAddr}' already exists.`);

  const finalUsername = (username ? username.trim().toLowerCase() : generateUsername(fName, sName));
  const existingUsername = db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [finalUsername]);
  if (existingUsername) throw new Error(`Username '${finalUsername}' is already taken.`);

  const chosenPassword = password || temporary_password || generateTemporaryPassword();
  if (chosenPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const passwordHash = hashPassword(chosenPassword);
  const userId = generateId();
  const mustChange = temporary_password ? 1 : 0;

  db.run(
    `INSERT INTO users (id, username, email, password_hash, role, first_name, surname, student_number, account_status, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'instructor', ?, ?, NULL, ?, ?, datetime('now'), datetime('now'))`,
    [userId, finalUsername, emailAddr, passwordHash, fName, sName, account_status, mustChange]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'CREATE_INSTRUCTOR',
    entityType: 'users',
    entityId: userId,
    details: { username: finalUsername, email: emailAddr, first_name: fName, surname: sName }
  });

  return {
    instructor: getInstructor(userId),
    temporary_password: chosenPassword
  };
}

function getInstructor(instructorId) {
  const db = getDatabase();
  const user = db.get(
    `SELECT id, username, email, role, first_name, surname, account_status, created_at, updated_at
     FROM users WHERE id = ? AND role = 'instructor'`,
    [instructorId]
  );
  if (!user) return null;

  const assignedClasses = db.all(
    `SELECT cl.*, c.name as course_name, c.code as course_code,
            (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = cl.id AND ce.status = 'active') as student_count,
            (SELECT COUNT(*) FROM assessment_classes ac WHERE ac.class_id = cl.id) as assessment_count
     FROM classes cl
     JOIN courses c ON c.id = cl.course_id
     WHERE cl.instructor_id = ?
     ORDER BY cl.created_at DESC`,
    [instructorId]
  );

  return {
    ...user,
    assigned_classes: assignedClasses
  };
}

function updateInstructor(instructorId, data, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const existing = getInstructor(instructorId);
  if (!existing) throw new Error('Instructor not found.');

  const { first_name, surname, email, account_status, password } = data;
  const updates = [];
  const params = [];

  if (first_name) {
    updates.push('first_name = ?');
    params.push(first_name.trim());
  }
  if (surname) {
    updates.push('surname = ?');
    params.push(surname.trim());
  }
  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    const dup = db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?', [cleanEmail, instructorId]);
    if (dup) throw new Error(`Email '${cleanEmail}' is already used by another account.`);
    updates.push('email = ?');
    params.push(cleanEmail);
  }
  if (account_status) {
    updates.push('account_status = ?');
    params.push(account_status);
  }
  if (password) {
    if (password.length < 6) throw new Error('Password must be at least 6 characters long.');
    updates.push('password_hash = ?');
    params.push(hashPassword(password));
    updates.push('must_change_password = 0');
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(instructorId);
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'UPDATE_INSTRUCTOR',
    entityType: 'users',
    entityId: instructorId,
    details: { changes: data }
  });

  return getInstructor(instructorId);
}

function deleteInstructor(instructorId, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const existing = getInstructor(instructorId);
  if (!existing) throw new Error('Instructor not found.');

  // Unassign any classes currently allocated to this instructor
  db.run('UPDATE classes SET instructor_id = NULL, facilitator_name = NULL WHERE instructor_id = ?', [instructorId]);

  // Remove any active sessions for this instructor
  db.run('DELETE FROM sessions WHERE user_id = ?', [instructorId]);

  // Delete the instructor user record
  db.run('DELETE FROM users WHERE id = ? AND role = ?', [instructorId, 'instructor']);

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'DELETE_INSTRUCTOR',
    entityType: 'users',
    entityId: instructorId,
    details: {
      username: existing.username,
      name: `${existing.first_name} ${existing.surname}`,
      email: existing.email
    }
  });

  return { success: true, message: 'Instructor deleted successfully.', id: instructorId };
}

function getInstructorClassProgress(instructorId, requestedClassId = null) {
  const db = getDatabase();

  // 1. Fetch all assigned classes for this instructor (or all classes if admin passes null)
  const assignedClasses = instructorId
    ? db.all(
        `SELECT cl.*, c.name as course_name, c.code as course_code,
                (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = cl.id AND ce.status = 'active') as student_count,
                (SELECT COUNT(*) FROM assessment_classes ac WHERE ac.class_id = cl.id) as assessment_count,
                COALESCE(
                  (SELECT cac.code FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                  (SELECT cac.code FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1)
                ) as active_code,
                COALESCE(
                  (SELECT cac.max_uses FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                  (SELECT cac.max_uses FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1)
                ) as code_max_uses,
                COALESCE(
                  (SELECT cac.used_count FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                  (SELECT cac.used_count FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                  0
                ) as code_used_count
         FROM classes cl
         LEFT JOIN courses c ON c.id = cl.course_id
         WHERE cl.instructor_id = ?
         ORDER BY cl.created_at DESC`,
        [instructorId]
      )
    : db.all(
        `SELECT cl.*, c.name as course_name, c.code as course_code,
                (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = cl.id AND ce.status = 'active') as student_count,
                (SELECT COUNT(*) FROM assessment_classes ac WHERE ac.class_id = cl.id) as assessment_count,
                COALESCE(
                  (SELECT cac.code FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                  (SELECT cac.code FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1)
                ) as active_code,
                COALESCE(
                  (SELECT cac.max_uses FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                  (SELECT cac.max_uses FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1)
                ) as code_max_uses,
                COALESCE(
                  (SELECT cac.used_count FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                  (SELECT cac.used_count FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                  0
                ) as code_used_count
         FROM classes cl
         LEFT JOIN courses c ON c.id = cl.course_id
         ORDER BY cl.created_at DESC`
      );

  if (assignedClasses.length === 0) {
    return {
      assigned_classes: [],
      selected_class: null,
      summary: {
        total_enrolled: 0,
        students_attempted: 0,
        students_passed: 0,
        completion_rate: 0,
        pass_rate: 0,
        avg_score: 0,
        highest_score: 0,
        lowest_score: 0
      },
      students: [],
      sections_analysis: [],
      questions_analysis: [],
      recent_attempts: []
    };
  }

  // 2. Select target class
  let targetClass = assignedClasses.find(c => c.id === requestedClassId);
  if (!targetClass && requestedClassId) {
    targetClass = db.get(
      `SELECT cl.*, c.name as course_name, c.code as course_code,
              (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = cl.id AND ce.status = 'active') as student_count,
              (SELECT COUNT(*) FROM assessment_classes ac WHERE ac.class_id = cl.id) as assessment_count,
              COALESCE(
                (SELECT cac.code FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                (SELECT cac.code FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1)
              ) as active_code,
              COALESCE(
                (SELECT cac.max_uses FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                (SELECT cac.max_uses FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1)
              ) as code_max_uses,
              COALESCE(
                (SELECT cac.used_count FROM course_access_codes cac WHERE cac.class_id = cl.id AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                (SELECT cac.used_count FROM course_access_codes cac WHERE cac.course_id = cl.course_id AND cac.class_id IS NULL AND cac.is_active = 1 ORDER BY cac.created_at DESC LIMIT 1),
                0
              ) as code_used_count
       FROM classes cl
       LEFT JOIN courses c ON c.id = cl.course_id
       WHERE cl.id = ?`,
      [requestedClassId]
    );
  }
  if (!targetClass) {
    targetClass = assignedClasses[0];
  }

  // Discover assessments & sections configured for this class / course (DISTINCT to prevent join duplicates)
  let classAssessments = db.all(
    `SELECT DISTINCT a.id, a.name, a.sections, a.pass_mark_percentage, a.created_at
     FROM assessments a
     JOIN assessment_classes ac ON ac.assessment_id = a.id
     WHERE ac.class_id = ?
     ORDER BY a.created_at DESC`,
    [targetClass.id]
  );

  if (classAssessments.length === 0) {
    classAssessments = db.all(
      `SELECT DISTINCT a.id, a.name, a.sections, a.pass_mark_percentage, a.created_at
       FROM assessments a
       WHERE a.course_id = ?
       ORDER BY a.created_at DESC`,
      [targetClass.course_id]
    );
  }

  const defaultPassMark = (classAssessments[0] && classAssessments[0].pass_mark_percentage) || 70;
  const orderedSectionNames = [];
  const questionSectionMap = new Map();
  const sectionQuestionCounts = new Map();

  for (const a of classAssessments) {
    const secs = parseStoredSections(a.sections);
    for (const sec of secs) {
      if (!orderedSectionNames.includes(sec)) {
        orderedSectionNames.push(sec);
      }
    }
    const aqRows = db.all(
      `SELECT aq.question_id, aq.pool_id, aq.section_name, qp.random_count
       FROM assessment_questions aq
       LEFT JOIN question_pools qp ON qp.id = aq.pool_id
       WHERE aq.assessment_id = ?
       ORDER BY aq.order_index ASC, aq.id ASC`,
      [a.id]
    );
    for (const aq of aqRows) {
      let sName = (aq.section_name || '').trim();
      if (!sName || (sName === 'General' && !orderedSectionNames.includes('General'))) {
        sName = orderedSectionNames[0] || 'Section 1';
      }
      if (!orderedSectionNames.includes(sName)) {
        orderedSectionNames.push(sName);
      }
      if (aq.question_id) {
        questionSectionMap.set(aq.question_id, sName);
      }
      const qIncrement = aq.pool_id ? (Number(aq.random_count) || 5) : 1;
      sectionQuestionCounts.set(sName, (sectionQuestionCounts.get(sName) || 0) + qIncrement);
    }
  }

  if (orderedSectionNames.length === 0) {
    orderedSectionNames.push(...DEFAULT_SECTIONS);
  }

  // 3. Enrolled students with detailed assessment & section progress across ALL attempts
  const students = db.all(
    `SELECT DISTINCT u.id, u.username, u.email, u.first_name, u.surname, u.student_number, 
            COALESCE(ce.enrolled_at, MIN(sa.started_at), u.created_at) as enrolled_at,
            COALESCE(ce.status, 'active') as enrollment_status
     FROM users u
     LEFT JOIN class_enrollments ce ON ce.user_id = u.id AND ce.class_id = ?
     LEFT JOIN student_attempts sa ON sa.user_id = u.id AND (
       sa.class_id = ? 
       OR sa.assessment_id IN (SELECT ac.assessment_id FROM assessment_classes ac WHERE ac.class_id = ?)
     )
     WHERE u.role = 'student' AND (ce.id IS NOT NULL OR sa.id IS NOT NULL)
     GROUP BY u.id
     ORDER BY u.surname, u.first_name`,
    [targetClass.id, targetClass.id, targetClass.id]
  );

  // Track aggregate stats per section across all students and all attempts
  const sectionStatsMap = new Map();
  orderedSectionNames.forEach((secName, idx) => {
    sectionStatsMap.set(secName, {
      name: secName,
      section_name: secName,
      order_index: idx,
      question_count: sectionQuestionCounts.get(secName) || 0,
      pass_mark_percentage: defaultPassMark,
      students_completed: 0,
      students_in_progress: 0,
      students_not_started: 0,
      students_passed: 0,
      total_attempts_count: 0,
      total_answers: 0,
      correct_answers: 0,
      total_awarded_points: 0,
      total_max_points: 0,
      student_latest_percentages: [],
      student_best_percentages: [],
      student_overall_percentages: [],
      students_needing_help: [],
      all_student_results: []
    });
  });

  const ensureSectionInMap = (secName) => {
    if (!orderedSectionNames.includes(secName)) {
      orderedSectionNames.push(secName);
    }
    if (!sectionStatsMap.has(secName)) {
      sectionStatsMap.set(secName, {
        name: secName,
        section_name: secName,
        order_index: orderedSectionNames.indexOf(secName),
        question_count: sectionQuestionCounts.get(secName) || 0,
        pass_mark_percentage: defaultPassMark,
        students_completed: 0,
        students_in_progress: 0,
        students_not_started: 0,
        students_passed: 0,
        total_attempts_count: 0,
        total_answers: 0,
        correct_answers: 0,
        total_awarded_points: 0,
        total_max_points: 0,
        student_latest_percentages: [],
        student_best_percentages: [],
        student_overall_percentages: [],
        students_needing_help: [],
        all_student_results: []
      });
    }
    return sectionStatsMap.get(secName);
  };

  // Compute per-student attempts & section breakdown across ALL attempts
  students.forEach(s => {
    const studentFullName = `${s.first_name || ''} ${s.surname || ''}`.trim() || s.username;

    // Fetch ALL attempts by this student for this class, this course, or assigned assessments
    const studentAttempts = db.all(
      `SELECT sa.*, a.name as assessment_name, COALESCE(a.pass_mark_percentage, ?) as pass_mark_percentage
       FROM student_attempts sa
       LEFT JOIN assessments a ON a.id = sa.assessment_id
       WHERE sa.user_id = ? AND (
         sa.class_id = ? 
         OR (a.course_id IS NOT NULL AND a.course_id = ?)
         OR sa.assessment_id IN (SELECT ac.assessment_id FROM assessment_classes ac WHERE ac.class_id = ?)
         OR sa.class_id IS NULL
       )
       ORDER BY sa.attempt_number ASC, sa.started_at ASC`,
      [defaultPassMark, s.id, targetClass.id, targetClass.course_id, targetClass.id]
    );

    const gradedAttempts = studentAttempts.filter(a => ['submitted', 'marked', 'awaiting_review'].includes(a.status));
    const inProgressAttempts = studentAttempts.filter(a => a.status === 'in_progress');

    s.attempt_count = studentAttempts.length;
    s.completed_attempt_count = gradedAttempts.length;
    s.best_score = gradedAttempts.length > 0
      ? Math.round(Math.max(...gradedAttempts.map(a => Number(a.percentage) || 0)) * 10) / 10
      : null;
    s.latest_score = gradedAttempts.length > 0
      ? Math.round((Number(gradedAttempts[gradedAttempts.length - 1].percentage) || 0) * 10) / 10
      : null;
    s.avg_score = gradedAttempts.length > 0
      ? Math.round((gradedAttempts.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0) / gradedAttempts.length) * 10) / 10
      : null;
    s.has_passed = gradedAttempts.some(a => a.is_passed === 1) ? 1 : 0;
    s.latest_attempt_at = gradedAttempts.length > 0
      ? gradedAttempts[gradedAttempts.length - 1].submitted_at
      : (inProgressAttempts.length > 0 ? inProgressAttempts[inProgressAttempts.length - 1].started_at : null);

    if (s.attempt_count === 0) {
      s.status_label = 'Not Started';
    } else if (s.has_passed === 1) {
      s.status_label = 'Passed';
    } else if (gradedAttempts.length === 0 && inProgressAttempts.length > 0) {
      s.status_label = 'In Progress';
    } else {
      s.status_label = 'Failed';
    }

    s.section_breakdown = [];
    s.sections_needing_help = [];
    s.current_section = null;
    s.attempt_history = [];

    if (studentAttempts.length > 0) {
      // Map: sectionName -> array of per-attempt section summaries for this student
      const studentSectionAttemptsMap = new Map();
      for (const secName of orderedSectionNames) {
        studentSectionAttemptsMap.set(secName, []);
      }

      for (const att of studentAttempts) {
        const passMark = att.pass_mark_percentage || defaultPassMark;
        const isGraded = ['submitted', 'marked', 'awaiting_review'].includes(att.status);

        const ansRows = db.all(
          `SELECT aa.*, q.question_type, q.answer_options, q.correct_answer, q.points, q.partial_credit, q.negative_marking, q.requires_manual_review,
                  (SELECT aq.section_name FROM assessment_questions aq WHERE aq.assessment_id = ? AND aq.question_id = aa.question_id LIMIT 1) as aq_section_name
           FROM attempt_answers aa
           JOIN questions q ON q.id = aa.question_id
           WHERE aa.attempt_id = ?
           ORDER BY aa.order_index ASC, aa.id ASC`,
          [att.assessment_id, att.id]
        );

        const bySec = new Map();
        for (const ans of ansRows) {
          let secName = (ans.aq_section_name || ans.section_name || questionSectionMap.get(ans.question_id) || '').trim();
          if (!secName || (secName === 'General' && !orderedSectionNames.includes('General'))) {
            secName = orderedSectionNames[0] || 'Section 1';
          }
          ensureSectionInMap(secName);
          if (!studentSectionAttemptsMap.has(secName)) {
            studentSectionAttemptsMap.set(secName, []);
          }
          if (!bySec.has(secName)) bySec.set(secName, []);
          bySec.get(secName).push(ans);
        }

        const attemptSectionsSummary = [];

        for (const [secName, secAnswers] of bySec.entries()) {
          if (secAnswers.length === 0) continue;

          let answeredCount = 0;
          let correctCount = 0;
          let awardedPts = 0;
          let maxPts = 0;

          for (const ans of secAnswers) {
            const qMax = Number(ans.max_points) || Number(ans.points) || 1;
            maxPts += qMax;
            const answered = isAnswerProvided(ans.saved_answer);
            if (answered) answeredCount++;

            if (ans.is_correct !== null && ans.is_correct !== undefined && ans.awarded_points !== null && ans.awarded_points !== undefined) {
              if (Number(ans.is_correct) === 1) correctCount++;
              awardedPts += Number(ans.awarded_points) || 0;
            } else if (answered) {
              // Evaluate on-the-fly for in-progress answers if not yet evaluated
              let saved = null;
              let correct = null;
              let options = null;
              try { saved = ans.saved_answer ? JSON.parse(ans.saved_answer) : null; } catch (e) { saved = ans.saved_answer; }
              try { correct = ans.correct_answer ? JSON.parse(ans.correct_answer) : null; } catch (e) { correct = ans.correct_answer; }
              try { options = ans.answer_options ? JSON.parse(ans.answer_options) : null; } catch (e) { options = ans.answer_options; }
              const evalRes = evaluateQuestion({
                ...ans,
                points: qMax,
                correct_answer: correct,
                answer_options: options,
                partial_credit: Boolean(ans.partial_credit),
                requires_manual_review: Boolean(ans.requires_manual_review)
              }, saved);
              if (evalRes.isCorrect) correctCount++;
              awardedPts += evalRes.awardedPoints;
            }
          }

          const totalQs = secAnswers.length;
          const isSecCompleted = totalQs > 0 && (isGraded || answeredCount === totalQs);
          const isSecInProgress = !isSecCompleted && answeredCount > 0;
          const secPct = (isSecCompleted || isSecInProgress) && maxPts > 0
            ? Math.round((awardedPts / maxPts) * 1000) / 10
            : null;

          const attSecRecord = {
            attempt_id: att.id,
            attempt_number: att.attempt_number,
            attempt_status: att.status,
            is_graded: isGraded,
            is_completed: isSecCompleted,
            is_in_progress: isSecInProgress,
            section_name: secName,
            total_questions: totalQs,
            answered_count: answeredCount,
            correct_count: correctCount,
            awarded_points: awardedPts,
            max_points: maxPts,
            percentage: secPct,
            pass_mark: passMark,
            submitted_at: att.submitted_at || att.started_at
          };

          studentSectionAttemptsMap.get(secName).push(attSecRecord);
          attemptSectionsSummary.push(attSecRecord);

          // Accumulate into class-wide section totals for completed or graded attempts
          const agg = ensureSectionInMap(secName);
          if (agg.question_count === 0 && totalQs > 0) {
            agg.question_count = totalQs;
          }
          if (isSecCompleted || isSecInProgress) {
            agg.total_attempts_count++;
            agg.total_answers += totalQs;
            agg.correct_answers += correctCount;
            agg.total_awarded_points += awardedPts;
            agg.total_max_points += maxPts;
          }
        }

        s.attempt_history.push({
          attempt_id: att.id,
          attempt_number: att.attempt_number,
          assessment_name: att.assessment_name,
          status: att.status,
          score: att.score,
          max_score: att.max_score,
          percentage: att.percentage !== null && att.percentage !== undefined ? Math.round(Number(att.percentage) * 10) / 10 : null,
          is_passed: Boolean(att.is_passed),
          started_at: att.started_at,
          submitted_at: att.submitted_at,
          sections: attemptSectionsSummary
        });
      }

      // Now summarize each section for this student across all their attempts
      for (const secName of orderedSectionNames) {
        const secAttemptRecords = studentSectionAttemptsMap.get(secName) || [];
        const configuredQCount = sectionQuestionCounts.get(secName) || 0;

        if (secAttemptRecords.length === 0 && configuredQCount === 0 && orderedSectionNames.length > 3) {
          continue;
        }

        const completedRecords = secAttemptRecords.filter(r => r.is_completed);
        const inProgressRecords = secAttemptRecords.filter(r => r.is_in_progress);
        const activeOrCompletedRecords = secAttemptRecords.filter(r => r.is_completed || r.is_in_progress);
        const latestRecord = activeOrCompletedRecords.length > 0
          ? activeOrCompletedRecords[activeOrCompletedRecords.length - 1]
          : (secAttemptRecords[secAttemptRecords.length - 1] || null);

        const totalQs = latestRecord ? latestRecord.total_questions : configuredQCount;
        const answeredCount = latestRecord ? latestRecord.answered_count : 0;
        const latestCorrect = latestRecord && (latestRecord.is_completed || latestRecord.is_in_progress) ? latestRecord.correct_count : null;
        const latestPct = latestRecord && latestRecord.percentage !== null ? latestRecord.percentage : null;

        const bestPct = completedRecords.length > 0
          ? Math.max(...completedRecords.map(r => r.percentage))
          : latestPct;
        const bestRecord = completedRecords.length > 0
          ? completedRecords.reduce((best, cur) => (cur.percentage >= best.percentage ? cur : best), completedRecords[0])
          : latestRecord;

        const totalAnswersAllAttempts = activeOrCompletedRecords.reduce((sum, r) => sum + r.total_questions, 0);
        const totalCorrectAllAttempts = activeOrCompletedRecords.reduce((sum, r) => sum + r.correct_count, 0);
        const totalAwardedAllAttempts = activeOrCompletedRecords.reduce((sum, r) => sum + r.awarded_points, 0);
        const totalMaxPtsAllAttempts = activeOrCompletedRecords.reduce((sum, r) => sum + r.max_points, 0);

        const overallAvgPct = totalMaxPtsAllAttempts > 0
          ? Math.round((totalAwardedAllAttempts / totalMaxPtsAllAttempts) * 1000) / 10
          : null;

        const isCompleted = completedRecords.length > 0;
        const isInProgress = !isCompleted && inProgressRecords.length > 0;
        const statusStr = isCompleted ? 'Completed' : (isInProgress ? 'In Progress' : (secAttemptRecords.length > 0 ? 'Pending' : 'Not Started'));

        const passMark = (latestRecord && latestRecord.pass_mark) || defaultPassMark;
        // A student needs help in this section if they have completed/started it and their latest score or overall accuracy is below the pass mark
        const needsHelp = (isCompleted || isInProgress) && (
          (latestPct !== null && latestPct < passMark) ||
          (overallAvgPct !== null && overallAvgPct < passMark)
        );

        if (!s.current_section && !isCompleted && totalQs > 0) {
          s.current_section = secName;
        }

        if (needsHelp) {
          s.sections_needing_help.push(secName);
        }

        const studentSecEntry = {
          name: secName,
          section_name: secName,
          total_questions: totalQs,
          attempts_count: activeOrCompletedRecords.length,
          answered_count: answeredCount,
          correct_count: latestCorrect,
          best_correct_count: bestRecord ? bestRecord.correct_count : null,
          total_answers_all_attempts: totalAnswersAllAttempts,
          total_correct_all_attempts: totalCorrectAllAttempts,
          percentage: latestPct !== null ? latestPct : overallAvgPct,
          latest_percentage: latestPct,
          best_percentage: bestPct,
          avg_percentage: overallAvgPct,
          is_completed: isCompleted,
          is_in_progress: isInProgress,
          status: statusStr,
          needs_help: needsHelp,
          attempt_history: activeOrCompletedRecords.map(r => ({
            attempt_number: r.attempt_number,
            correct_count: r.correct_count,
            total_questions: r.total_questions,
            percentage: r.percentage,
            is_completed: r.is_completed
          }))
        };

        s.section_breakdown.push(studentSecEntry);

        // Update class-level section stats for this student
        const agg = ensureSectionInMap(secName);
        if (isCompleted) {
          agg.students_completed++;
          if (latestPct !== null && latestPct >= passMark) {
            agg.students_passed++;
          }
        } else if (isInProgress) {
          agg.students_in_progress++;
        } else {
          agg.students_not_started++;
        }

        if (latestPct !== null) agg.student_latest_percentages.push(latestPct);
        if (bestPct !== null) agg.student_best_percentages.push(bestPct);
        if (overallAvgPct !== null) agg.student_overall_percentages.push(overallAvgPct);

        const studentSummaryForSection = {
          id: s.id,
          student_name: studentFullName,
          first_name: s.first_name,
          surname: s.surname,
          student_number: s.student_number || 'N/A',
          email: s.email,
          status: statusStr,
          is_completed: isCompleted,
          is_in_progress: isInProgress,
          attempts_count: activeOrCompletedRecords.length,
          answered_count: answeredCount,
          total_questions: totalQs,
          correct_count: latestCorrect !== null ? latestCorrect : 0,
          best_correct_count: bestRecord ? bestRecord.correct_count : 0,
          total_correct_all_attempts: totalCorrectAllAttempts,
          total_answers_all_attempts: totalAnswersAllAttempts,
          percentage: latestPct !== null ? latestPct : overallAvgPct,
          latest_percentage: latestPct,
          best_percentage: bestPct,
          avg_percentage: overallAvgPct,
          needs_help: needsHelp,
          attempt_history: studentSecEntry.attempt_history
        };

        agg.all_student_results.push(studentSummaryForSection);
        if (needsHelp) {
          agg.students_needing_help.push(studentSummaryForSection);
        }
      }

      if (!s.current_section && s.section_breakdown.length > 0) {
        s.current_section = s.section_breakdown[s.section_breakdown.length - 1].section_name;
      }
    } else {
      // Student has not started any attempt yet
      s.section_breakdown = orderedSectionNames.map(secName => {
        const totalQs = sectionQuestionCounts.get(secName) || 0;
        const agg = ensureSectionInMap(secName);
        agg.students_not_started++;
        agg.all_student_results.push({
          id: s.id,
          student_name: studentFullName,
          first_name: s.first_name,
          surname: s.surname,
          student_number: s.student_number || 'N/A',
          email: s.email,
          status: 'Not Started',
          is_completed: false,
          is_in_progress: false,
          attempts_count: 0,
          answered_count: 0,
          total_questions: totalQs,
          correct_count: null,
          best_correct_count: null,
          total_correct_all_attempts: 0,
          total_answers_all_attempts: 0,
          percentage: null,
          latest_percentage: null,
          best_percentage: null,
          avg_percentage: null,
          needs_help: false,
          attempt_history: []
        });
        return {
          name: secName,
          section_name: secName,
          total_questions: totalQs,
          attempts_count: 0,
          answered_count: 0,
          correct_count: null,
          best_correct_count: null,
          total_answers_all_attempts: 0,
          total_correct_all_attempts: 0,
          percentage: null,
          latest_percentage: null,
          best_percentage: null,
          avg_percentage: null,
          is_completed: false,
          is_in_progress: false,
          status: 'Not Started',
          needs_help: false,
          attempt_history: []
        };
      });
    }
  });

  const sectionsAnalysis = Array.from(sectionStatsMap.values()).map((sec, idx) => {
    // Overall point-weighted accuracy across all attempts in this section
    const overallAccuracyPct = sec.total_max_points > 0
      ? Math.round((sec.total_awarded_points / sec.total_max_points) * 1000) / 10
      : (sec.total_answers > 0 ? Math.round((sec.correct_answers / sec.total_answers) * 1000) / 10 : null);

    const latestAvgPct = sec.student_latest_percentages.length > 0
      ? Math.round((sec.student_latest_percentages.reduce((a, b) => a + b, 0) / sec.student_latest_percentages.length) * 10) / 10
      : overallAccuracyPct;

    const bestAvgPct = sec.student_best_percentages.length > 0
      ? Math.round((sec.student_best_percentages.reduce((a, b) => a + b, 0) / sec.student_best_percentages.length) * 10) / 10
      : overallAccuracyPct;

    const avgPct = overallAccuracyPct !== null ? overallAccuracyPct : latestAvgPct;
    const passMark = sec.pass_mark_percentage || defaultPassMark;
    const needsHelp = sec.students_needing_help.length > 0 || (avgPct !== null && avgPct < passMark);

    return {
      name: sec.section_name,
      section_name: sec.section_name,
      order_index: idx,
      question_count: sec.question_count,
      pass_mark_percentage: passMark,
      total_enrolled: students.length,
      completed_students_count: sec.students_completed,
      students_completed: sec.students_completed,
      in_progress_students_count: sec.students_in_progress,
      students_in_progress: sec.students_in_progress,
      not_started_students_count: sec.students_not_started,
      students_not_started: sec.students_not_started,
      passed_students_count: sec.students_passed,
      students_passed: sec.students_passed,
      total_attempts_count: sec.total_attempts_count,
      total_answers: sec.total_answers,
      correct_answers: sec.correct_answers,
      total_awarded_points: sec.total_awarded_points,
      total_max_points: sec.total_max_points,
      avg_percentage: avgPct,
      latest_avg_percentage: latestAvgPct,
      best_avg_percentage: bestAvgPct,
      students_needing_help_count: sec.students_needing_help.length,
      students_needing_help: sec.students_needing_help,
      all_student_results: sec.all_student_results,
      needs_help: needsHelp,
      needs_review: needsHelp
    };
  });

  // 4. Calculate Aggregate Class Summary Metrics
  const totalEnrolled = students.length;
  const attemptedStudents = students.filter(s => s.attempt_count > 0);
  const passedStudents = students.filter(s => s.has_passed === 1);
  const scoredAttempts = attemptedStudents.filter(s => s.best_score !== null);

  const scores = scoredAttempts.map(s => s.best_score);
  const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
  const completionRate = totalEnrolled > 0 ? Math.round((attemptedStudents.length / totalEnrolled) * 100) : 0;
  const passRate = attemptedStudents.length > 0 ? Math.round((passedStudents.length / attemptedStudents.length) * 100) : 0;

  // 5. Question-Level Accuracy Analysis (Pedagogical Weak-Spots)
  const questionAnalytics = db.all(
    `SELECT q.id, q.question_text, q.question_type, q.topic, q.difficulty,
            MAX(COALESCE(aa.section_name, 'Section 1')) as attempt_section_name,
            COUNT(aa.id) as total_answers,
            SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
            ROUND((CAST(SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(aa.id)) * 100, 1) as success_percentage
     FROM attempt_answers aa
     JOIN student_attempts sa ON sa.id = aa.attempt_id
     LEFT JOIN assessments a ON a.id = sa.assessment_id
     JOIN questions q ON q.id = aa.question_id
     WHERE (sa.class_id = ? OR a.course_id = ? OR sa.user_id IN (SELECT ce.user_id FROM class_enrollments ce WHERE ce.class_id = ?))
       AND sa.status IN ('submitted', 'marked', 'awaiting_review')
     GROUP BY q.id
     ORDER BY success_percentage ASC`,
    [targetClass.id, targetClass.course_id, targetClass.id]
  );

  questionAnalytics.forEach(q => {
    const mappedSec = questionSectionMap.get(q.id) || q.attempt_section_name;
    q.section_name = (!mappedSec || mappedSec === 'General') ? (orderedSectionNames[0] || 'Section 1') : mappedSec;
    q.needs_review = (q.success_percentage !== null && q.success_percentage < 60);
  });

  // 6. Recent Attempt Activity Stream
  const recentAttempts = db.all(
    `SELECT sa.id, sa.attempt_number, sa.score, sa.max_score, sa.percentage, sa.is_passed, sa.submitted_at,
            u.id as user_id, u.first_name, u.surname, u.username,
            a.name as assessment_name
     FROM student_attempts sa
     LEFT JOIN users u ON u.id = sa.user_id
     LEFT JOIN assessments a ON a.id = sa.assessment_id
     WHERE (sa.class_id = ? OR a.course_id = ? OR sa.user_id IN (SELECT ce.user_id FROM class_enrollments ce WHERE ce.class_id = ?))
       AND sa.status IN ('submitted', 'marked', 'awaiting_review')
     ORDER BY COALESCE(sa.submitted_at, sa.started_at) DESC
     LIMIT 10`,
    [targetClass.id, targetClass.course_id, targetClass.id]
  );

  return {
    assigned_classes: assignedClasses,
    selected_class: targetClass,
    summary: {
      total_enrolled: totalEnrolled,
      students_attempted: attemptedStudents.length,
      students_passed: passedStudents.length,
      completion_rate: completionRate,
      pass_rate: passRate,
      avg_score: avgScore,
      highest_score: highestScore,
      lowest_score: lowestScore
    },
    students,
    sections_analysis: sectionsAnalysis,
    questions_analysis: questionAnalytics,
    recent_attempts: recentAttempts
  };
}

function exportClassReport(instructorId, classId) {
  const data = getInstructorClassProgress(instructorId, classId);
  if (!data.selected_class) {
    throw new Error('Class not found or no access permitted.');
  }

  const rows = [
    ['Student Name', 'Username', 'Email', 'Student Number', 'Attempts', 'Best Score (%)', 'Latest Score (%)', 'Status', 'Section Breakdown', 'Sections Needing Help', 'Last Attempt Date']
  ];

  data.students.forEach(s => {
    const secBreakdownText = Array.isArray(s.section_breakdown) && s.section_breakdown.length > 0
      ? `"${s.section_breakdown.map(sec => `${sec.section_name}: ${sec.percentage !== null ? `${sec.percentage}%` : sec.status}`).join(' | ')}"`
      : 'None';
    const helpSecs = (s.sections_needing_help && s.sections_needing_help.length > 0)
      ? `"${s.sections_needing_help.join('; ')}"`
      : 'None';
    rows.push([
      `"${s.first_name} ${s.surname}"`,
      s.username,
      s.email,
      s.student_number || 'N/A',
      s.attempt_count,
      s.best_score !== null ? `${s.best_score}%` : 'N/A',
      s.latest_score !== null ? `${s.latest_score}%` : 'N/A',
      s.status_label,
      secBreakdownText,
      helpSecs,
      s.latest_attempt_at || 'Never'
    ]);
  });

  return rows.map(r => r.join(',')).join('\n');
}

module.exports = {
  listInstructors,
  createInstructor,
  getInstructor,
  updateInstructor,
  deleteInstructor,
  getInstructorClassProgress,
  exportClassReport
};
