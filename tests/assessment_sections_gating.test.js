const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Ensure fresh test database
const testDbPath = path.join(__dirname, '..', 'data', 'test_sections_gating.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
process.env.DB_PATH = testDbPath;
process.env.SUPABASE_SYNC = 'false';

const { initDatabase, getDatabase } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const { createClass, getUnlockedSectionsForClass, setUnlockedSectionsForClass } = require('../src/services/classService');
const { startAttempt, autosaveAnswer, submitSection, submitAttempt, getAttemptState, getActiveAttemptForUser } = require('../src/services/attemptService');
const { getInstructorClassProgress } = require('../src/services/instructorService');

test('Instructor-Led Section Locking & Progressive Gating Lifecycle Suite', async (t) => {
  initDatabase();
  seedDatabase();
  const db = getDatabase();

  // Retrieve seed student and instructor
  const student = db.get("SELECT * FROM users WHERE username = 'alex.morgan'");
  const instructor = db.get("SELECT * FROM users WHERE username = 'evelyn.reed'");
  const course = db.get("SELECT * FROM courses WHERE code = 'AZ104'");
  const assessment = db.get("SELECT * FROM assessments WHERE course_id = ?", [course.id]);

  // Create a dedicated test class with 3 sections
  const testClass = createClass({
    courseId: course.id,
    name: 'Gated Cohort Alpha',
    instructorId: instructor.id,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    capacity: 20
  }, instructor.id, instructor.username);

  // Enroll student
  db.run("INSERT INTO class_enrollments (id, class_id, user_id) VALUES (?, ?, ?)", [
    'enroll-' + Date.now(), testClass.id, student.id
  ]);

  await t.test('1. Cohort initializes with Section 1 unlocked by default', () => {
    const unlocked = getUnlockedSectionsForClass(testClass.id);
    assert.deepEqual(unlocked, ['Section 1']);
  });

  let attempt = null;

  await t.test('2. Student starts attempt with Section 1 active and later sections locked', () => {
    attempt = startAttempt({
      userId: student.id,
      assessmentId: assessment.id,
      classId: testClass.id,
      forceNew: true
    });

    assert.ok(attempt.id);
    assert.equal(attempt.status, 'in_progress');
    assert.deepEqual(attempt.unlocked_sections, ['Section 1']);
    assert.deepEqual(attempt.completed_sections, []);

    // Verify question locking flags
    const sec1Q = attempt.questions.find(q => (q.section_name || 'Section 1') === 'Section 1');
    const sec2Q = attempt.questions.find(q => (q.section_name || '') === 'Section 2');

    assert.ok(sec1Q, 'Must have at least one Section 1 question');
    assert.equal(sec1Q.is_locked, false, 'Section 1 question must be unlocked');
    assert.equal(sec1Q.is_completed_section, false);

    if (sec2Q) {
      assert.equal(sec2Q.is_locked, true, 'Section 2 question must be locked');
      assert.equal(sec2Q.is_completed_section, false);
    }
  });

  await t.test('3. Student can answer Section 1, but cannot answer locked Section 2', () => {
    const sec1Q = attempt.questions.find(q => (q.section_name || 'Section 1') === 'Section 1');
    const sec2Q = attempt.questions.find(q => (q.section_name || '') === 'Section 2');

    // Answer Section 1
    const saveRes = autosaveAnswer({
      attemptId: attempt.id,
      userId: student.id,
      questionId: sec1Q.id,
      savedAnswer: sec1Q.question_type === 'yes_no' ? 'Yes' : 'opt_1',
      isFlagged: false
    });
    assert.ok(saveRes.success);

    // Attempting to answer Section 2 must throw locked error
    if (sec2Q) {
      assert.throws(() => {
        autosaveAnswer({
          attemptId: attempt.id,
          userId: student.id,
          questionId: sec2Q.id,
          savedAnswer: 'opt_1',
          isFlagged: false
        });
      }, /is currently locked/i);
    }
  });

  await t.test('3b. Autosave to locked section is blocked and preserves paused timer without unpausing', () => {
    const sec2Q = attempt.questions.find(q => (q.section_name || '') === 'Section 2');
    if (sec2Q) {
      // Temporarily pause attempt to test that locked autosave does NOT unpause timer
      db.run('UPDATE student_attempts SET is_paused = 1, paused_remaining_seconds = 1800 WHERE id = ?', [attempt.id]);

      assert.throws(() => {
        autosaveAnswer({
          attemptId: attempt.id,
          userId: student.id,
          questionId: sec2Q.id,
          savedAnswer: 'opt_1',
          isFlagged: false
        });
      }, /is currently locked/i);

      // Verify timer was NOT unpaused
      const checkAttempt = db.get('SELECT class_id, is_paused, paused_remaining_seconds FROM student_attempts WHERE id = ?', [attempt.id]);
      assert.equal(checkAttempt.is_paused, 1, 'timer must NOT be resumed when autosave fails on locked section');
      assert.equal(checkAttempt.paused_remaining_seconds, 1800);

      // Reset is_paused back to 0 for subsequent steps
      db.run('UPDATE student_attempts SET is_paused = 0, paused_remaining_seconds = NULL WHERE id = ?', [attempt.id]);
    }
  });

  await t.test('3c. Starting attempt without explicit classId auto-resolves class and locks future sections', () => {
    const autoStudentId = 'auto-student-' + Date.now();
    db.run("INSERT INTO users (id, email, username, first_name, surname, password_hash, role, account_status) VALUES (?, ?, ?, 'Auto', 'User', 'hash', 'student', 'active')", [
      autoStudentId, `auto.${Date.now()}@eduqe.test`, `autouser_${Date.now()}`
    ]);
    db.run("INSERT INTO class_enrollments (id, class_id, user_id, status) VALUES (?, ?, ?, 'active')", [
      'enroll-auto-' + Date.now(), testClass.id, autoStudentId
    ]);

    const autoClassAttempt = startAttempt({
      userId: autoStudentId,
      assessmentId: assessment.id,
      classId: null, // Omit classId to test auto-resolution
      forceNew: true
    });

    assert.equal(autoClassAttempt.class_id, testClass.id, 'class_id should be auto-resolved from enrollment');
    assert.deepEqual(autoClassAttempt.unlocked_sections, ['Section 1']);

    const sec2Q = autoClassAttempt.questions.find(q => (q.section_name || '') === 'Section 2');
    if (sec2Q) {
      assert.equal(sec2Q.is_locked, true, 'Section 2 must be locked in auto-resolved attempt');
      assert.throws(() => {
        autosaveAnswer({
          attemptId: autoClassAttempt.id,
          userId: autoStudentId,
          questionId: sec2Q.id,
          savedAnswer: 'opt_1',
          isFlagged: false
        });
      }, /is currently locked/i);
    }
  });

  await t.test('4. Submitting Section 1 grades the section and seals answers for instructor discussion', () => {
    const result = submitSection({
      attemptId: attempt.id,
      userId: student.id,
      sectionName: 'Section 1'
    });

    assert.ok(result.completed_sections.includes('Section 1'));
    assert.equal(result.status, 'in_progress');

    // Verify attempt timer is paused after completing Section 1
    const stateAfterSec1 = getAttemptState(attempt.id, student.id);
    assert.equal(stateAfterSec1.is_paused, true, 'Attempt timer must pause upon section submission');
    assert.ok(stateAfterSec1.paused_remaining_seconds > 0, 'Remaining time must be frozen');

    // Section 1 questions must now have revealed explanations & correct answers
    const sec1Q = result.questions.find(q => (q.section_name || 'Section 1') === 'Section 1');
    assert.equal(sec1Q.is_completed_section, true);
    assert.notEqual(sec1Q.correct_answer, undefined);

    // Section 1 answers must now be sealed from modification
    assert.throws(() => {
      autosaveAnswer({
        attemptId: attempt.id,
        userId: student.id,
        questionId: sec1Q.id,
        savedAnswer: 'tampered_answer',
        isFlagged: false
      });
    }, /has already been submitted and cannot be modified/i);
  });

  await t.test('4b. Submitting Section 1 keeps attempt in_progress and retrievable via getActiveAttemptForUser with saved answers', () => {
    const active = getActiveAttemptForUser(student.id, assessment.id);
    assert.ok(active, 'Must find active in_progress attempt after Section 1 submission');
    assert.equal(active.id, attempt.id);
    assert.equal(active.status, 'in_progress');

    const resumedState = getAttemptState(attempt.id, student.id);
    assert.equal(resumedState.status, 'in_progress');
    const sec1Q = resumedState.questions.find(q => (q.section_name || 'Section 1') === 'Section 1');
    assert.ok(sec1Q.saved_answer, 'Saved answer for Section 1 question must be preserved upon resume/refresh');
    assert.equal(sec1Q.is_completed_section, true);
  });

  await t.test('5. Instructor dashboard shows Section 1 completion and scores in real time', () => {
    const progress = getInstructorClassProgress(instructor.id, testClass.id);
    assert.ok(progress);
    assert.ok(progress.sections_analysis.length > 0);

    const sec1Stats = progress.sections_analysis.find(s => s.name === 'Section 1');
    assert.ok(sec1Stats);
    assert.equal(sec1Stats.completed_students_count, 1);
    assert.equal(sec1Stats.is_unlocked, true);

    const sec2Stats = progress.sections_analysis.find(s => s.name === 'Section 2');
    if (sec2Stats) {
      assert.equal(sec2Stats.is_unlocked, false, 'Section 2 must be locked in instructor dashboard');
    }
  });

  await t.test('6. Instructor unlocks Section 2 for cohort, allowing student to answer Section 2', () => {
    const updatedUnlocked = setUnlockedSectionsForClass(testClass.id, ['Section 1', 'Section 2'], instructor.id, instructor.username);
    assert.deepEqual(updatedUnlocked, ['Section 1', 'Section 2']);

    const state = getAttemptState(attempt.id, student.id);
    assert.ok(state.unlocked_sections.includes('Section 2'));

    const sec2Q = state.questions.find(q => q.section_name === 'Section 2');
    if (sec2Q) {
      assert.equal(sec2Q.is_locked, false, 'Section 2 question should now be unlocked');

      // Student can now save answers for Section 2
      const saveRes = autosaveAnswer({
        attemptId: attempt.id,
        userId: student.id,
        questionId: sec2Q.id,
        savedAnswer: 'valid_answer',
        isFlagged: false
      });
      assert.ok(saveRes.success);

      // Verify timer resumed when student starts Section 2
      const stateAfterSec2Start = getAttemptState(attempt.id, student.id);
      assert.equal(stateAfterSec2Start.is_paused, false, 'Attempt timer must resume when starting new section');
    }
  });

  await t.test('7. Submitting all sections finalizes attempt and calculates final pass/fail mark', () => {
    // Unlock remaining sections
    const allSecNames = [...new Set(attempt.questions.map(q => q.section_name || 'Section 1'))];
    setUnlockedSectionsForClass(testClass.id, allSecNames, instructor.id, instructor.username);

    // Submit remaining sections
    for (const sec of allSecNames) {
      if (sec !== 'Section 1') {
        submitSection({
          attemptId: attempt.id,
          userId: student.id,
          sectionName: sec
        });
      }
    }

    const finalState = getAttemptState(attempt.id, student.id);
    assert.notEqual(finalState.status, 'in_progress', 'Attempt should be marked/completed once all sections submitted');
    assert.ok(typeof finalState.score === 'number');
    assert.ok(typeof finalState.percentage === 'number');
    assert.ok(typeof finalState.is_passed === 'boolean');
  });

  await t.test('8. Serverless resilience: submitSection and getAttemptState work with LEFT JOIN even if assessment metadata is detached', () => {
    // Create an in-progress attempt to test detached assessment resilience
    const detachedAttempt = startAttempt({
      userId: student.id,
      assessmentId: assessment.id,
      classId: testClass.id,
      forceNew: true
    });

    // Disable foreign keys temporarily to isolate assessments row detachment without cascade deleting student_attempts
    try { db.run('PRAGMA foreign_keys = OFF;'); } catch (_) {}
    const savedAssessment = db.get('SELECT * FROM assessments WHERE id = ?', [assessment.id]);
    db.run('DELETE FROM assessments WHERE id = ?', [assessment.id]);

    try {
      // getAttemptState must NOT return null or throw 'Attempt not found'
      const state = getAttemptState(detachedAttempt.id, student.id);
      assert.ok(state, 'getAttemptState must resolve using student_attempts fallback when assessment row is detached');
      assert.equal(state.id, detachedAttempt.id);

      // submitSection must also succeed without throwing 'Attempt not found'
      const submitRes = submitSection({
        attemptId: detachedAttempt.id,
        userId: student.id,
        sectionName: 'Section 1'
      });
      assert.ok(submitRes, 'submitSection must resolve successfully using fallback');
      assert.ok(submitRes.completed_sections.includes('Section 1'));
    } finally {
      // Restore assessment record and re-enable foreign keys
      if (savedAssessment) {
        const cols = Object.keys(savedAssessment);
        const placeholders = cols.map(() => '?').join(', ');
        const vals = cols.map(c => savedAssessment[c]);
        db.run(`INSERT OR REPLACE INTO assessments (${cols.join(', ')}) VALUES (${placeholders})`, vals);
      }
      try { db.run('PRAGMA foreign_keys = ON;'); } catch (_) {}
    }
  });

  await t.test('9. Targeted hydration functions: ensureAttemptFullyHydrated and upsertLocalRows handle local data correctly', async () => {
    const supabaseService = require('../src/services/supabaseService');
    assert.equal(typeof supabaseService.ensureAttemptFullyHydrated, 'function');
    assert.equal(typeof supabaseService.ensureActiveAttemptForUserHydrated, 'function');
    assert.equal(typeof supabaseService.upsertLocalRows, 'function');

    // upsertLocalRows correctly upserts rows into SQLite
    const count = supabaseService.upsertLocalRows('student_attempts', [
      {
        id: 'test-upsert-attempt',
        user_id: student.id,
        assessment_id: assessment.id,
        class_id: testClass.id,
        attempt_number: 99,
        deadline_at: new Date().toISOString(),
        status: 'in_progress'
      }
    ]);
    assert.equal(count, 1);
    const fetched = db.get("SELECT id FROM student_attempts WHERE id = 'test-upsert-attempt'");
    assert.ok(fetched);
    db.run("DELETE FROM student_attempts WHERE id = 'test-upsert-attempt'");
  });

  // Cleanup test database
  t.after(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch (_) {}
    }
  });
});
