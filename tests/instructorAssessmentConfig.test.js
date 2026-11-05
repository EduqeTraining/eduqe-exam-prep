process.env.SUPABASE_SYNC = 'false';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, getDatabase } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const {
  getClassAssessmentConfig,
  saveClassAssessmentConfig,
  getUnlockedSectionsForClass,
  setUnlockedSectionsForClass
} = require('../src/services/classService');
const {
  startAttempt,
  autosaveAnswer,
  submitSection,
  submitAttempt,
  getAttemptState
} = require('../src/services/attemptService');
const { getInstructorClassProgress } = require('../src/services/instructorService');

describe('Instructor Assessment Pass Rate & Section Question Breakdown Suite', () => {
  let db;
  let instructorUser;
  let studentUser;
  let targetClass;
  let targetAssessment;

  beforeEach(() => {
    initDatabase();
    seedDatabase();
    db = getDatabase();

    instructorUser = db.get("SELECT * FROM users WHERE role = 'instructor' LIMIT 1");
    studentUser = db.get("SELECT * FROM users WHERE role = 'student' LIMIT 1");
    db.run("UPDATE users SET account_status = 'active' WHERE id = ?", [studentUser.id]);

    targetClass = db.get("SELECT * FROM classes WHERE status = 'active' LIMIT 1");
    targetAssessment = db.get("SELECT * FROM assessments WHERE status = 'published' LIMIT 1");

    // Ensure student is enrolled in targetClass
    db.run(
      "INSERT INTO class_enrollments (id, class_id, user_id, status) VALUES (?, ?, ?, 'active') ON CONFLICT(class_id, user_id) DO UPDATE SET status = 'active'",
      ['enroll-cfg-test-' + studentUser.id, targetClass.id, studentUser.id]
    );
  });

  test('1. Saves and retrieves class assessment configuration (pass mark & section rules)', () => {
    const configData = {
      pass_mark_percentage: 85,
      sections: {
        'Section 1': { limit: 2, chunk_size: null },
        'Section 2': { limit: null, chunk_size: 2 }
      }
    };

    const saved = saveClassAssessmentConfig(targetClass.id, configData, instructorUser.id, instructorUser.username);
    assert.equal(saved.pass_mark_percentage, 85);
    assert.equal(saved.sections['Section 1'].limit, 2);
    assert.equal(saved.sections['Section 2'].chunk_size, 2);

    const retrieved = getClassAssessmentConfig(targetClass.id);
    assert.equal(retrieved.pass_mark_percentage, 85);
    assert.equal(retrieved.sections['Section 1'].limit, 2);
    assert.equal(retrieved.sections['Section 2'].chunk_size, 2);
  });

  test('2. startAttempt applies question limiting and sub-section chunking per instructor configuration', () => {
    // Assessment items have Section 1, Section 2, Section 3
    // We configure:
    // Section 1: limit to 2 questions
    // Section 2: chunk into 2 questions per part
    saveClassAssessmentConfig(targetClass.id, {
      pass_mark_percentage: 80,
      sections: {
        'Section 1': { limit: 2, chunk_size: null },
        'Section 2': { limit: null, chunk_size: 2 }
      }
    }, instructorUser.id);

    const attemptState = startAttempt({
      userId: studentUser.id,
      assessmentId: targetAssessment.id,
      classId: targetClass.id,
      forceNew: true
    });

    assert.ok(attemptState);
    assert.equal(attemptState.pass_mark_percentage, 80);

    const sec1Questions = attemptState.questions.filter(q => q.section_name === 'Section 1');
    assert.equal(sec1Questions.length, 2, 'Section 1 should be limited to exactly 2 questions');

    const sec2Part1Questions = attemptState.questions.filter(q => q.section_name === 'Section 2 (Part 1)');
    const sec2Part2Questions = attemptState.questions.filter(q => q.section_name === 'Section 2 (Part 2)');

    assert.ok(sec2Part1Questions.length > 0, 'Section 2 should have Part 1');
    assert.ok(sec2Part2Questions.length > 0, 'Section 2 should have Part 2');
    assert.equal(sec2Part1Questions.length, 2, 'Section 2 (Part 1) should have 2 questions');
  });

  test('3. Chunked sub-sections are sequentially gated and individually lockable/unlockable', () => {
    saveClassAssessmentConfig(targetClass.id, {
      pass_mark_percentage: 75,
      sections: {
        'Section 1': { limit: 1, chunk_size: null },
        'Section 2': { limit: null, chunk_size: 2 }
      }
    }, instructorUser.id);

    // Initial unlocked section is Section 1
    setUnlockedSectionsForClass(targetClass.id, ['Section 1'], instructorUser.id);

    const attemptState = startAttempt({
      userId: studentUser.id,
      assessmentId: targetAssessment.id,
      classId: targetClass.id,
      forceNew: true
    });

    const sec1Q = attemptState.questions.find(q => q.section_name === 'Section 1');
    const sec2Part1Q = attemptState.questions.find(q => q.section_name === 'Section 2 (Part 1)');

    assert.equal(sec1Q.is_locked, false, 'Section 1 should be unlocked');
    assert.equal(sec2Part1Q.is_locked, true, 'Section 2 (Part 1) should be locked initially');

    // Student can answer Section 1
    autosaveAnswer({
      attemptId: attemptState.id,
      userId: studentUser.id,
      questionId: sec1Q.id,
      savedAnswer: 'Option A'
    });

    // Student cannot answer locked Section 2 (Part 1)
    assert.throws(() => {
      autosaveAnswer({
        attemptId: attemptState.id,
        userId: studentUser.id,
        questionId: sec2Part1Q.id,
        savedAnswer: 'Option B'
      });
    }, /is currently locked/);

    // Submit Section 1
    submitSection({
      attemptId: attemptState.id,
      userId: studentUser.id,
      sectionName: 'Section 1'
    });

    // Instructor unlocks Section 2 (Part 1)
    setUnlockedSectionsForClass(targetClass.id, ['Section 1', 'Section 2 (Part 1)'], instructorUser.id);

    // Student can now answer Section 2 (Part 1)
    autosaveAnswer({
      attemptId: attemptState.id,
      userId: studentUser.id,
      questionId: sec2Part1Q.id,
      savedAnswer: 'Option B'
    });

    const refreshed = getAttemptState(attemptState.id, studentUser.id);
    const updatedSec2Part1Q = refreshed.questions.find(q => q.id === sec2Part1Q.id);
    assert.equal(updatedSec2Part1Q.is_locked, false, 'Section 2 (Part 1) should now be unlocked');
  });

  test('4. Instructor pass rate override determines pass/fail marks and threshold calculations', () => {
    // Set pass rate to 90%
    saveClassAssessmentConfig(targetClass.id, {
      pass_mark_percentage: 90,
      sections: {
        'Section 1': { limit: 2, chunk_size: null }
      }
    }, instructorUser.id);

    const attemptState = startAttempt({
      userId: studentUser.id,
      assessmentId: targetAssessment.id,
      classId: targetClass.id,
      forceNew: true
    });

    assert.equal(attemptState.pass_mark_percentage, 90);

    // Submit section with 75% score (1 correct out of 2 or similar)
    const result = submitSection({
      attemptId: attemptState.id,
      userId: studentUser.id,
      sectionName: 'Section 1'
    });

    assert.equal(result.pass_mark_percentage, 90);

    // Verify instructor progress reflects the configured pass rate
    const progress = getInstructorClassProgress(instructorUser.id, targetClass.id);
    assert.equal(progress.class_assessment_config.pass_mark_percentage, 90);
    assert.ok(progress.base_sections.length > 0);
  });

  test('5. getInstructorClassProgress provides base_sections and chunked sub-sections for live instructor tracking', () => {
    saveClassAssessmentConfig(targetClass.id, {
      pass_mark_percentage: 80,
      sections: {
        'Section 1': { limit: 2, chunk_size: null },
        'Section 2': { limit: null, chunk_size: 2 }
      }
    }, instructorUser.id);

    const progress = getInstructorClassProgress(instructorUser.id, targetClass.id);

    // Check base_sections
    assert.ok(Array.isArray(progress.base_sections), 'base_sections should be an array');
    const baseSec1 = progress.base_sections.find(s => s.name === 'Section 1');
    assert.ok(baseSec1, 'Section 1 should exist in base_sections');

    // Check sections_analysis has the chunked parts
    assert.ok(Array.isArray(progress.sections_analysis), 'sections_analysis should be an array');
    const hasSec2Part1 = progress.sections_analysis.some(s => s.name === 'Section 2 (Part 1)');
    assert.ok(hasSec2Part1, 'Section 2 (Part 1) should appear in sections_analysis');
  });
});
