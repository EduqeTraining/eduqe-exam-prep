const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { initDatabase, setDatabaseInstance } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');
const questionService = require('../src/services/questionService');
const poolService = require('../src/services/poolService');
const courseService = require('../src/services/courseService');

describe('Question Bank, 10-Step Workflow & Question Pools Tests', () => {
  beforeEach(() => {
    const db = initDatabase(':memory:');
    setDatabaseInstance(db);
    seedDatabase(':memory:');
  });

  test('Create questions directly inside the Question Bank without creating an assessment first', () => {
    const q = questionService.createQuestion({
      question_type: 'yes_no',
      question_text: 'Is Azure Resource Graph based on Kusto Query Language (KQL)?',
      question_description: 'An administrator needs to query resources across hundreds of Azure subscriptions with low latency.',
      answer_options: ['Yes', 'No'],
      correct_answer: 'Yes',
      answer_explanation: 'Yes, Azure Resource Graph uses KQL for rapid and complex resource querying.',
      points: 1,
      status: 'published'
    });

    assert.ok(q.id);
    assert.strictEqual(q.question_text, 'Is Azure Resource Graph based on Kusto Query Language (KQL)?');
    assert.ok(q.question_description.includes('subscriptions with low latency'));
    assert.strictEqual(q.status, 'published');

    // Appears in Question Bank list
    const allQuestions = questionService.listQuestions();
    assert.ok(allQuestions.some(item => item.id === q.id));
  });

  test('Question and Question Description remain separate independently editable fields', () => {
    const q = questionService.createQuestion({
      question_type: 'single_choice',
      question_text: 'What is the maximum SLA for Azure AD (Entra ID) Premium P2?',
      question_description: 'Table of SLAs:\n- Free: No SLA\n- Premium: 99.99%',
      answer_options: [{ id: '1', text: '99.9%' }, { id: '2', text: '99.99%' }],
      correct_answer: '2',
      answer_explanation: 'Entra ID SLA provides 99.99% uptime guarantee for paid editions.'
    });

    assert.strictEqual(q.question_text, 'What is the maximum SLA for Azure AD (Entra ID) Premium P2?');
    assert.ok(q.question_description.startsWith('Table of SLAs'));

    // Update only question description without changing question text
    const updated = questionService.updateQuestion(q.id, {
      question_description: 'Updated SLA details: 99.99% multi-region'
    });

    assert.strictEqual(updated.question_text, 'What is the maximum SLA for Azure AD (Entra ID) Premium P2?');
    assert.strictEqual(updated.question_description, 'Updated SLA details: 99.99% multi-region');
  });

  test('Validation: Question cannot be published without a valid answer key unless manual review is enabled', () => {
    assert.throws(
      () => questionService.createQuestion({
        question_type: 'single_choice',
        question_text: 'Question without an answer key',
        answer_options: [{ id: 'a', text: 'Option A' }, { id: 'b', text: 'Option B' }],
        correct_answer: null,
        requires_manual_review: false
      }),
      /A valid answer key is required/
    );

    // Permitted if manual review is enabled
    const manualQ = questionService.createQuestion({
      question_type: 'fill_blank',
      question_text: 'Explain how you would troubleshoot an ExpressRoute BGP peering failure.',
      answer_options: [],
      correct_answer: '',
      requires_manual_review: true,
      status: 'draft'
    });

    assert.ok(manualQ.id);
    assert.strictEqual(manualQ.requires_manual_review, true);
  });

  test('Validation: Multiple response required selection count conflicts throw error', () => {
    assert.throws(
      () => questionService.createQuestion({
        question_type: 'multiple_response',
        question_text: 'Select THREE options.',
        answer_options: [{ id: '1', text: 'A' }, { id: '2', text: 'B' }, { id: '3', text: 'C' }],
        correct_answer: ['1', '2'], // Only 2 provided, but instruction says 3!
        required_selection_count: 3
      }),
      /Required selection count/
    );
  });

  test('Duplicate question creates an independent Draft copy', () => {
    const questions = questionService.listQuestions();
    const source = questions[0];

    const duplicate = questionService.duplicateQuestion(source.id);
    assert.notStrictEqual(duplicate.id, source.id, 'Duplicate must receive new ID');
    assert.strictEqual(duplicate.status, 'draft', 'Duplicate must start in Draft status');
    assert.ok(duplicate.question_text.includes('(Copy)'));
    assert.strictEqual(duplicate.question_type, source.question_type);

    // Editing duplicate must not affect original
    questionService.updateQuestion(duplicate.id, {
      question_text: 'Totally modified question text'
    });

    const originalCheck = questionService.getQuestion(source.id);
    assert.strictEqual(originalCheck.question_text, source.question_text, 'Original must remain unchanged');
  });

  test('Question Pools: Create pool, add items, and select random questions', () => {
    const courses = courseService.listCourses();
    const az104 = courses.find(c => c.code === 'AZ104');

    const pool = poolService.createPool({
      courseId: az104.id,
      name: 'Storage Practice Pool',
      randomCount: 2
    });

    // Seed questions
    const qA = questionService.createQuestion({
      question_type: 'yes_no',
      question_text: 'Is blob versioning enabled by default?',
      answer_options: ['Yes', 'No'],
      correct_answer: 'No'
    });
    const qB = questionService.createQuestion({
      question_type: 'yes_no',
      question_text: 'Does immutable storage support legal holds?',
      answer_options: ['Yes', 'No'],
      correct_answer: 'Yes'
    });
    const qC = questionService.createQuestion({
      question_type: 'yes_no',
      question_text: 'Can storage lifecycle policies delete append blobs?',
      answer_options: ['Yes', 'No'],
      correct_answer: 'Yes'
    });

    poolService.addQuestionToPool(pool.id, qA.id);
    poolService.addQuestionToPool(pool.id, qB.id);
    poolService.addQuestionToPool(pool.id, qC.id);

    const randomSelection = poolService.selectRandomQuestionsFromPool(pool.id, 2);
    assert.strictEqual(randomSelection.length, 2, 'Should select configured number of questions');
  });

  test('Import questions template creates questions in Draft status', () => {
    const importData = [
      {
        question_type: 'single_choice',
        question: 'What is Azure Front Door?',
        options: [{ id: '1', text: 'Global Web Load Balancer' }, { id: '2', text: 'Regional Load Balancer' }],
        correct: '1',
        explanation: 'Azure Front Door is a global Layer 7 load balancer and CDN.'
      }
    ];

    const res = questionService.importQuestions(importData);
    assert.strictEqual(res.imported.length, 1);

    const importedQ = questionService.getQuestion(res.imported[0].id);
    assert.strictEqual(importedQ.status, 'draft', 'Imported questions must start as Draft');
  });

  test('Bulk delete multiple questions permanently removes records and cleans up references', () => {
    const q1 = questionService.createQuestion({
      question_type: 'yes_no',
      question_text: 'Bulk test question 1',
      answer_options: ['Yes', 'No'],
      correct_answer: 'Yes'
    });
    const q2 = questionService.createQuestion({
      question_type: 'yes_no',
      question_text: 'Bulk test question 2',
      answer_options: ['Yes', 'No'],
      correct_answer: 'No'
    });
    const q3 = questionService.createQuestion({
      question_type: 'yes_no',
      question_text: 'Bulk test question 3',
      answer_options: ['Yes', 'No'],
      correct_answer: 'Yes'
    });

    assert.ok(questionService.getQuestion(q1.id));
    assert.ok(questionService.getQuestion(q2.id));
    assert.ok(questionService.getQuestion(q3.id));

    // Bulk delete q1 and q2
    const res = questionService.deleteQuestions([q1.id, q2.id], null, 'admin');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.count, 2);

    // Verify q1 and q2 are gone
    assert.strictEqual(questionService.getQuestion(q1.id), null);
    assert.strictEqual(questionService.getQuestion(q2.id), null);

    // Verify q3 remains
    assert.ok(questionService.getQuestion(q3.id));
  });

  test('Delete Question Pool removes pool and pool links while preserving questions in Question Bank', () => {
    const q = questionService.createQuestion({
      question_type: 'yes_no',
      question_text: 'Question inside pool to be deleted',
      answer_options: ['Yes', 'No'],
      correct_answer: 'Yes'
    });

    const pool = poolService.createPool({
      name: 'Temporary Practice Pool',
      randomCount: 3
    });
    poolService.addQuestionToPool(pool.id, q.id);
    assert.ok(poolService.getPool(pool.id));

    const delRes = poolService.deletePool(pool.id, null, 'admin');
    assert.strictEqual(delRes.success, true);
    assert.strictEqual(poolService.getPool(pool.id), null);

    // Ensure the underlying question in the Question Bank is still intact
    assert.ok(questionService.getQuestion(q.id));
  });

  test('Hotspot Question creation and validation', () => {
    // 1. Validation fails if no statements
    assert.throws(() => {
      questionService.createQuestion({
        question_type: 'hotspot',
        question_text: 'Hotspot with empty statements',
        answer_options: [],
        correct_answer: {}
      });
    }, /Hotspot questions require at least one statement/);

    // 2. Successful creation
    const hotspotQ = questionService.createQuestion({
      question_type: 'hotspot',
      question_text: 'For each of the following statements, select Yes if the statement is true. Otherwise, select No.',
      question_description: 'NOTE: Each correct selection is worth one point.\nHot Area:\nAnswer Area',
      points: 3,
      partial_credit: true,
      answer_options: [
        { id: 'stmt_1', statement: 'To achieve a hybrid cloud model, a company must always migrate from a private cloud model.' },
        { id: 'stmt_2', statement: 'A company can extend the capacity of its internal network by using the public cloud.' },
        { id: 'stmt_3', statement: 'In a public cloud model, only guest users at your company can access the resources in the cloud.' }
      ],
      correct_answer: {
        stmt_1: 'No',
        stmt_2: 'Yes',
        stmt_3: 'No'
      },
      answer_explanation: 'A company can adopt hybrid cloud without starting from private cloud. Public cloud can extend internal networks. Public cloud is not restricted to guest users.',
      status: 'published'
    });

    assert.ok(hotspotQ.id);
    assert.strictEqual(hotspotQ.question_type, 'hotspot');
    assert.strictEqual(hotspotQ.points, 3);
    assert.strictEqual(hotspotQ.partial_credit, true);
    assert.strictEqual(hotspotQ.answer_options.length, 3);
    assert.strictEqual(hotspotQ.correct_answer.stmt_1, 'No');
    assert.strictEqual(hotspotQ.correct_answer.stmt_2, 'Yes');
    assert.strictEqual(hotspotQ.correct_answer.stmt_3, 'No');
  });

  test('Microsoft DRAG DROP matching creation and validation', () => {
    // 1. Validation fails if no sources or targets
    assert.throws(() => {
      questionService.createQuestion({
        question_type: 'matching',
        question_text: 'Empty matching question',
        answer_options: { sources: [], targets: [] },
        correct_answer: {}
      });
    }, /Matching questions require draggable source items and target slots/);

    // 2. Successful creation with 2-column DRAG DROP structure
    const dragDropQ = questionService.createQuestion({
      question_type: 'matching',
      question_text: 'Match the Azure storage services to the appropriate descriptions.',
      question_description: 'To answer, drag the appropriate storage service from the column on the left to its description on the right. Each service may be used once, more than once, or not at all.\nNOTE: Each correct match is worth one point.',
      points: 3,
      partial_credit: true,
      answer_options: {
        source_title: 'Storage service',
        target_title: 'Answer Area',
        sources: [
          { id: 'src_blob', text: 'Azure Blob storage' },
          { id: 'src_disk', text: 'Azure Disk storage' },
          { id: 'src_files', text: 'Azure Files' },
          { id: 'src_queue', text: 'Azure Queue Storage' }
        ],
        targets: [
          { id: 'tgt_msg', text: 'Used for reliable messaging between applications' },
          { id: 'tgt_share', text: 'Can be accessed as a network share from a Windows device' },
          { id: 'tgt_archive', text: 'Can be configured to use the Archive access tier' }
        ]
      },
      correct_answer: {
        tgt_msg: 'src_queue',
        tgt_share: 'src_files',
        tgt_archive: 'src_blob'
      },
      answer_explanation: 'Queue Storage provides reliable messaging. Files provides network shares. Blob storage supports Archive access tier. Disk storage is a distractor.',
      status: 'published'
    });

    assert.ok(dragDropQ.id);
    assert.strictEqual(dragDropQ.question_type, 'matching');
    assert.strictEqual(dragDropQ.points, 3);
    assert.strictEqual(dragDropQ.answer_options.sources.length, 4);
    assert.strictEqual(dragDropQ.answer_options.targets.length, 3);
    assert.strictEqual(dragDropQ.answer_options.source_title, 'Storage service');
    assert.strictEqual(dragDropQ.answer_options.target_title, 'Answer Area');
    assert.strictEqual(dragDropQ.correct_answer.tgt_msg, 'src_queue');
  });
});
