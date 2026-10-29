const { test, describe } = require('node:test');
const assert = require('node:assert');
const { evaluateQuestion, normalizeText } = require('../src/services/scoringService');

describe('Scoring Engine Unit Tests for All Question Types', () => {

  test('Yes / No scoring', () => {
    const q = { question_type: 'yes_no', points: 2, correct_answer: 'Yes' };
    assert.strictEqual(evaluateQuestion(q, 'Yes').isCorrect, true);
    assert.strictEqual(evaluateQuestion(q, 'yes').isCorrect, true);
    assert.strictEqual(evaluateQuestion(q, 'No').isCorrect, false);
    assert.strictEqual(evaluateQuestion(q, 'No').awardedPoints, 0);
  });

  test('True / False scoring', () => {
    const q = { question_type: 'true_false', points: 1, correct_answer: 'False' };
    assert.strictEqual(evaluateQuestion(q, 'False').isCorrect, true);
    assert.strictEqual(evaluateQuestion(q, 'false').isCorrect, true);
    assert.strictEqual(evaluateQuestion(q, 'True').isCorrect, false);
  });

  test('Single Choice scoring', () => {
    const q = { question_type: 'single_choice', points: 3, correct_answer: 'opt_b' };
    assert.strictEqual(evaluateQuestion(q, 'opt_b').isCorrect, true);
    assert.strictEqual(evaluateQuestion(q, 'opt_b').awardedPoints, 3);
    assert.strictEqual(evaluateQuestion(q, 'opt_a').isCorrect, false);
    assert.strictEqual(evaluateQuestion(q, 'opt_a').awardedPoints, 0);
  });

  test('Multiple Response scoring (Full Credit without partial)', () => {
    const q = {
      question_type: 'multiple_response',
      points: 2,
      partial_credit: false,
      correct_answer: ['a', 'b']
    };
    // Perfect match
    const perfect = evaluateQuestion(q, ['a', 'b']);
    assert.strictEqual(perfect.isCorrect, true);
    assert.strictEqual(perfect.awardedPoints, 2);

    // Missing one
    const partial = evaluateQuestion(q, ['a']);
    assert.strictEqual(partial.isCorrect, false);
    assert.strictEqual(partial.awardedPoints, 0);

    // Extra wrong one
    const extra = evaluateQuestion(q, ['a', 'b', 'c']);
    assert.strictEqual(extra.isCorrect, false);
    assert.strictEqual(extra.awardedPoints, 0);
  });

  test('Multiple Response scoring with Partial Credit', () => {
    const q = {
      question_type: 'multiple_response',
      points: 4,
      partial_credit: true,
      correct_answer: ['a', 'b']
    };
    // Picked 1 correct, 0 wrong -> 50% credit = 2 points
    const res1 = evaluateQuestion(q, ['a']);
    assert.strictEqual(res1.awardedPoints, 2);

    // Picked 2 correct -> 100% credit = 4 points
    const res2 = evaluateQuestion(q, ['a', 'b']);
    assert.strictEqual(res2.awardedPoints, 4);

    // Picked 1 correct, 1 wrong -> (1 - 1)/2 = 0 points
    const res3 = evaluateQuestion(q, ['a', 'c']);
    assert.strictEqual(res3.awardedPoints, 0);
  });

  test('Matching pairs scoring', () => {
    const q = {
      question_type: 'matching',
      points: 4,
      partial_credit: true,
      correct_answer: [
        { left: 'Azure AD', right: 'Identity' },
        { left: 'Key Vault', right: 'Secrets' }
      ]
    };

    // Both right
    const resAll = evaluateQuestion(q, { 'Azure AD': 'Identity', 'Key Vault': 'Secrets' });
    assert.strictEqual(resAll.isCorrect, true);
    assert.strictEqual(resAll.awardedPoints, 4);

    // 1 right, 1 wrong -> 50% = 2 points
    const resHalf = evaluateQuestion(q, { 'Azure AD': 'Identity', 'Key Vault': 'Wrong' });
    assert.strictEqual(resHalf.awardedPoints, 2);
  });

  test('Microsoft DRAG DROP matching with source pool, distractors, and target slots', () => {
    const q = {
      question_type: 'matching',
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
      }
    };

    // Full match using IDs
    const resAll = evaluateQuestion(q, {
      tgt_msg: 'src_queue',
      tgt_share: 'src_files',
      tgt_archive: 'src_blob'
    });
    assert.strictEqual(resAll.isCorrect, true);
    assert.strictEqual(resAll.awardedPoints, 3);

    // Partial match: 2 out of 3 correct = 2 points
    const resTwo = evaluateQuestion(q, {
      tgt_msg: 'src_queue',
      tgt_share: 'src_files',
      tgt_archive: 'src_disk' // distractor used incorrectly
    });
    assert.strictEqual(resTwo.isCorrect, false);
    assert.strictEqual(resTwo.awardedPoints, 2);

    // Matching using source/target text strings (interoperability test)
    const resText = evaluateQuestion(q, {
      'Used for reliable messaging between applications': 'Azure Queue Storage',
      'Can be accessed as a network share from a Windows device': 'Azure Files',
      'Can be configured to use the Archive access tier': 'Azure Blob storage'
    });
    assert.strictEqual(resText.isCorrect, true);
    assert.strictEqual(resText.awardedPoints, 3);
  });

  test('Ordering sequence scoring', () => {
    const q = {
      question_type: 'ordering',
      points: 3,
      partial_credit: false,
      correct_answer: ['step1', 'step2', 'step3']
    };

    assert.strictEqual(evaluateQuestion(q, ['step1', 'step2', 'step3']).isCorrect, true);
    assert.strictEqual(evaluateQuestion(q, ['step2', 'step1', 'step3']).isCorrect, false);
  });

  test('Categorisation scoring', () => {
    const q = {
      question_type: 'categorisation',
      points: 2,
      partial_credit: true,
      correct_answer: {
        IaaS: ['VM'],
        PaaS: ['AppService']
      }
    };

    // Both correct
    const full = evaluateQuestion(q, { IaaS: ['VM'], PaaS: ['AppService'] });
    assert.strictEqual(full.isCorrect, true);
    assert.strictEqual(full.awardedPoints, 2);

    // 1 correct
    const half = evaluateQuestion(q, { IaaS: ['VM'], PaaS: ['Wrong'] });
    assert.strictEqual(half.awardedPoints, 1);
  });

  test('Dropdown multiple blanks scoring', () => {
    const q = {
      question_type: 'dropdown',
      points: 2,
      partial_credit: true,
      correct_answer: {
        blank1: 'LRS',
        blank2: 'GRS'
      }
    };

    const full = evaluateQuestion(q, { blank1: 'LRS', blank2: 'GRS' });
    assert.strictEqual(full.isCorrect, true);
    assert.strictEqual(full.awardedPoints, 2);

    const half = evaluateQuestion(q, { blank1: 'LRS', blank2: 'ZRS' });
    assert.strictEqual(half.awardedPoints, 1);
  });

  test('Fill in the Blank: handles casing, whitespace, punctuation, and alternate syntax', () => {
    const q = {
      question_type: 'fill_blank',
      points: 1,
      answer_options: {
        case_sensitive: false,
        ignore_spaces: true,
        ignore_punctuation: true
      },
      correct_answer: 'az group create|az group create --name rg1'
    };

    // Exact match
    assert.strictEqual(evaluateQuestion(q, 'az group create').isCorrect, true);

    // Case insensitive & extra spaces
    assert.strictEqual(evaluateQuestion(q, '  AZ   GROUP   CREATE  ').isCorrect, true);

    // Alternate accepted answer with punctuation
    assert.strictEqual(evaluateQuestion(q, 'az group create --name rg1').isCorrect, true);

    // Incorrect answer
    assert.strictEqual(evaluateQuestion(q, 'az vm create').isCorrect, false);
  });

  test('Hot Area image selection scoring', () => {
    const q = {
      question_type: 'hot_area',
      points: 1,
      correct_answer: 'area_gateway'
    };

    assert.strictEqual(evaluateQuestion(q, 'area_gateway').isCorrect, true);
    assert.strictEqual(evaluateQuestion(q, 'area_firewall').isCorrect, false);
  });

  test('Hotspot Statement Table (Yes/No Matrix) scoring with full and partial credit', () => {
    const q = {
      question_type: 'hotspot',
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
      }
    };

    // 1. All correct (3 / 3)
    const allCorrect = evaluateQuestion(q, { stmt_1: 'No', stmt_2: 'Yes', stmt_3: 'No' });
    assert.strictEqual(allCorrect.isCorrect, true);
    assert.strictEqual(allCorrect.awardedPoints, 3);

    // 2. Partial credit (2 out of 3 correct)
    const twoCorrect = evaluateQuestion(q, { stmt_1: 'No', stmt_2: 'Yes', stmt_3: 'Yes' });
    assert.strictEqual(twoCorrect.isCorrect, false);
    assert.strictEqual(twoCorrect.awardedPoints, 2);

    // 3. One out of 3 correct
    const oneCorrect = evaluateQuestion(q, { stmt_1: 'Yes', stmt_2: 'Yes', stmt_3: 'Yes' });
    assert.strictEqual(oneCorrect.isCorrect, false);
    assert.strictEqual(oneCorrect.awardedPoints, 1);

    // 4. Zero correct
    const zeroCorrect = evaluateQuestion(q, { stmt_1: 'Yes', stmt_2: 'No', stmt_3: 'Yes' });
    assert.strictEqual(zeroCorrect.isCorrect, false);
    assert.strictEqual(zeroCorrect.awardedPoints, 0);

    // 5. Without partial credit
    const qNoPartial = { ...q, partial_credit: false };
    const partialAttempt = evaluateQuestion(qNoPartial, { stmt_1: 'No', stmt_2: 'Yes', stmt_3: 'Yes' });
    assert.strictEqual(partialAttempt.isCorrect, false);
    assert.strictEqual(partialAttempt.awardedPoints, 0);

    const fullAttempt = evaluateQuestion(qNoPartial, { stmt_1: 'No', stmt_2: 'Yes', stmt_3: 'No' });
    assert.strictEqual(fullAttempt.isCorrect, true);
    assert.strictEqual(fullAttempt.awardedPoints, 3);
  });
});
