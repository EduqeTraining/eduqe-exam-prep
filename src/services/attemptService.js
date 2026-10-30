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

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
    throw new Error('Assessment availability window has closed.');
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
      const deadline = parseUtcDate(existingInProgress.deadline_at).getTime();
      if (now >= deadline) {
        // Auto-submit expired attempt
        submitAttempt({ attemptId: existingInProgress.id, userId, isAuto: true });
      } else {
        // Resume active attempt
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
  const deadlineDate = new Date(now + durationMs).toISOString();
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

  // Insert attempt record
  db.run(
    `INSERT INTO student_attempts (id, assessment_id, user_id, class_id, attempt_number, started_at, deadline_at, status)
     VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 'in_progress')`,
    [attemptId, assessmentId, userId, targetClassId, newAttemptNumber, deadlineDate]
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
    }
  }

  db.run(
    `UPDATE attempt_answers
     SET saved_answer = COALESCE(?, saved_answer),
         is_flagged = COALESCE(?, is_flagged),
         is_correct = COALESCE(?, is_correct),
         awarded_points = COALESCE(?, awarded_points),
         saved_at = datetime('now')
     WHERE attempt_id = ? AND question_id = ?`,
    [
      answerJson,
      isFlagged !== null && isFlagged !== undefined ? (isFlagged ? 1 : 0) : null,
      isCorrectVal,
      awardedPointsVal,
      attemptId,
      questionId
    ]
  );

  return { success: true, saved_at: new Date().toISOString() };
}

function submitAttempt({ attemptId, userId, isAuto = false }) {
  const db = getDatabase();
  const attempt = db.get(
    `SELECT sa.*, a.pass_mark_percentage, a.result_visibility, a.explanation_visibility
     FROM student_attempts sa
     JOIN assessments a ON a.id = sa.assessment_id
     WHERE sa.id = ?`,
    [attemptId]
  );

  if (!attempt) throw new Error('Attempt not found.');
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
     JOIN questions q ON q.id = aa.question_id
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

  db.run(
    `UPDATE student_attempts
     SET submitted_at = datetime('now'),
         status = ?,
         score = ?,
         max_score = ?,
         percentage = ?,
         is_passed = ?
     WHERE id = ?`,
    [finalStatus, totalScore, maxScore, percentage, isPassed ? 1 : 0, attemptId]
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

function getAttemptState(attemptId, userId) {
  const db = getDatabase();
  const attempt = db.get(
    `SELECT sa.*, a.name as assessment_name, a.description as assessment_description,
            a.instructions, a.duration_minutes, a.pass_mark_percentage,
            a.allow_back_navigation, a.allow_flagging, a.allow_review_screen,
            a.result_visibility, a.explanation_visibility, a.sections as assessment_sections,
            c.name as course_name, cl.name as class_name
     FROM student_attempts sa
     JOIN assessments a ON a.id = sa.assessment_id
     LEFT JOIN courses c ON c.id = a.course_id
     LEFT JOIN classes cl ON cl.id = sa.class_id
     WHERE sa.id = ?`,
    [attemptId]
  );

  if (!attempt) return null;

  // Student authorization check: a student cannot view another student's attempt!
  if (userId && attempt.user_id !== userId) {
    const requestingUser = db.get('SELECT role FROM users WHERE id = ?', [userId]);
    if (requestingUser?.role !== 'administrator' && requestingUser?.role !== 'instructor') {
      throw new Error('Access denied: You are not authorized to view this attempt.');
    }
  }

  // Check if active attempt deadline has passed
  if (attempt.status === 'in_progress') {
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
     JOIN questions q ON q.id = aa.question_id
     WHERE aa.attempt_id = ?
     ORDER BY aa.order_index ASC, aa.id ASC`,
    [attempt.assessment_id, attemptId]
  );

  const configuredSections = parseStoredSections(attempt.assessment_sections);
  const isInProgress = attempt.status === 'in_progress';
  const showResults = !isInProgress && attempt.result_visibility !== 'hidden';
  const showExplanations = !isInProgress && (attempt.explanation_visibility === 'immediate' || attempt.explanation_visibility === 'after_submission');

  const questions = rawAnswers.map(row => {
    let savedAnswer = null;
    let answerOptions = [];
    try { savedAnswer = row.saved_answer ? JSON.parse(row.saved_answer) : null; } catch (e) { savedAnswer = row.saved_answer; }
    try { answerOptions = row.answer_options ? JSON.parse(row.answer_options) : []; } catch (e) { answerOptions = row.answer_options; }

    let secName = (row.aq_section_name || row.section_name || '').trim();
    if (!secName || (secName === 'General' && !configuredSections.includes('General'))) {
      secName = configuredSections[0] || 'Section 1';
    }

    const item = {
      id: row.question_id,
      answer_id: row.id,
      section_name: secName,
      question_type: row.question_type,
      question_text: row.question_text,
      question_description: row.question_description,
      answer_options: answerOptions,
      saved_answer: savedAnswer,
      is_flagged: Boolean(row.is_flagged),
      max_points: row.max_points,
      topic: row.topic,
      difficulty: row.difficulty
    };

    if (showResults) {
      item.is_correct = Boolean(row.is_correct);
      item.awarded_points = row.awarded_points;
      item.marked_status = row.marked_status;
      if (showExplanations) {
        let correct = null;
        try { correct = row.correct_answer ? JSON.parse(row.correct_answer) : null; } catch (e) { correct = row.correct_answer; }
        item.correct_answer = correct;
        item.answer_explanation = row.answer_explanation;
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
      const isCompleted = secQuestions.length > 0 && secAnswered === secQuestions.length;

      return {
        name: secName,
        order_index: secIdx,
        total_questions: secQuestions.length,
        answered_count: secAnswered,
        unanswered_count: secQuestions.length - secAnswered,
        is_completed: isCompleted,
        score: showResults ? secScore : null,
        max_score: secMaxScore,
        percentage: showResults ? secPct : null,
        needs_help: showResults && secQuestions.length > 0 ? secPct < passMark : false
      };
    })
    .filter(sec => sec.total_questions > 0 || orderedSectionNames.length <= 3);

  const activeSecIdx = sectionsBreakdown.findIndex(s => s.total_questions > 0 && !s.is_completed);
  const currentSectionIndex = activeSecIdx >= 0 ? activeSecIdx : Math.max(0, sectionsBreakdown.length - 1);

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
    class_name: attempt.class_name,
    attempt_number: attempt.attempt_number,
    started_at: attempt.started_at,
    deadline_at: attempt.deadline_at,
    submitted_at: attempt.submitted_at,
    status: attempt.status,
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
    current_section_index: currentSectionIndex,
    current_section_name: sectionsBreakdown[currentSectionIndex]?.name || 'Section 1',
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
function recalculateAttemptScore(attemptId, reason, adminUserId = null, adminUsername = 'admin') {
  const db = getDatabase();
  const attempt = db.get('SELECT * FROM student_attempts WHERE id = ?', [attemptId]);
  if (!attempt) throw new Error('Attempt not found.');

  const answers = db.all(
    `SELECT aa.*, q.question_type, q.correct_answer, q.answer_options, q.points, q.partial_credit, q.requires_manual_review
     FROM attempt_answers aa
     JOIN questions q ON q.id = aa.question_id
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

module.exports = {
  startAttempt,
  autosaveAnswer,
  submitAttempt,
  endAttempt,
  restartAttempt,
  getAttemptState,
  recalculateAttemptScore
};
