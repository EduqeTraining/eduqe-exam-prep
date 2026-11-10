const { getDatabase } = require('../db');
const { generateId } = require('../utils/crypto');
const { logAction } = require('./auditService');
const { evaluateQuestion } = require('./scoringService');
const { getAssessment, parseStoredSections } = require('./assessmentService');
const { selectRandomQuestionsFromPool } = require('./poolService');
const expirationRuleService = require('./expirationRuleService');

function parseUtcDate(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  const s = String(str).trim();
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date(s.replace(' ', 'T') + 'Z');
}

function parseCompletedSections(raw, attemptId = null) {
  let list = [];
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) list = parsed.map(s => String(s).trim()).filter(Boolean);
    } catch (e) {}
  }

  if (attemptId && list.length === 0) {
    try {
      const db = getDatabase();
      const setting = db.get('SELECT value FROM eduque_settings WHERE key = ?', [`completed_sections_attempt_${attemptId}`]);
      if (setting && setting.value) {
        const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
        if (Array.isArray(parsed)) list = parsed.map(s => String(s).trim()).filter(Boolean);
      }
    } catch (e) {}
  }
  return [...new Set(list)];
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function applyClassSectionRules(resolvedQuestions, classConfig) {
  if (!classConfig || !classConfig.sections || Object.keys(classConfig.sections).length === 0) {
    return resolvedQuestions;
  }
  // Group questions by section name, preserving original appearance order
  const sectionMap = new Map();
  for (const q of resolvedQuestions) {
    const sName = (q.section_name && q.section_name !== 'General') ? q.section_name : 'Section 1';
    if (!sectionMap.has(sName)) sectionMap.set(sName, []);
    sectionMap.get(sName).push(q);
  }

  const result = [];
  for (const [secName, qList] of sectionMap.entries()) {
    // Match rule by exact name or trimmed name
    const rule = classConfig.sections[secName] || classConfig.sections[secName.trim()];
    let currentQuestions = [...qList];

    if (rule) {
      // 1. Limit questions if specified
      if (rule.limit && Number(rule.limit) > 0 && Number(rule.limit) < currentQuestions.length) {
        currentQuestions = currentQuestions.slice(0, Number(rule.limit));
      }

      // 2. Break down into chunks / parts if specified
      const chunkSize = Number(rule.chunk_size);
      if (chunkSize && chunkSize > 0 && chunkSize < currentQuestions.length) {
        const numChunks = Math.ceil(currentQuestions.length / chunkSize);
        for (let i = 0; i < numChunks; i++) {
          const chunkName = `${secName} (Part ${i + 1})`;
          const chunkSlice = currentQuestions.slice(i * chunkSize, (i + 1) * chunkSize);
          for (const q of chunkSlice) {
            result.push({
              ...q,
              section_name: chunkName
            });
          }
        }
        continue;
      }
    }

    // Default: keep section name
    for (const q of currentQuestions) {
      result.push({
        ...q,
        section_name: secName
      });
    }
  }

  return result;
}

function startAttempt({ userId, assessmentId, classId, forceNew = false, submitExisting = false }) {
  const db = getDatabase();

  const user = db.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user || user.account_status !== 'active') {
    throw new Error('User account is not active.');
  }

  const assessment = getAssessment(assessmentId);
  if (!assessment) throw new Error('Assessment not found.');
  if (assessment.status !== 'published') {
    throw new Error('This assessment is not currently published.');
  }

  // Sanitize classId input
  let targetClassId = (classId && classId !== 'null' && classId !== 'undefined') ? String(classId).trim() : null;

  // Check enrollment
  let enrollment = null;
  if (targetClassId) {
    enrollment = db.get(
      "SELECT * FROM class_enrollments WHERE class_id = ? AND user_id = ? AND status = 'active'",
      [targetClassId, userId]
    );
  }
  if (!enrollment && !targetClassId) {
    enrollment = db.get(
      `SELECT ce.* FROM class_enrollments ce
       JOIN assessment_classes ca ON ca.class_id = ce.class_id
       WHERE ca.assessment_id = ? AND ce.user_id = ? AND ce.status = 'active'
       LIMIT 1`,
      [assessmentId, userId]
    ) || db.get(
      `SELECT ce.* FROM class_enrollments ce
       JOIN classes cl ON cl.id = ce.class_id
       WHERE cl.course_id = ? AND ce.user_id = ? AND ce.status = 'active'
       LIMIT 1`,
      [assessment.course_id, userId]
    );
    if (enrollment) {
      targetClassId = enrollment.class_id;
    }
  }

  const now = Date.now();

  if (!enrollment) {
    const expiredEnrollment = db.get(
      `SELECT ce.* FROM class_enrollments ce
       JOIN classes cl ON cl.id = ce.class_id
       WHERE ce.user_id = ? AND (ce.class_id = ? OR cl.course_id = ?)
       LIMIT 1`,
      [userId, targetClassId, assessment.course_id]
    );
    if (expiredEnrollment && (expiredEnrollment.status === 'expired' || (expiredEnrollment.access_expires_at && now > parseUtcDate(expiredEnrollment.access_expires_at).getTime()))) {
      expirationRuleService.checkAndPurgeExpiredEnrollments({ userId });
      throw new Error('Your certification access period has expired. Associated questions and previous results have been purged per platform policy.');
    }
    throw new Error('You are not enrolled in this class or your enrolment is inactive.');
  }

  // Check enrollment access dates
  if (enrollment.access_starts_at && (now < parseUtcDate(enrollment.access_starts_at).getTime() - 5000)) {
    throw new Error('Your class access period has not started yet.');
  }
  if (enrollment.status === 'expired' || (enrollment.access_expires_at && now > parseUtcDate(enrollment.access_expires_at).getTime())) {
    expirationRuleService.checkAndPurgeExpiredEnrollments({ userId });
    throw new Error('Your certification access period has expired. Associated questions and previous results have been purged per platform policy.');
  }

  // Check assessment availability window
  if (assessment.available_from && now < parseUtcDate(assessment.available_from).getTime()) {
    throw new Error('Assessment availability window has not opened yet.');
  }
  if (assessment.available_to && now > parseUtcDate(assessment.available_to).getTime()) {
    // If the student has an active class enrollment whose access period extends beyond the assessment window (or has ongoing active access),
    // permit the enrolled student to take their assigned assessment.
    const hasActiveClassAccess = Boolean(
      enrollment &&
      enrollment.status === 'active' &&
      (!enrollment.access_expires_at || parseUtcDate(enrollment.access_expires_at).getTime() > now)
    );
    if (!hasActiveClassAccess) {
      throw new Error('Assessment availability window has closed.');
    }
  }

  // Check active in-progress attempt for recovery or restart
  const existingInProgress = db.get(
    `SELECT * FROM student_attempts 
     WHERE user_id = ? AND assessment_id = ? AND status = 'in_progress'
     ORDER BY started_at DESC LIMIT 1`,
    [userId, assessmentId]
  );

  if (existingInProgress) {
    if (forceNew) {
      if (submitExisting) {
        // End & grade existing attempt before starting fresh
        submitAttempt({ attemptId: existingInProgress.id, userId, isAuto: false });
      } else {
        // Discard unfinished in-progress attempt and start fresh
        db.run('DELETE FROM attempt_answers WHERE attempt_id = ?', [existingInProgress.id]);
        db.run('DELETE FROM student_attempts WHERE id = ?', [existingInProgress.id]);
        logAction({
          userId,
          username: user.username,
          action: 'RESTART_ASSESSMENT_ATTEMPT',
          entityType: 'student_attempts',
          entityId: existingInProgress.id,
          details: { assessmentId, mode: 'reset_in_progress' }
        });
      }
    } else {
      let isPaused = Boolean(existingInProgress.is_paused);
      if (!isPaused) {
        const timerSetting = db.get("SELECT value FROM eduque_settings WHERE key = ?", [`attempt_timer_${existingInProgress.id}`]);
        if (timerSetting && timerSetting.value) {
          try {
            const parsed = JSON.parse(timerSetting.value);
            if (parsed && parsed.is_paused) isPaused = true;
          } catch (_) {}
        }
      }
      if (!isPaused) {
        const deadline = parseUtcDate(existingInProgress.deadline_at).getTime();
        if (now >= deadline) {
          // Auto-submit expired attempt
          submitAttempt({ attemptId: existingInProgress.id, userId, isAuto: true });
        } else {
          // Resume active attempt
          return getAttemptState(existingInProgress.id, userId);
        }
      } else {
        // Resume paused active attempt
        return getAttemptState(existingInProgress.id, userId);
      }
    }
  }

  // Check max attempts
  const pastAttempts = db.get(
    `SELECT COUNT(*) as count FROM student_attempts 
     WHERE user_id = ? AND assessment_id = ? AND status IN ('submitted', 'marked', 'awaiting_review', 'expired')`,
    [userId, assessmentId]
  );

  const attemptCount = (pastAttempts?.count || 0);
  const maxAttempts = (assessment.max_attempts !== null && assessment.max_attempts !== undefined) ? Number(assessment.max_attempts) : 0;
  // If maxAttempts > 0 and not explicitly forced via restart/retry, enforce limit. 0 or null represents unlimited attempts.
  if (!forceNew && maxAttempts > 0 && attemptCount >= maxAttempts) {
    throw new Error(`Maximum attempts reached (${attemptCount} of ${maxAttempts}).`);
  }

  const newAttemptNumber = attemptCount + 1;
  const durationMs = (assessment.duration_minutes || 60) * 60 * 1000;
  let deadlineDate = new Date(now + durationMs).toISOString();
  const attemptId = generateId();

  // Compile question items (direct questions + pool questions)
  let resolvedQuestions = [];
  for (const item of assessment.items) {
    if (item.is_pool) {
      const poolQuestions = selectRandomQuestionsFromPool(item.pool_id, item.pool_random_count);
      for (const pq of poolQuestions) {
        resolvedQuestions.push({
          ...pq,
          section_name: item.section_name,
          points_override: null
        });
      }
    } else if (item.question) {
      resolvedQuestions.push({
        ...item.question,
        section_name: item.section_name,
        points: item.points_override !== null && item.points_override !== undefined ? item.points_override : item.question.points
      });
    }
  }

  if (assessment.randomize_questions) {
    // Shuffle questions within each section so students still progress section-by-section in order
    const bySection = new Map();
    for (const q of resolvedQuestions) {
      const sec = q.section_name || 'Section 1';
      if (!bySection.has(sec)) bySection.set(sec, []);
      bySection.get(sec).push(q);
    }
    resolvedQuestions = [];
    for (const [, secQs] of bySection.entries()) {
      resolvedQuestions.push(...shuffleArray(secQs));
    }
  }

  // Apply class-specific assessment configuration (question limits, section breakdown/chunking, per-section timer)
  let section1TimerMinutes = null;
  if (targetClassId) {
    const { getClassAssessmentConfig } = require('./classService');
    const classConfig = getClassAssessmentConfig(targetClassId, assessmentId);
    if (classConfig) {
      resolvedQuestions = applyClassSectionRules(resolvedQuestions, classConfig);
      const firstSecName = resolvedQuestions[0]?.section_name || 'Section 1';
      const secRule = classConfig?.sections?.[firstSecName] || classConfig?.sections?.[firstSecName.trim()];
      if (secRule && Number(secRule.time_limit_minutes) > 0) {
        section1TimerMinutes = Number(secRule.time_limit_minutes);
      }
    }
  }

  const effectiveDurationMs = (section1TimerMinutes ? section1TimerMinutes : (assessment.duration_minutes || 60)) * 60 * 1000;
  deadlineDate = new Date(now + effectiveDurationMs).toISOString();

  // Insert attempt record
  db.run(
    `INSERT INTO student_attempts (id, assessment_id, user_id, class_id, attempt_number, started_at, deadline_at, status, completed_sections)
     VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 'in_progress', ?)`,
    [attemptId, assessmentId, userId, targetClassId, newAttemptNumber, deadlineDate, JSON.stringify([])]
  );

  // Initialize attempt answers with section_name and order_index
  resolvedQuestions.forEach((q, idx) => {
    const answerId = generateId();
    const secName = (q.section_name && q.section_name !== 'General') ? q.section_name : (assessment.section_names?.[0] || 'Section 1');
    db.run(
      `INSERT INTO attempt_answers (id, attempt_id, question_id, question_version, section_name, order_index, saved_answer, is_flagged, max_points, marked_status)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, 'pending')`,
      [answerId, attemptId, q.id, q.version || 1, secName, idx, q.points || 1]
    );
  });

  logAction({
    userId,
    username: user.username,
    action: 'START_ASSESSMENT_ATTEMPT',
    entityType: 'student_attempts',
    entityId: attemptId,
    details: { assessmentId, attemptNumber: newAttemptNumber, deadline: deadlineDate }
  });

  return getAttemptState(attemptId, userId);
}

function autosaveAnswer({ attemptId, userId, questionId, savedAnswer, isFlagged = null }) {
  const db = getDatabase();
  const attempt = db.get('SELECT * FROM student_attempts WHERE id = ? AND user_id = ?', [attemptId, userId]);

  if (!attempt) throw new Error('Attempt not found.');
  if (attempt.status !== 'in_progress') {
    throw new Error('Cannot edit an assessment attempt that is not in progress.');
  }

  // Resolve targetClassId if missing
  let targetClassId = attempt.class_id;
  if (!targetClassId) {
    const enroll = db.get(
      `SELECT ce.class_id FROM class_enrollments ce
       JOIN classes cl ON cl.id = ce.class_id
       JOIN assessments a ON a.course_id = cl.course_id
       WHERE ce.user_id = ? AND a.id = ? AND ce.status = 'active'
       ORDER BY ce.enrolled_at DESC LIMIT 1`,
      [userId, attempt.assessment_id]
    );
    if (enroll) {
      targetClassId = enroll.class_id;
      db.run('UPDATE student_attempts SET class_id = ? WHERE id = ?', [targetClassId, attemptId]);
      attempt.class_id = targetClassId;
    }
  }

  // Check section lock and completion status FIRST before doing anything else
  const answerRow = db.get(
    `SELECT aa.section_name,
            (SELECT aq.section_name FROM assessment_questions aq WHERE aq.assessment_id = sa.assessment_id AND aq.question_id = aa.question_id LIMIT 1) as aq_section_name
     FROM attempt_answers aa
     JOIN student_attempts sa ON sa.id = aa.attempt_id
     WHERE aa.attempt_id = ? AND aa.question_id = ?`,
    [attemptId, questionId]
  );
  if (!answerRow) {
    throw new Error('Question not found in this attempt.');
  }

  const assRow = db.get('SELECT sections FROM assessments WHERE id = ?', [attempt.assessment_id]);
  const configuredSections = parseStoredSections(assRow?.sections);

  let secName = (answerRow.section_name || answerRow.aq_section_name || '').trim();
  if (!secName || (secName === 'General' && !configuredSections.includes('General'))) {
    secName = configuredSections[0] || 'Section 1';
  }

  const completedSections = parseCompletedSections(attempt.completed_sections, attempt.id);
  if (completedSections.includes(secName)) {
    throw new Error(`Section '${secName}' has already been submitted and cannot be modified.`);
  }

  const { getUnlockedSectionsForClass } = require('./classService');
  const unlockedSections = getUnlockedSectionsForClass(targetClassId);
  if (!unlockedSections.includes(secName)) {
    throw new Error(`Section '${secName}' is currently locked. Please wait for your instructor to unlock it.`);
  }

  // If attempt was paused and student is now answering an unlocked section, auto-resume timer
  let isAttemptPaused = Boolean(attempt.is_paused);
  if (!isAttemptPaused) {
    const timerSetting = db.get("SELECT value FROM eduque_settings WHERE key = ?", [`attempt_timer_${attemptId}`]);
    if (timerSetting && timerSetting.value) {
      try {
        const parsed = JSON.parse(timerSetting.value);
        if (parsed && parsed.is_paused) isAttemptPaused = true;
      } catch (_) {}
    }
  }

  if (isAttemptPaused) {
    resumeAttemptTimer({ attemptId, userId });
    const refreshed = db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]);
    if (refreshed) {
      attempt.deadline_at = refreshed.deadline_at;
      attempt.is_paused = 0;
      attempt.paused_remaining_seconds = null;
    }
  }

  // Authoritative server-side deadline check
  const now = Date.now();
  const deadline = parseUtcDate(attempt.deadline_at).getTime();
  if (now > deadline) {
    submitAttempt({ attemptId, userId, isAuto: true });
    throw new Error('Assessment timer has expired. Your attempt has been automatically submitted.');
  }

  const answerJson = savedAnswer !== undefined && savedAnswer !== null ? JSON.stringify(savedAnswer) : null;

  let isCorrectVal = null;
  let awardedPointsVal = null;
  let markedStatusVal = null;
  if (savedAnswer !== undefined) {
    const item = db.get(
      `SELECT aa.max_points, q.question_type, q.answer_options, q.correct_answer, q.points, q.partial_credit, q.negative_marking, q.requires_manual_review
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = ? AND aa.question_id = ?`,
      [attemptId, questionId]
    );
    if (item) {
      let correct = null;
      let options = null;
      try { correct = item.correct_answer ? JSON.parse(item.correct_answer) : null; } catch (e) { correct = item.correct_answer; }
      try { options = item.answer_options ? JSON.parse(item.answer_options) : null; } catch (e) { options = item.answer_options; }
      const evalResult = evaluateQuestion({
        ...item,
        points: item.max_points || item.points || 1,
        correct_answer: correct,
        answer_options: options,
        partial_credit: Boolean(item.partial_credit),
        requires_manual_review: Boolean(item.requires_manual_review)
      }, savedAnswer);
      isCorrectVal = evalResult.isCorrect ? 1 : 0;
      awardedPointsVal = evalResult.awardedPoints;
      markedStatusVal = evalResult.status || 'auto_marked';
    }
  }

  db.run(
    `UPDATE attempt_answers
     SET saved_answer = COALESCE(?, saved_answer),
         is_flagged = COALESCE(?, is_flagged),
         is_correct = COALESCE(?, is_correct),
         awarded_points = COALESCE(?, awarded_points),
         marked_status = COALESCE(?, marked_status),
         saved_at = datetime('now')
     WHERE attempt_id = ? AND question_id = ?`,
    [
      answerJson,
      isFlagged !== null && isFlagged !== undefined ? (isFlagged ? 1 : 0) : null,
      isCorrectVal,
      awardedPointsVal,
      markedStatusVal,
      attemptId,
      questionId
    ]
  );

  return { success: true, saved_at: new Date().toISOString() };
}

function submitAttempt({ attemptId, userId, isAuto = false }) {
  const db = getDatabase();
  let attempt = db.get(
    `SELECT sa.*, a.pass_mark_percentage, a.result_visibility, a.explanation_visibility
     FROM student_attempts sa
     LEFT JOIN assessments a ON a.id = sa.assessment_id
     WHERE sa.id = ?`,
    [attemptId]
  );

  if (!attempt) {
    const rawSa = db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]);
    if (rawSa) {
      attempt = {
        ...rawSa,
        pass_mark_percentage: 70,
        result_visibility: 'immediate',
        explanation_visibility: 'immediate'
      };
    } else {
      throw new Error('Attempt not found.');
    }
  }
  attempt.pass_mark_percentage = attempt.pass_mark_percentage ?? 70;
  if (attempt.class_id) {
    try {
      const { getClassAssessmentConfig } = require('./classService');
      const classConfig = getClassAssessmentConfig(attempt.class_id, attempt.assessment_id);
      if (classConfig && classConfig.pass_mark_percentage) {
        attempt.pass_mark_percentage = classConfig.pass_mark_percentage;
      }
    } catch (_) {}
  }
  attempt.result_visibility = attempt.result_visibility ?? 'immediate';
  attempt.explanation_visibility = attempt.explanation_visibility ?? 'immediate';

  if (attempt.user_id !== userId) {
    throw new Error('Unauthorized attempt access.');
  }
  if (attempt.status !== 'in_progress') {
    return getAttemptState(attemptId, userId);
  }

  // Fetch all answers and corresponding questions
  const answers = db.all(
    `SELECT aa.*, q.question_type, q.question_text, q.question_description,
            q.answer_options, q.correct_answer, q.answer_explanation, q.explanation_visibility,
            q.points, q.partial_credit, q.negative_marking, q.requires_manual_review
     FROM attempt_answers aa
     LEFT JOIN questions q ON q.id = aa.question_id
     WHERE aa.attempt_id = ?`,
    [attemptId]
  );

  let totalScore = 0;
  let maxScore = 0;
  let hasManualReview = false;

  for (const item of answers) {
    let saved = null;
    try { saved = item.saved_answer ? JSON.parse(item.saved_answer) : null; } catch (e) { saved = item.saved_answer; }
    let correct = null;
    try { correct = item.correct_answer ? JSON.parse(item.correct_answer) : null; } catch (e) { correct = item.correct_answer; }
    let options = null;
    try { options = item.answer_options ? JSON.parse(item.answer_options) : null; } catch (e) { options = item.answer_options; }

    const questionObj = {
      ...item,
      points: item.max_points || item.points || 1,
      correct_answer: correct,
      answer_options: options,
      partial_credit: Boolean(item.partial_credit),
      requires_manual_review: Boolean(item.requires_manual_review)
    };

    const evalResult = evaluateQuestion(questionObj, saved);

    if (evalResult.status === 'awaiting_review') {
      hasManualReview = true;
    }

    totalScore += evalResult.awardedPoints;
    maxScore += evalResult.maxPoints;

    db.run(
      `UPDATE attempt_answers
       SET is_correct = ?, awarded_points = ?, marked_status = ?
       WHERE id = ?`,
      [evalResult.isCorrect ? 1 : 0, evalResult.awardedPoints, evalResult.status, item.id]
    );
  }

  if (maxScore === 0) maxScore = 1;
  const percentage = Math.round((totalScore / maxScore) * 10000) / 100;
  const isPassed = percentage >= (attempt.pass_mark_percentage || 70);
  const finalStatus = hasManualReview ? 'awaiting_review' : 'marked';

  const allDistinctSections = db.all(
    `SELECT DISTINCT section_name FROM attempt_answers WHERE attempt_id = ?`,
    [attemptId]
  ).map(r => r.section_name);

  db.run(
    `UPDATE student_attempts
     SET submitted_at = datetime('now'),
         status = ?,
         score = ?,
         max_score = ?,
         percentage = ?,
         is_passed = ?,
         completed_sections = ?
     WHERE id = ?`,
    [finalStatus, totalScore, maxScore, percentage, isPassed ? 1 : 0, JSON.stringify(allDistinctSections), attemptId]
  );

  logAction({
    userId,
    action: isAuto ? 'AUTO_SUBMIT_ASSESSMENT_ATTEMPT' : 'SUBMIT_ASSESSMENT_ATTEMPT',
    entityType: 'student_attempts',
    entityId: attemptId,
    details: { totalScore, maxScore, percentage, isPassed, status: finalStatus, isAuto }
  });

  return getAttemptState(attemptId, userId);
}

function submitSection({ attemptId, userId, sectionName, answers: clientAnswers, assessmentId = null, classId = null }) {
  const db = getDatabase();
  let attempt = db.get(
    `SELECT sa.*, a.pass_mark_percentage, a.result_visibility, a.explanation_visibility, a.sections as assessment_sections
     FROM student_attempts sa
     LEFT JOIN assessments a ON a.id = sa.assessment_id
     WHERE sa.id = ?`,
    [attemptId]
  );

  if (!attempt) {
    const rawSa = db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]);
    if (rawSa) {
      const assRow = db.get('SELECT pass_mark_percentage, result_visibility, explanation_visibility, sections FROM assessments WHERE id = ?', [rawSa.assessment_id]);
      attempt = {
        ...rawSa,
        pass_mark_percentage: assRow?.pass_mark_percentage ?? 70,
        result_visibility: assRow?.result_visibility ?? 'immediate',
        explanation_visibility: assRow?.explanation_visibility ?? 'immediate',
        assessment_sections: assRow?.sections ?? JSON.stringify(['Section 1'])
      };
    } else if (userId) {
      // Fallback 1: check if the student has an active in-progress attempt, or most recent attempt
      const userActive = (assessmentId
        ? db.get("SELECT * FROM student_attempts WHERE user_id = ? AND assessment_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1", [userId, assessmentId])
        : null)
        || db.get("SELECT * FROM student_attempts WHERE user_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1", [userId])
        || (assessmentId
          ? db.get("SELECT * FROM student_attempts WHERE user_id = ? AND assessment_id = ? ORDER BY started_at DESC LIMIT 1", [userId, assessmentId])
          : null)
        || db.get("SELECT * FROM student_attempts WHERE user_id = ? ORDER BY started_at DESC LIMIT 1", [userId]);

      if (userActive) {
        attemptId = userActive.id;
        const assRow = db.get('SELECT pass_mark_percentage, result_visibility, explanation_visibility, sections FROM assessments WHERE id = ?', [userActive.assessment_id]);
        attempt = {
          ...userActive,
          pass_mark_percentage: assRow?.pass_mark_percentage ?? 70,
          result_visibility: assRow?.result_visibility ?? 'immediate',
          explanation_visibility: assRow?.explanation_visibility ?? 'immediate',
          assessment_sections: assRow?.sections ?? JSON.stringify(['Section 1'])
        };
      } else {
        // Fallback 2: Self-heal - reconstruct attempt record on this container so serverless cold start never throws 'Attempt not found'
        try { db.run('PRAGMA foreign_keys = OFF;'); } catch (_) {}

        // Ensure user row exists in SQLite
        if (!db.get('SELECT id FROM users WHERE id = ?', [userId])) {
          try {
            db.run(
              "INSERT OR IGNORE INTO users (id, username, email, display_name, role, status) VALUES (?, ?, ?, ?, 'student', 'active')",
              [userId, `user_${userId.slice(0, 8)}`, `${userId}@eduqe.local`, 'Student User']
            );
          } catch (_) {}
        }

        // Ensure assessment row exists in SQLite
        let assId = assessmentId || db.get('SELECT id FROM assessments LIMIT 1')?.id || 'general';
        let assRow = db.get('SELECT * FROM assessments WHERE id = ?', [assId]);
        if (!assRow) {
          try {
            db.run(
              "INSERT OR IGNORE INTO assessments (id, course_id, title, sections, pass_mark_percentage, status) VALUES (?, 'course_general', 'Assessment', ?, 70, 'published')",
              [assId, JSON.stringify([sectionName || 'Section 1'])]
            );
            assRow = db.get('SELECT * FROM assessments WHERE id = ?', [assId]);
          } catch (_) {}
        }

        // Ensure class row exists in SQLite
        let cId = classId;
        if (!cId) {
          const enroll = db.get('SELECT class_id FROM class_enrollments WHERE user_id = ? AND status = "active" ORDER BY enrolled_at DESC LIMIT 1', [userId]);
          cId = enroll?.class_id || db.get('SELECT id FROM classes LIMIT 1')?.id || 'cls_general';
        }
        if (!db.get('SELECT id FROM classes WHERE id = ?', [cId])) {
          try {
            db.run(
              "INSERT OR IGNORE INTO classes (id, course_id, name, status) VALUES (?, 'course_general', 'Class', 'active')",
              [cId]
            );
          } catch (_) {}
        }

        const healAttemptId = attemptId || generateId();
        try {
          db.run(
            `INSERT OR REPLACE INTO student_attempts (id, assessment_id, user_id, class_id, attempt_number, started_at, deadline_at, status, completed_sections)
             VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now', '+60 minutes'), 'in_progress', ?)`,
            [healAttemptId, assId, userId, cId, JSON.stringify([])]
          );
        } catch (_) {}

        attempt = db.get('SELECT * FROM student_attempts WHERE id = ?', [healAttemptId]);
        if (attempt) {
          attemptId = healAttemptId;
          attempt.pass_mark_percentage = assRow?.pass_mark_percentage ?? 70;
          attempt.result_visibility = assRow?.result_visibility ?? 'immediate';
          attempt.explanation_visibility = assRow?.explanation_visibility ?? 'immediate';
          attempt.assessment_sections = assRow?.sections ?? JSON.stringify([sectionName || 'Section 1']);
        }

        try { db.run('PRAGMA foreign_keys = ON;'); } catch (_) {}
      }
    }
  }

  if (!attempt) {
    throw new Error('Attempt not found.');
  }
  attempt.pass_mark_percentage = attempt.pass_mark_percentage ?? 70;
  if (attempt.class_id) {
    try {
      const { getClassAssessmentConfig } = require('./classService');
      const classConfig = getClassAssessmentConfig(attempt.class_id, attempt.assessment_id);
      if (classConfig && classConfig.pass_mark_percentage) {
        attempt.pass_mark_percentage = classConfig.pass_mark_percentage;
      }
    } catch (_) {}
  }
  attempt.result_visibility = attempt.result_visibility ?? 'immediate';
  attempt.explanation_visibility = attempt.explanation_visibility ?? 'immediate';
  attempt.assessment_sections = attempt.assessment_sections ?? JSON.stringify(['Section 1']);

  // If client provided live answers map, persist them first so nothing is lost!
  if (clientAnswers && typeof clientAnswers === 'object') {
    try { db.run('PRAGMA foreign_keys = OFF;'); } catch (_) {}
    for (const [qId, ansVal] of Object.entries(clientAnswers)) {
      if (ansVal !== undefined) {
        const answerJson = (ansVal !== null && typeof ansVal === 'object') ? JSON.stringify(ansVal) : (ansVal !== null ? String(ansVal) : null);
        // Ensure question row exists in local SQLite if running on fresh container
        if (!db.get('SELECT id FROM questions WHERE id = ?', [qId])) {
          try {
            db.run(
              "INSERT OR IGNORE INTO questions (id, question_text, question_type, status) VALUES (?, 'Question', 'single_choice', 'published')",
              [qId]
            );
          } catch (_) {}
        }

        const existingAns = db.get('SELECT id FROM attempt_answers WHERE attempt_id = ? AND question_id = ?', [attempt.id, qId]);
        if (existingAns) {
          db.run(
            `UPDATE attempt_answers SET saved_answer = ?, saved_at = datetime('now') WHERE attempt_id = ? AND question_id = ?`,
            [answerJson, attempt.id, qId]
          );
        } else {
          db.run(
            `INSERT OR IGNORE INTO attempt_answers (id, attempt_id, question_id, saved_answer, section_name, saved_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [`aa_${attempt.id}_${qId}`, attempt.id, qId, answerJson, (sectionName || '').trim() || 'Section 1']
          );
        }
      }
    }
    try { db.run('PRAGMA foreign_keys = ON;'); } catch (_) {}
  }

  if (attempt.user_id !== userId) {
    throw new Error('Unauthorized attempt access.');
  }

  const secName = (sectionName || '').trim();
  if (!secName) throw new Error('Section name is required.');

  const completedSections = parseCompletedSections(attempt.completed_sections, attempt.id);

  // Idempotency: If attempt is already submitted/marked or section was already submitted,
  // gracefully return the attempt state instead of throwing an error
  if (attempt.status !== 'in_progress') {
    const finalState = getAttemptState(attempt.id, userId);
    return {
      success: true,
      already_submitted: true,
      section_name: secName,
      is_all_completed: true,
      completed_sections: completedSections,
      status: finalState?.status || attempt.status,
      attempt_state: finalState
    };
  }

  if (completedSections.includes(secName)) {
    const curState = getAttemptState(attempt.id, userId);
    return {
      success: true,
      already_submitted: true,
      section_name: secName,
      completed_sections: completedSections,
      status: curState?.status || attempt.status,
      attempt_state: curState
    };
  }

  // Resolve targetClassId if missing
  let targetClassId = attempt.class_id;
  if (!targetClassId) {
    const enroll = db.get(
      `SELECT ce.class_id FROM class_enrollments ce
       JOIN classes cl ON cl.id = ce.class_id
       JOIN assessments a ON a.course_id = cl.course_id
       WHERE ce.user_id = ? AND a.id = ? AND ce.status = 'active'
       ORDER BY ce.enrolled_at DESC LIMIT 1`,
      [userId, attempt.assessment_id]
    );
    if (enroll) {
      targetClassId = enroll.class_id;
      db.run('UPDATE student_attempts SET class_id = ? WHERE id = ?', [targetClassId, attemptId]);
      attempt.class_id = targetClassId;
    }
  }

  // Check if section is unlocked for this class
  const { getUnlockedSectionsForClass } = require('./classService');
  const unlockedSections = getUnlockedSectionsForClass(targetClassId);
  if (!unlockedSections.includes(secName)) {
    throw new Error(`Section '${secName}' is currently locked by the instructor.`);
  }

  // Fetch all answers in this section
  let answers = db.all(
    `SELECT aa.*, q.question_type, q.question_text, q.question_description,
            q.answer_options, q.correct_answer, q.answer_explanation, q.explanation_visibility,
            q.points, q.partial_credit, q.negative_marking, q.requires_manual_review
     FROM attempt_answers aa
     LEFT JOIN questions q ON q.id = aa.question_id
     WHERE aa.attempt_id = ? AND TRIM(aa.section_name) = ?`,
    [attemptId, secName]
  );

  if (answers.length === 0) {
    answers = db.all(
      `SELECT aa.*, q.question_type, q.question_text, q.question_description,
              q.answer_options, q.correct_answer, q.answer_explanation, q.explanation_visibility,
              q.points, q.partial_credit, q.negative_marking, q.requires_manual_review
       FROM attempt_answers aa
       LEFT JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = ? AND LOWER(TRIM(aa.section_name)) = LOWER(?)`,
      [attemptId, secName]
    );
  }

  if (answers.length === 0) {
    throw new Error(`No questions found for section '${secName}'.`);
  }

  let sectionScore = 0;
  let sectionMaxScore = 0;
  let hasManualReview = false;

  for (const item of answers) {
    let saved = null;
    try { saved = item.saved_answer ? JSON.parse(item.saved_answer) : null; } catch (e) { saved = item.saved_answer; }
    let correct = null;
    try { correct = item.correct_answer ? JSON.parse(item.correct_answer) : null; } catch (e) { correct = item.correct_answer; }
    let options = null;
    try { options = item.answer_options ? JSON.parse(item.answer_options) : null; } catch (e) { options = item.answer_options; }

    const questionObj = {
      ...item,
      points: item.max_points || item.points || 1,
      correct_answer: correct,
      answer_options: options,
      partial_credit: Boolean(item.partial_credit),
      requires_manual_review: Boolean(item.requires_manual_review)
    };

    const evalResult = evaluateQuestion(questionObj, saved);
    if (evalResult.status === 'awaiting_review') {
      hasManualReview = true;
    }

    sectionScore += evalResult.awardedPoints;
    sectionMaxScore += evalResult.maxPoints;

    db.run(
      `UPDATE attempt_answers
       SET is_correct = ?, awarded_points = ?, marked_status = ?
       WHERE id = ?`,
      [evalResult.isCorrect ? 1 : 0, evalResult.awardedPoints, evalResult.status, item.id]
    );
  }

  if (sectionMaxScore === 0) sectionMaxScore = 1;
  const sectionPercentage = Math.round((sectionScore / sectionMaxScore) * 1000) / 10;
  const passMark = attempt.pass_mark_percentage || 70;
  const isSectionPassed = sectionPercentage >= passMark;

  if (!completedSections.includes(secName)) {
    completedSections.push(secName);
  }

  // Authoritative check across all sections belonging to this assessment:
  const assRow = db.get('SELECT sections FROM assessments WHERE id = ?', [attempt.assessment_id]);
  const configuredSections = parseStoredSections(assRow?.sections);
  const aqSections = db.all(
    `SELECT DISTINCT section_name FROM assessment_questions WHERE assessment_id = ?`,
    [attempt.assessment_id]
  ).map(r => (r.section_name || '').trim()).filter(Boolean);
  const aaSections = db.all(
    `SELECT DISTINCT section_name FROM attempt_answers WHERE attempt_id = ?`,
    [attemptId]
  ).map(r => (r.section_name || '').trim()).filter(Boolean);

  const allDistinctSections = [...new Set([
    ...configuredSections,
    ...aqSections,
    ...aaSections
  ])].filter(Boolean);

  const isAllCompleted = allDistinctSections.length > 0 && allDistinctSections.every(s => completedSections.includes(s));

  if (isAllCompleted) {
    // Score all answers across entire attempt
    const allAnswers = db.all(
      `SELECT aa.*, q.question_type, q.answer_options, q.correct_answer, q.points, q.partial_credit, q.negative_marking, q.requires_manual_review
       FROM attempt_answers aa
       LEFT JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = ?`,
      [attemptId]
    );

    let totalScore = 0;
    let maxScore = 0;
    for (const a of allAnswers) {
      totalScore += (Number(a.awarded_points) || 0);
      maxScore += (Number(a.max_points) || 1);
    }
    if (maxScore === 0) maxScore = 1;
    const overallPercentage = Math.round((totalScore / maxScore) * 10000) / 100;
    const isPassed = overallPercentage >= passMark;
    const finalStatus = hasManualReview ? 'awaiting_review' : 'marked';

    db.run(
      `UPDATE student_attempts
       SET submitted_at = datetime('now'),
           status = ?,
           score = ?,
           max_score = ?,
           percentage = ?,
           is_passed = ?,
           completed_sections = ?
       WHERE id = ?`,
      [finalStatus, totalScore, maxScore, overallPercentage, isPassed ? 1 : 0, JSON.stringify(completedSections), attemptId]
    );

    try {
      const metaKey = `attempt_meta_${attemptId}`;
      const metaId = `setting-meta-${attemptId}`;
      const metaPayload = {
        attempt_id: attemptId,
        user_id: userId,
        class_id: targetClassId,
        assessment_id: attempt.assessment_id,
        completed_sections: completedSections,
        percentage: overallPercentage,
        score: totalScore,
        max_score: maxScore,
        status: finalStatus,
        is_passed: isPassed ? 1 : 0,
        is_all_completed: true,
        submitted_at: new Date().toISOString()
      };
      db.run(
        `INSERT INTO eduque_settings (id, key, value, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [metaId, metaKey, JSON.stringify(metaPayload)]
      );
      const supabaseService = require('./supabaseService');
      supabaseService.syncSettingToSupabase(metaKey).catch(() => {});
    } catch (_) {}

    logAction({
      userId,
      action: 'SUBMIT_ASSESSMENT_ATTEMPT',
      entityType: 'student_attempts',
      entityId: attemptId,
      details: { totalScore, maxScore, percentage: overallPercentage, isPassed, status: finalStatus, completedSections }
    });
  } else {
    // Calculate current cumulative score so far
    const currentScoredAnswers = db.all(
      `SELECT aa.awarded_points, aa.max_points FROM attempt_answers aa WHERE aa.attempt_id = ? AND (aa.marked_status IN ('marked', 'auto_marked', 'manual_marked') OR aa.is_correct IS NOT NULL)`,
      [attemptId]
    );
    let runningScore = 0;
    let runningMaxScore = 0;
    for (const ca of currentScoredAnswers) {
      runningScore += (Number(ca.awarded_points) || 0);
      runningMaxScore += (Number(ca.max_points) || 1);
    }
    const runningPct = runningMaxScore > 0 ? Math.round((runningScore / runningMaxScore) * 1000) / 10 : 0;

    // Calculate remaining seconds to freeze for the review/discussion
    const now = Date.now();
    const deadlineMs = parseUtcDate(attempt.deadline_at).getTime();
    let remainingSec = attempt.is_paused && attempt.paused_remaining_seconds !== null
      ? attempt.paused_remaining_seconds
      : Math.max(0, Math.floor((deadlineMs - now) / 1000));

    db.run(
      `UPDATE student_attempts
       SET score = ?,
           max_score = ?,
           percentage = ?,
           completed_sections = ?,
           is_paused = 1,
           paused_remaining_seconds = ?
       WHERE id = ?`,
      [runningScore, runningMaxScore, runningPct, JSON.stringify(completedSections), remainingSec, attemptId]
    );

    try {
      const settingKey = `completed_sections_attempt_${attemptId}`;
      const settingId = `setting-compsec-${attemptId}`;
      db.run(
        `INSERT INTO eduque_settings (id, key, value, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [settingId, settingKey, JSON.stringify(completedSections)]
      );
      const supabaseService = require('./supabaseService');
      supabaseService.syncSettingToSupabase(settingKey).catch(() => {});

      const metaKey = `attempt_meta_${attemptId}`;
      const metaId = `setting-meta-${attemptId}`;
      const metaPayload = {
        attempt_id: attemptId,
        user_id: userId,
        class_id: targetClassId,
        assessment_id: attempt.assessment_id,
        completed_sections: completedSections,
        percentage: runningPct,
        score: runningScore,
        max_score: runningMaxScore,
        status: 'in_progress',
        is_paused: 1,
        paused_remaining_seconds: remainingSec,
        submitted_at: new Date().toISOString()
      };
      db.run(
        `INSERT INTO eduque_settings (id, key, value, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [metaId, metaKey, JSON.stringify(metaPayload)]
      );
      supabaseService.syncSettingToSupabase(metaKey).catch(() => {});

      const timerKey = `attempt_timer_${attemptId}`;
      const timerId = `setting-timer-${attemptId}`;
      db.run(
        `INSERT INTO eduque_settings (id, key, value, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [timerId, timerKey, JSON.stringify({ is_paused: true, paused_remaining_seconds: remainingSec })]
      );
      supabaseService.syncSettingToSupabase(timerKey).catch(() => {});
    } catch (e) {}

    logAction({
      userId,
      action: 'SUBMIT_ASSESSMENT_SECTION',
      entityType: 'student_attempts',
      entityId: attemptId,
      details: { sectionName: secName, sectionScore, sectionMaxScore, sectionPercentage, isSectionPassed, completedSections }
    });
  }

  // Next section resolution
  const nextSectionIndex = allDistinctSections.indexOf(secName) + 1;
  const nextSection = nextSectionIndex < allDistinctSections.length ? allDistinctSections[nextSectionIndex] : null;
  const isNextUnlocked = nextSection ? unlockedSections.includes(nextSection) : false;

  const attemptState = getAttemptState(attemptId, userId);

  return {
    success: true,
    section_name: secName,
    score: sectionScore,
    max_score: sectionMaxScore,
    percentage: sectionPercentage,
    pass_mark_percentage: passMark,
    is_passed: isSectionPassed,
    is_all_completed: isAllCompleted,
    completed_sections: completedSections,
    unlocked_sections: unlockedSections,
    next_section: nextSection,
    is_next_unlocked: isNextUnlocked,
    status: attemptState.status,
    questions: attemptState.questions,
    attempt_state: attemptState
  };
}

function getAttemptState(attemptId, userId) {
  const db = getDatabase();
  let attempt = db.get(
    `SELECT sa.*, a.name as assessment_name, a.description as assessment_description,
            a.instructions, a.duration_minutes, a.pass_mark_percentage,
            a.allow_back_navigation, a.allow_flagging, a.allow_review_screen,
            a.result_visibility, a.explanation_visibility, a.sections as assessment_sections,
            c.name as course_name, cl.name as class_name
     FROM student_attempts sa
     LEFT JOIN assessments a ON a.id = sa.assessment_id
     LEFT JOIN courses c ON c.id = a.course_id
     LEFT JOIN classes cl ON cl.id = sa.class_id
     WHERE sa.id = ?`,
    [attemptId]
  );

  if (!attempt) {
    const rawSa = db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]);
    if (rawSa) {
      attempt = {
        ...rawSa,
        assessment_name: 'Assessment',
        assessment_description: '',
        instructions: '',
        duration_minutes: 60,
        pass_mark_percentage: 70,
        allow_back_navigation: 1,
        allow_flagging: 1,
        allow_review_screen: 1,
        result_visibility: 'immediate',
        explanation_visibility: 'immediate',
        assessment_sections: JSON.stringify(['Section 1']),
        course_name: 'Course',
        class_name: 'Class'
      };
    } else if (userId) {
      const userActive = db.get(
        "SELECT * FROM student_attempts WHERE user_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1",
        [userId]
      );
      if (userActive) {
        attemptId = userActive.id;
        const assRow = db.get('SELECT name, description, instructions, duration_minutes, pass_mark_percentage, allow_back_navigation, allow_flagging, allow_review_screen, result_visibility, explanation_visibility, sections FROM assessments WHERE id = ?', [userActive.assessment_id]);
        attempt = {
          ...userActive,
          assessment_name: assRow?.name || 'Assessment',
          assessment_description: assRow?.description || '',
          instructions: assRow?.instructions || '',
          duration_minutes: assRow?.duration_minutes || 60,
          pass_mark_percentage: assRow?.pass_mark_percentage ?? 70,
          allow_back_navigation: assRow?.allow_back_navigation ?? 1,
          allow_flagging: assRow?.allow_flagging ?? 1,
          allow_review_screen: assRow?.allow_review_screen ?? 1,
          result_visibility: assRow?.result_visibility ?? 'immediate',
          explanation_visibility: assRow?.explanation_visibility ?? 'immediate',
          assessment_sections: assRow?.sections ?? JSON.stringify(['Section 1']),
          course_name: 'Course',
          class_name: 'Class'
        };
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  // Student authorization check: a student cannot view another student's attempt!
  if (userId && attempt.user_id !== userId) {
    const requestingUser = db.get('SELECT role FROM users WHERE id = ?', [userId]);
    if (requestingUser?.role !== 'administrator' && requestingUser?.role !== 'instructor') {
      throw new Error('Access denied: You are not authorized to view this attempt.');
    }
  }

  let isPaused = Boolean(attempt.is_paused);
  let pausedRemainingSec = attempt.paused_remaining_seconds;
  if (!isPaused) {
    const timerSetting = db.get("SELECT value FROM eduque_settings WHERE key = ?", [`attempt_timer_${attempt.id}`]);
    if (timerSetting && timerSetting.value) {
      try {
        const parsed = JSON.parse(timerSetting.value);
        if (parsed && parsed.is_paused) {
          isPaused = true;
          pausedRemainingSec = parsed.paused_remaining_seconds;
        }
      } catch (_) {}
    }
  }

  // Check if active attempt deadline has passed (only when timer is not paused)
  if (attempt.status === 'in_progress' && !isPaused) {
    const deadline = parseUtcDate(attempt.deadline_at).getTime();
    if (Date.now() >= deadline) {
      return submitAttempt({ attemptId, userId: attempt.user_id, isAuto: true });
    }
  }

  const rawAnswers = db.all(
    `SELECT aa.*, q.question_type, q.question_text, q.question_description,
            q.answer_options, q.correct_answer, q.answer_explanation,
            q.topic, q.difficulty, q.partial_credit,
            (SELECT aq.section_name FROM assessment_questions aq WHERE aq.assessment_id = ? AND aq.question_id = aa.question_id LIMIT 1) as aq_section_name
     FROM attempt_answers aa
     LEFT JOIN questions q ON q.id = aa.question_id
     WHERE aa.attempt_id = ?
     ORDER BY aa.order_index ASC, aa.id ASC`,
    [attempt.assessment_id, attemptId]
  );

  const configuredSections = parseStoredSections(attempt.assessment_sections);
  const isInProgress = attempt.status === 'in_progress';
  const showResults = !isInProgress && attempt.result_visibility !== 'hidden';
  const showExplanations = !isInProgress && (attempt.explanation_visibility === 'immediate' || attempt.explanation_visibility === 'after_submission');

  // Resolve classId if missing on attempt
  let classId = attempt.class_id;
  if (!classId) {
    const enroll = db.get(
      `SELECT ce.class_id FROM class_enrollments ce
       JOIN classes cl ON cl.id = ce.class_id
       JOIN assessments a ON a.course_id = cl.course_id
       WHERE ce.user_id = ? AND a.id = ? AND ce.status = 'active'
       ORDER BY ce.enrolled_at DESC LIMIT 1`,
      [attempt.user_id, attempt.assessment_id]
    );
    if (enroll) {
      classId = enroll.class_id;
      db.run('UPDATE student_attempts SET class_id = ? WHERE id = ?', [classId, attemptId]);
      attempt.class_id = classId;
    }
  }

  if (classId) {
    try {
      const { getClassAssessmentConfig } = require('./classService');
      const classConfig = getClassAssessmentConfig(classId, attempt.assessment_id);
      if (classConfig && classConfig.pass_mark_percentage) {
        attempt.pass_mark_percentage = classConfig.pass_mark_percentage;
      }
    } catch (_) {}
  }

  const { getUnlockedSectionsForClass } = require('./classService');
  const unlockedSections = getUnlockedSectionsForClass(classId);
  const completedSections = parseCompletedSections(attempt.completed_sections, attempt.id);

  const questions = rawAnswers.map(row => {
    let savedAnswer = null;
    let answerOptions = [];
    try { savedAnswer = row.saved_answer ? JSON.parse(row.saved_answer) : null; } catch (e) { savedAnswer = row.saved_answer; }
    try { answerOptions = row.answer_options ? JSON.parse(row.answer_options) : []; } catch (e) { answerOptions = row.answer_options; }

    let secName = (row.section_name || row.aq_section_name || '').trim();
    if (!secName || (secName === 'General' && !configuredSections.includes('General'))) {
      secName = configuredSections[0] || 'Section 1';
    }

    const isSecCompleted = completedSections.includes(secName);
    const isSecUnlocked = unlockedSections.includes(secName);

    const item = {
      id: row.question_id,
      answer_id: row.id,
      section_name: secName,
      question_type: row.question_type || 'single_choice',
      question_text: row.question_text || 'Question',
      question_description: row.question_description || '',
      answer_options: answerOptions,
      saved_answer: savedAnswer,
      is_flagged: Boolean(row.is_flagged),
      max_points: row.max_points || 1,
      topic: row.topic || '',
      difficulty: row.difficulty || 'medium',
      is_completed_section: isSecCompleted,
      is_locked: !isSecUnlocked
    };

    if (showResults || isSecCompleted) {
      item.is_correct = Boolean(row.is_correct);
      item.awarded_points = row.awarded_points ?? 0;
      item.marked_status = row.marked_status || 'marked';
      if (showExplanations || isSecCompleted) {
        let correct = null;
        try { correct = row.correct_answer ? JSON.parse(row.correct_answer) : null; } catch (e) { correct = row.correct_answer; }
        item.correct_answer = correct;
        item.answer_explanation = row.answer_explanation || '';
      }
    }

    return item;
  });

  // Build ordered section names for this attempt
  const orderedSectionNames = [...configuredSections];
  for (const q of questions) {
    if (q.section_name && !orderedSectionNames.includes(q.section_name)) {
      orderedSectionNames.push(q.section_name);
    }
  }

  // Group questions in section order so section-by-section progression is contiguous
  questions.sort((a, b) => {
    const idxA = orderedSectionNames.indexOf(a.section_name);
    const idxB = orderedSectionNames.indexOf(b.section_name);
    return idxA - idxB;
  });

  const passMark = attempt.pass_mark_percentage || 70;
  const sectionsBreakdown = orderedSectionNames
    .map((secName, secIdx) => {
      const secQuestions = questions.filter(q => q.section_name === secName);
      const secAnswered = secQuestions.filter(q => q.saved_answer !== null && q.saved_answer !== undefined && q.saved_answer !== '').length;
      const secScore = secQuestions.reduce((sum, q) => sum + (Number(q.awarded_points) || 0), 0);
      const secMaxScore = secQuestions.reduce((sum, q) => sum + (Number(q.max_points) || 1), 0);
      const secPct = secMaxScore > 0 ? Math.round((secScore / secMaxScore) * 1000) / 10 : 0;
      const isCompleted = completedSections.includes(secName) || (!isInProgress && secQuestions.length > 0 && secAnswered === secQuestions.length);
      const isUnlocked = unlockedSections.includes(secName);

      return {
        name: secName,
        order_index: secIdx,
        total_questions: secQuestions.length,
        answered_count: secAnswered,
        unanswered_count: secQuestions.length - secAnswered,
        is_completed: isCompleted,
        is_unlocked: isUnlocked,
        score: (isCompleted || showResults) ? secScore : null,
        max_score: secMaxScore,
        percentage: (isCompleted || showResults) ? secPct : null,
        is_passed: (isCompleted || showResults) ? (secPct >= passMark) : null,
        needs_help: (isCompleted || showResults) && secQuestions.length > 0 ? secPct < passMark : false
      };
    })
    .filter(sec => sec.total_questions > 0 || orderedSectionNames.length <= 3);

  const activeSecObj = sectionsBreakdown.find(s => s.total_questions > 0 && !s.is_completed) || sectionsBreakdown[sectionsBreakdown.length - 1];
  const activeSecName = activeSecObj ? activeSecObj.name : 'Section 1';
  const isActiveSecUnlocked = activeSecObj ? activeSecObj.is_unlocked : true;
  const currentSectionIndex = activeSecObj ? sectionsBreakdown.indexOf(activeSecObj) : 0;

  const answeredCount = questions.filter(q => q.saved_answer !== null && q.saved_answer !== undefined && q.saved_answer !== '').length;
  const unansweredCount = questions.length - answeredCount;
  const flaggedCount = questions.filter(q => q.is_flagged).length;

  return {
    id: attempt.id,
    assessment_id: attempt.assessment_id,
    assessment_name: attempt.assessment_name,
    assessment_description: attempt.assessment_description,
    instructions: attempt.instructions,
    course_name: attempt.course_name,
    class_id: classId,
    class_name: attempt.class_name,
    attempt_number: attempt.attempt_number,
    started_at: attempt.started_at,
    deadline_at: attempt.deadline_at,
    submitted_at: attempt.submitted_at,
    status: attempt.status,
    is_paused: isPaused,
    paused_remaining_seconds: pausedRemainingSec,
    time_remaining_seconds: isPaused
      ? pausedRemainingSec
      : Math.max(0, Math.floor((parseUtcDate(attempt.deadline_at).getTime() - Date.now()) / 1000)),
    score: attempt.score,
    max_score: attempt.max_score,
    percentage: attempt.percentage,
    pass_mark_percentage: passMark,
    is_passed: Boolean(attempt.is_passed),
    score_recalculated: Boolean(attempt.score_recalculated),
    recalculation_reason: attempt.recalculation_reason,
    allow_back_navigation: Boolean(attempt.allow_back_navigation),
    allow_flagging: Boolean(attempt.allow_flagging),
    allow_review_screen: Boolean(attempt.allow_review_screen),
    sections: sectionsBreakdown,
    completed_sections: completedSections,
    unlocked_sections: unlockedSections,
    active_section_name: activeSecName,
    is_active_section_unlocked: isActiveSecUnlocked,
    current_section_index: currentSectionIndex,
    current_section_name: activeSecName,
    questions,
    total_questions: questions.length,
    answered_count: answeredCount,
    unanswered_count: unansweredCount,
    flagged_count: flaggedCount
  };
}

/**
 * Score Recalculation (Section 14)
 */

function resumeAttemptTimer({ attemptId, userId, sectionName = null }) {
  const db = getDatabase();
  const attempt = db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]);
  if (!attempt) throw new Error('Attempt not found.');
  if (userId && attempt.user_id !== userId) {
    const requestingUser = db.get('SELECT role FROM users WHERE id = ?', [userId]);
    if (requestingUser?.role !== 'administrator' && requestingUser?.role !== 'instructor') {
      throw new Error('Access denied: Unauthorized attempt access.');
    }
  }

  if (attempt.status !== 'in_progress') {
    return getAttemptState(attemptId, userId);
  }

  let isPaused = Boolean(attempt.is_paused);
  let pausedRemainingSec = attempt.paused_remaining_seconds;

  if (!isPaused) {
    const timerSetting = db.get("SELECT value FROM eduque_settings WHERE key = ?", [`attempt_timer_${attemptId}`]);
    if (timerSetting && timerSetting.value) {
      try {
        const parsed = JSON.parse(timerSetting.value);
        if (parsed && parsed.is_paused) {
          isPaused = true;
          pausedRemainingSec = parsed.paused_remaining_seconds;
        }
      } catch (_) {}
    }
  }

  // If a specific section is provided, check for a per-section timer override
  if (sectionName && attempt.class_id) {
    try {
      const { getClassAssessmentConfig } = require('./classService');
      const classConfig = getClassAssessmentConfig(attempt.class_id, attempt.assessment_id);
      const secRule = classConfig?.sections?.[sectionName] || classConfig?.sections?.[sectionName.trim()];
      if (secRule && Number(secRule.time_limit_minutes) > 0) {
        pausedRemainingSec = Number(secRule.time_limit_minutes) * 60;
        isPaused = true;
      }
    } catch (_) {}
  }

  if (isPaused && pausedRemainingSec !== null && pausedRemainingSec !== undefined) {
    const now = Date.now();
    const newDeadline = new Date(now + (Math.max(1, pausedRemainingSec) * 1000)).toISOString();
    db.run(
      `UPDATE student_attempts
       SET is_paused = 0,
           paused_remaining_seconds = NULL,
           deadline_at = ?
       WHERE id = ?`,
      [newDeadline, attemptId]
    );

    try {
      const timerKey = `attempt_timer_${attemptId}`;
      const timerId = `setting-timer-${attemptId}`;
      db.run(
        `INSERT INTO eduque_settings (id, key, value, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [timerId, timerKey, JSON.stringify({ is_paused: false, paused_remaining_seconds: null })]
      );
      const supabaseService = require('./supabaseService');
      supabaseService.syncSettingToSupabase(timerKey).catch(() => {});
    } catch (e) {}

    logAction({
      userId,
      username: 'student',
      action: 'RESUME_ATTEMPT_TIMER',
      entityType: 'student_attempts',
      entityId: attemptId,
      details: { sectionName, resumedAt: new Date(now).toISOString(), newDeadline, remainingSeconds: pausedRemainingSec }
    });
  }

  return getAttemptState(attemptId, userId);
}

function recalculateAttemptScore(attemptId, reason, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const attempt = db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]);
  if (!attempt) throw new Error('Attempt not found.');

  const answers = db.all(
    `SELECT aa.*, q.question_type, q.correct_answer, q.answer_options, q.points, q.partial_credit, q.requires_manual_review
     FROM attempt_answers aa
     LEFT JOIN questions q ON q.id = aa.question_id
     WHERE aa.attempt_id = ?`,
    [attemptId]
  );

  let totalScore = 0;
  let maxScore = 0;

  for (const item of answers) {
    let saved = null;
    try { saved = item.saved_answer ? JSON.parse(item.saved_answer) : null; } catch (e) { saved = item.saved_answer; }
    let correct = null;
    try { correct = item.correct_answer ? JSON.parse(item.correct_answer) : null; } catch (e) { correct = item.correct_answer; }
    let options = null;
    try { options = item.answer_options ? JSON.parse(item.answer_options) : null; } catch (e) { options = item.answer_options; }

    const q = {
      ...item,
      points: item.max_points || item.points || 1,
      correct_answer: correct,
      answer_options: options,
      partial_credit: Boolean(item.partial_credit),
      requires_manual_review: Boolean(item.requires_manual_review)
    };

    const evalResult = evaluateQuestion(q, saved);
    totalScore += evalResult.awardedPoints;
    maxScore += evalResult.maxPoints;

    db.run(
      `UPDATE attempt_answers
       SET is_correct = ?, awarded_points = ?, marked_status = ?
       WHERE id = ?`,
      [evalResult.isCorrect ? 1 : 0, evalResult.awardedPoints, evalResult.status, item.id]
    );
  }

  if (maxScore === 0) maxScore = 1;
  const percentage = Math.round((totalScore / maxScore) * 10000) / 100;
  const assessment = db.get('SELECT pass_mark_percentage FROM assessments WHERE id = ?', [attempt.assessment_id]);
  const isPassed = percentage >= (assessment?.pass_mark_percentage || 70);

  db.run(
    `UPDATE student_attempts
     SET original_score = COALESCE(original_score, score),
         score = ?,
         max_score = ?,
         percentage = ?,
         is_passed = ?,
         score_recalculated = 1,
         recalculation_reason = ?,
         recalculated_at = datetime('now'),
         recalculated_by = ?
     WHERE id = ?`,
    [totalScore, maxScore, percentage, isPassed ? 1 : 0, reason, adminUserId, attemptId]
  );

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'RECALCULATE_ATTEMPT_SCORE',
    entityType: 'student_attempts',
    entityId: attemptId,
    details: {
      originalScore: attempt.score,
      newScore: totalScore,
      percentage,
      reason
    }
  });

  return getAttemptState(attemptId, adminUserId);
}

function endAttempt({ attemptId, userId }) {
  return submitAttempt({ attemptId, userId, isAuto: false });
}

function restartAttempt({ attemptId = null, userId, assessmentId = null, classId = null, submitExisting = false }) {
  const db = getDatabase();

  let targetAssessmentId = assessmentId;
  let targetClassId = classId;

  if (attemptId) {
    const existing = db.get('SELECT * FROM student_attempts WHERE id = ? AND user_id = ?', [attemptId, userId]);
    if (!existing) {
      throw new Error('Attempt not found.');
    }
    if (!targetAssessmentId) targetAssessmentId = existing.assessment_id;
    if (!targetClassId) targetClassId = existing.class_id;
  }

  if (!targetAssessmentId) {
    throw new Error('Assessment ID is required to restart an assessment.');
  }

  return startAttempt({
    userId,
    assessmentId: targetAssessmentId,
    classId: targetClassId,
    forceNew: true,
    submitExisting: Boolean(submitExisting)
  });
}

function getActiveAttemptForUser(userId, assessmentId) {
  const db = getDatabase();
  return db.get(
    `SELECT id, assessment_id, user_id, class_id, attempt_number, started_at, deadline_at, status, is_paused, paused_remaining_seconds, completed_sections
     FROM student_attempts
     WHERE user_id = ? AND assessment_id = ? AND status = 'in_progress'
     ORDER BY started_at DESC LIMIT 1`,
    [userId, assessmentId]
  );
}

module.exports = {
  startAttempt,
  autosaveAnswer,
  submitAttempt,
  submitSection,
  resumeAttemptTimer,
  endAttempt,
  restartAttempt,
  getAttemptState,
  getActiveAttemptForUser,
  recalculateAttemptScore
};
