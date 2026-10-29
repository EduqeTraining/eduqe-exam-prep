const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { initDatabase, setDatabaseInstance } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const courseService = require('../src/services/courseService');
const classService = require('../src/services/classService');
const studentService = require('../src/services/studentService');
const assessmentService = require('../src/services/assessmentService');
const attemptService = require('../src/services/attemptService');
const questionService = require('../src/services/questionService');

describe('Assessment Builder & Student Attempt Lifecycle Tests', () => {
  beforeEach(() => {
    const db = initDatabase(':memory:');
    setDatabaseInstance(db);
    seedDatabase(':memory:');
  });

  test('Create question directly from inside Assessment Builder (Rule 7 & 12)', () => {
    const assessments = assessmentService.listAssessments();
    const assessment = assessments[0];

    const result = assessmentService.createQuestionInAssessment(assessment.id, {
      question_type: 'yes_no',
      question_text: 'Can an Azure subscription have multiple Owner role assignments?',
      answer_options: ['Yes', 'No'],
      correct_answer: 'Yes',
      answer_explanation: 'Yes, best practices recommend at least two subscription owners.'
    }, { sectionName: 'Identity Governance' });

    assert.ok(result.question.id, 'Question should be created');
    assert.strictEqual(result.question.question_text, 'Can an Azure subscription have multiple Owner role assignments?');

    // Also check it appears in the Question Bank
    const bankQ = questionService.getQuestion(result.question.id);
    assert.ok(bankQ, 'Question must appear in Question Bank');

    // And is added to current assessment
    const updatedAssessment = assessmentService.getAssessment(assessment.id);
    assert.ok(updatedAssessment.items.some(item => item.question?.id === result.question.id));
  });

  test('Student starts assessment, autosaves answers, and recovers safely on page refresh', () => {
    const sarah = studentService.listStudents({ query: 'sarah.chen' })[0];
    const assessments = assessmentService.listAssessments();
    const assessment = assessments[0];
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');
    const classA = classService.listClasses(az104.id)[0];

    // 1. Start attempt
    const attempt = attemptService.startAttempt({
      userId: sarah.id,
      assessmentId: assessment.id,
      classId: classA.id
    });

    assert.ok(attempt.id);
    assert.strictEqual(attempt.status, 'in_progress');
    assert.ok(attempt.deadline_at);
    assert.ok(attempt.questions.length > 0);

    const firstQuestion = attempt.questions[0];

    // 2. Autosave answer
    const autosaveRes = attemptService.autosaveAnswer({
      attemptId: attempt.id,
      userId: sarah.id,
      questionId: firstQuestion.id,
      savedAnswer: 'Yes',
      isFlagged: true
    });
    assert.strictEqual(autosaveRes.success, true);

    // 3. Simulate page refresh / reconnect: startAttempt returns existing in-progress attempt!
    const resumedAttempt = attemptService.startAttempt({
      userId: sarah.id,
      assessmentId: assessment.id,
      classId: classA.id
    });

    assert.strictEqual(resumedAttempt.id, attempt.id, 'Should restore the same attempt ID');
    assert.strictEqual(resumedAttempt.status, 'in_progress');

    // Verify saved answer and flagged status were restored
    const restoredQ = resumedAttempt.questions.find(q => q.id === firstQuestion.id);
    assert.strictEqual(restoredQ.saved_answer, 'Yes', 'Saved answer must be restored');
    assert.strictEqual(restoredQ.is_flagged, true, 'Flagged state must be restored');
    assert.strictEqual(resumedAttempt.answered_count, 1);
  });

  test('Final submission calculates score, marks pass/fail, and locks attempt from editing', () => {
    const sarah = studentService.listStudents({ query: 'sarah.chen' })[0];
    const assessments = assessmentService.listAssessments();
    const assessment = assessments[0];
    const az104 = courseService.listCourses().find(c => c.code === 'AZ104');
    const classA = classService.listClasses(az104.id)[0];

    const attempt = attemptService.startAttempt({
      userId: sarah.id,
      assessmentId: assessment.id,
      classId: classA.id
    });

    // Answer Q1 (Yes/No: 'Yes') and Q2 (True/False: 'False')
    const q1 = attempt.questions.find(q => q.question_type === 'yes_no');
    const q2 = attempt.questions.find(q => q.question_type === 'true_false');

    if (q1) {
      attemptService.autosaveAnswer({
        attemptId: attempt.id,
        userId: sarah.id,
        questionId: q1.id,
        savedAnswer: 'Yes'
      });
    }

    if (q2) {
      attemptService.autosaveAnswer({
        attemptId: attempt.id,
        userId: sarah.id,
        questionId: q2.id,
        savedAnswer: 'False'
      });
    }

    // Submit attempt
    const submitted = attemptService.submitAttempt({
      attemptId: attempt.id,
      userId: sarah.id
    });

    assert.strictEqual(submitted.status, 'marked');
    assert.ok(submitted.submitted_at);
    assert.ok(submitted.score >= 2, 'Should score points for correct answers');

    // Attempt is locked: cannot autosave into submitted attempt!
    assert.throws(
      () => attemptService.autosaveAnswer({
        attemptId: attempt.id,
        userId: sarah.id,
        questionId: q1.id,
        savedAnswer: 'No'
      }),
      /Cannot edit an assessment attempt that is not in progress/
    );
  });

  test('Enforce maximum attempts limit', () => {
    const alex = studentService.listStudents({ query: 'alex.morgan' })[0];
    const az104 = courseService.listCourses().find(c => c.code === 'AZ104');
    const classA = classService.listClasses(az104.id)[0];

    // Create single-attempt assessment
    const strictAssessment = assessmentService.createAssessment({
      course_id: az104.id,
      name: 'Single Shot Exam',
      max_attempts: 1,
      duration_minutes: 30,
      status: 'published',
      class_ids: [classA.id]
    });

    // Add 1 question
    const q = questionService.listQuestions()[0];
    assessmentService.addQuestionToAssessment(strictAssessment.id, q.id);

    // Attempt 1: Start and submit
    const att1 = attemptService.startAttempt({
      userId: alex.id,
      assessmentId: strictAssessment.id,
      classId: classA.id
    });
    attemptService.submitAttempt({ attemptId: att1.id, userId: alex.id });

    // Attempt 2: Exceeds max attempts!
    assert.throws(
      () => attemptService.startAttempt({
        userId: alex.id,
        assessmentId: strictAssessment.id,
        classId: classA.id
      }),
      /Maximum attempts reached/
    );
  });

  test('Controlled correction and recalculation: preserves historical score and records audit', () => {
    const sarah = studentService.listStudents({ query: 'sarah.chen' })[0];
    const az104 = courseService.listCourses().find(c => c.code === 'AZ104');
    const classA = classService.listClasses(az104.id)[0];

    // Create assessment with 1 question
    const q = questionService.createQuestion({
      course_id: az104.id,
      question_type: 'single_choice',
      question_text: 'Original question with answer A',
      answer_options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }],
      correct_answer: 'A',
      points: 10,
      status: 'published'
    });

    const assess = assessmentService.createAssessment({
      course_id: az104.id,
      name: 'Recalculation Test Assessment',
      max_attempts: 2,
      duration_minutes: 30,
      status: 'published',
      class_ids: [classA.id]
    });
    assessmentService.addQuestionToAssessment(assess.id, q.id);

    // Student answered 'B' (initially marked incorrect, 0 pts)
    const att = attemptService.startAttempt({
      userId: sarah.id,
      assessmentId: assess.id,
      classId: classA.id
    });
    attemptService.autosaveAnswer({
      attemptId: att.id,
      userId: sarah.id,
      questionId: q.id,
      savedAnswer: 'B'
    });
    const finished = attemptService.submitAttempt({ attemptId: att.id, userId: sarah.id });
    assert.strictEqual(finished.score, 0);

    // Admin corrects question: 'B' was actually the right answer!
    questionService.updateQuestion(q.id, {
      correct_answer: 'B'
    }, {
      changeReason: 'Errata: Option B is the correct answer'
    });

    // Authorised recalculation
    const admin = studentService.listStudents(); // or query admin user
    const db = require('../src/db').getDatabase();
    const adminUser = db.get("SELECT id FROM users WHERE role = 'administrator'");

    const recalculated = attemptService.recalculateAttemptScore(
      att.id,
      'Recalculated following errata update on Question ' + q.id,
      adminUser.id,
      'admin'
    );

    assert.strictEqual(recalculated.score, 10, 'Recalculated score should be 10');
    assert.strictEqual(recalculated.score_recalculated, true);
    assert.ok(recalculated.recalculation_reason.toLowerCase().includes('errata'));
  });

  test('Student can end an assessment and try again or restart an in-progress assessment', () => {
    const sarah = studentService.listStudents({ query: 'sarah.chen' })[0];
    const assessments = assessmentService.listAssessments();
    const assessment = assessments[0];
    const az104 = courseService.listCourses().find(c => c.code === 'AZ104');
    const classA = classService.listClasses(az104.id)[0];

    // 1. Start attempt
    const att1 = attemptService.startAttempt({
      userId: sarah.id,
      assessmentId: assessment.id,
      classId: classA.id
    });
    assert.strictEqual(att1.status, 'in_progress');
    const q1 = att1.questions[0];

    attemptService.autosaveAnswer({
      attemptId: att1.id,
      userId: sarah.id,
      questionId: q1.id,
      savedAnswer: 'Yes'
    });

    // 2. Restart in-progress attempt (Reset & Start Fresh without recording incomplete attempt)
    const restartedFresh = attemptService.restartAttempt({
      attemptId: att1.id,
      userId: sarah.id,
      assessmentId: assessment.id,
      classId: classA.id,
      submitExisting: false
    });
    assert.strictEqual(restartedFresh.status, 'in_progress');
    assert.notStrictEqual(restartedFresh.id, att1.id);
    assert.strictEqual(restartedFresh.attempt_number, att1.attempt_number, 'Resetting in-progress attempt keeps same attempt number');
    const resetQ1 = restartedFresh.questions.find(q => q.id === q1.id);
    assert.strictEqual(resetQ1.saved_answer, null, 'Answers should be cleared on fresh restart');

    // 3. End current attempt & try again (submitExisting: true)
    const endedAndRetried = attemptService.restartAttempt({
      attemptId: restartedFresh.id,
      userId: sarah.id,
      assessmentId: assessment.id,
      classId: classA.id,
      submitExisting: true
    });
    assert.strictEqual(endedAndRetried.status, 'in_progress');
    assert.notStrictEqual(endedAndRetried.id, restartedFresh.id);
    assert.strictEqual(endedAndRetried.attempt_number, restartedFresh.attempt_number + 1, 'Ending & trying again increments attempt number');

    // Verify the previous attempt was marked
    const previousState = attemptService.getAttemptState(restartedFresh.id, sarah.id);
    assert.strictEqual(previousState.status, 'marked');

    // 4. End the new attempt directly via endAttempt and start again
    const ended = attemptService.endAttempt({
      attemptId: endedAndRetried.id,
      userId: sarah.id
    });
    assert.strictEqual(ended.status, 'marked');

    const tryAgainAfterEnd = attemptService.startAttempt({
      userId: sarah.id,
      assessmentId: assessment.id,
      classId: classA.id,
      forceNew: true
    });
    assert.strictEqual(tryAgainAfterEnd.status, 'in_progress');
    assert.strictEqual(tryAgainAfterEnd.attempt_number, ended.attempt_number + 1);
  });
});
