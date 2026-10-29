/**
 * Eduque Comprehensive Scoring Engine
 */

function normalizeText(text, { caseSensitive = false, ignoreSpaces = true, ignorePunctuation = true } = {}) {
  if (text === null || text === undefined) return '';
  let str = String(text);
  if (!caseSensitive) str = str.toLowerCase();
  if (ignoreSpaces) str = str.replace(/\s+/g, ' ').trim();
  if (ignorePunctuation) str = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
  return str.trim();
}

function evaluateQuestion(question, savedAnswer) {
  const qType = question.question_type;
  const maxPoints = Number(question.points || 1);
  const allowPartial = Boolean(question.partial_credit);
  const correctKey = question.correct_answer;

  if (savedAnswer === undefined || savedAnswer === null || savedAnswer === '') {
    return {
      isCorrect: false,
      awardedPoints: 0,
      maxPoints,
      status: 'auto_marked',
      feedback: 'Unanswered'
    };
  }

  // If question requires manual review
  if (question.requires_manual_review) {
    return {
      isCorrect: false,
      awardedPoints: 0,
      maxPoints,
      status: 'awaiting_review',
      feedback: 'Awaiting administrator review'
    };
  }

  switch (qType) {
    case 'yes_no':
    case 'true_false': {
      const studentVal = String(savedAnswer).trim().toLowerCase();
      const correctVal = String(correctKey).trim().toLowerCase();
      const isCorrect = studentVal === correctVal;
      return {
        isCorrect,
        awardedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
        status: 'auto_marked'
      };
    }

    case 'single_choice': {
      const studentVal = String(savedAnswer).trim();
      const correctVal = String(correctKey).trim();
      const isCorrect = studentVal === correctVal;
      return {
        isCorrect,
        awardedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
        status: 'auto_marked'
      };
    }

    case 'multiple_response': {
      const studentArr = Array.isArray(savedAnswer) ? savedAnswer.map(String) : [String(savedAnswer)];
      const correctArr = Array.isArray(correctKey) ? correctKey.map(String) : [String(correctKey)];

      if (!allowPartial) {
        // All must match, no extra, no missing
        const isMatch = studentArr.length === correctArr.length &&
          studentArr.every(id => correctArr.includes(id));
        return {
          isCorrect: isMatch,
          awardedPoints: isMatch ? maxPoints : 0,
          maxPoints,
          status: 'auto_marked'
        };
      }

      // Partial credit calculation:
      let correctPicks = 0;
      let wrongPicks = 0;
      for (const id of studentArr) {
        if (correctArr.includes(id)) {
          correctPicks++;
        } else {
          wrongPicks++;
        }
      }

      const fraction = Math.max(0, (correctPicks - wrongPicks) / (correctArr.length || 1));
      const awarded = Math.round(fraction * maxPoints * 100) / 100;
      const isCorrect = awarded === maxPoints;

      return {
        isCorrect,
        awardedPoints: awarded,
        maxPoints,
        status: 'auto_marked'
      };
    }

    case 'matching': {
      // Pairs or drag-drop mapping: savedAnswer is an object { [targetKey]: sourceVal } or array of pairs
      let studentMap = {};
      if (Array.isArray(savedAnswer)) {
        for (const item of savedAnswer) {
          if (item && typeof item === 'object') {
            const k = item.target !== undefined ? item.target : (item.left !== undefined ? item.left : item.key);
            const v = item.source !== undefined ? item.source : (item.right !== undefined ? item.right : item.value);
            if (k !== undefined) studentMap[String(k).trim()] = String(v).trim();
          }
        }
      } else if (typeof savedAnswer === 'object' && savedAnswer !== null) {
        for (const [k, v] of Object.entries(savedAnswer)) {
          if (v !== undefined && v !== null && v !== '') {
            studentMap[String(k).trim()] = String(v).trim();
          }
        }
      }

      // Build target-to-source mapping for correct pairs
      let correctPairs = [];
      if (Array.isArray(correctKey)) {
        for (const p of correctKey) {
          if (typeof p === 'object' && p !== null) {
            const k = p.target !== undefined ? p.target : (p.left !== undefined ? p.left : p.key);
            const v = p.source !== undefined ? p.source : (p.right !== undefined ? p.right : p.value);
            if (k !== undefined && v !== undefined) {
              correctPairs.push({ k: String(k).trim(), v: String(v).trim() });
            }
          }
        }
      } else if (typeof correctKey === 'object' && correctKey !== null) {
        for (const [k, v] of Object.entries(correctKey)) {
          if (v !== undefined && v !== null && v !== '') {
            correctPairs.push({ k: String(k).trim(), v: String(v).trim() });
          }
        }
      }

      // Map ID <-> Text lookups if answer_options defines sources and targets
      let idToText = {};
      let textToId = {};
      let opts = question.answer_options;
      if (typeof opts === 'string') {
        try { opts = JSON.parse(opts); } catch (_) {}
      }
      if (opts && typeof opts === 'object') {
        const sources = Array.isArray(opts.sources) ? opts.sources : [];
        const targets = Array.isArray(opts.targets) ? opts.targets : [];
        for (const s of sources) {
          if (s && s.id && s.text) {
            idToText[String(s.id).trim()] = String(s.text).trim();
            textToId[String(s.text).trim()] = String(s.id).trim();
          }
        }
        for (const t of targets) {
          if (t && t.id && t.text) {
            idToText[String(t.id).trim()] = String(t.text).trim();
            textToId[String(t.text).trim()] = String(t.id).trim();
          }
        }
      }

      const totalPairs = correctPairs.length > 0 ? correctPairs.length : 1;
      let correctMatches = 0;

      for (const pair of correctPairs) {
        const k = pair.k;
        const v = pair.v;

        // Check direct match in studentMap:
        // 1. studentMap[k] === v
        // 2. studentMap[v] === k
        // 3. studentMap[idToText[k]] === v or idToText[v]
        // 4. studentMap[textToId[k]] === v or textToId[v]
        const sVal = studentMap[k] !== undefined ? studentMap[k] : (idToText[k] ? studentMap[idToText[k]] : (textToId[k] ? studentMap[textToId[k]] : undefined));
        const rVal = studentMap[v] !== undefined ? studentMap[v] : (idToText[v] ? studentMap[idToText[v]] : (textToId[v] ? studentMap[textToId[v]] : undefined));

        const isMatch = (sVal !== undefined && (sVal === v || (idToText[v] && sVal === idToText[v]) || (textToId[v] && sVal === textToId[v]))) ||
                        (rVal !== undefined && (rVal === k || (idToText[k] && rVal === idToText[k]) || (textToId[k] && rVal === textToId[k])));

        if (isMatch) {
          correctMatches++;
        }
      }

      if (!allowPartial) {
        const isCorrect = correctMatches === totalPairs;
        return {
          isCorrect,
          awardedPoints: isCorrect ? maxPoints : 0,
          maxPoints,
          status: 'auto_marked'
        };
      }

      const awarded = Math.round((correctMatches / totalPairs) * maxPoints * 100) / 100;
      return {
        isCorrect: correctMatches === totalPairs,
        awardedPoints: awarded,
        maxPoints,
        status: 'auto_marked'
      };
    }

    case 'ordering': {
      // Sequence: savedAnswer is array of item IDs in selected order
      const studentSeq = Array.isArray(savedAnswer) ? savedAnswer.map(String) : [];
      let correctSeq = [];
      if (Array.isArray(correctKey)) {
        correctSeq = correctKey.map(item => (typeof item === 'object' && item !== null ? String(item.id || item.text) : String(item)));
      }

      if (studentSeq.length !== correctSeq.length) {
        return { isCorrect: false, awardedPoints: 0, maxPoints, status: 'auto_marked' };
      }

      let matches = 0;
      for (let i = 0; i < correctSeq.length; i++) {
        if (studentSeq[i] === correctSeq[i]) {
          matches++;
        }
      }

      if (!allowPartial) {
        const isCorrect = matches === correctSeq.length;
        return { isCorrect, awardedPoints: isCorrect ? maxPoints : 0, maxPoints, status: 'auto_marked' };
      }

      const awarded = Math.round((matches / (correctSeq.length || 1)) * maxPoints * 100) / 100;
      return {
        isCorrect: matches === correctSeq.length,
        awardedPoints: awarded,
        maxPoints,
        status: 'auto_marked'
      };
    }

    case 'categorisation': {
      // savedAnswer: { [categoryName]: [itemId1, itemId2] }
      // correctKey: { [categoryName]: [itemId1, itemId2] } or array of items with { text, category }
      const studentMap = typeof savedAnswer === 'object' && savedAnswer !== null ? savedAnswer : {};
      let totalItems = 0;
      let correctPlaced = 0;

      if (Array.isArray(correctKey)) {
        totalItems = correctKey.length;
        for (const item of correctKey) {
          const cat = item.category;
          const val = String(item.id || item.text);
          const studentCatItems = Array.isArray(studentMap[cat]) ? studentMap[cat].map(String) : [];
          if (studentCatItems.includes(val)) {
            correctPlaced++;
          }
        }
      } else if (typeof correctKey === 'object' && correctKey !== null) {
        for (const [cat, items] of Object.entries(correctKey)) {
          const itemArr = Array.isArray(items) ? items.map(String) : [String(items)];
          totalItems += itemArr.length;
          const studentCatItems = Array.isArray(studentMap[cat]) ? studentMap[cat].map(String) : [];
          for (const item of itemArr) {
            if (studentCatItems.includes(item)) correctPlaced++;
          }
        }
      }

      if (totalItems === 0) totalItems = 1;

      if (!allowPartial) {
        const isCorrect = correctPlaced === totalItems;
        return { isCorrect, awardedPoints: isCorrect ? maxPoints : 0, maxPoints, status: 'auto_marked' };
      }

      const awarded = Math.round((correctPlaced / totalItems) * maxPoints * 100) / 100;
      return {
        isCorrect: correctPlaced === totalItems,
        awardedPoints: awarded,
        maxPoints,
        status: 'auto_marked'
      };
    }

    case 'dropdown': {
      // Multiple blanks: savedAnswer: { [blankId]: selectedVal }
      const studentChoices = typeof savedAnswer === 'object' && savedAnswer !== null ? savedAnswer : {};
      const correctChoices = typeof correctKey === 'object' && correctKey !== null ? correctKey : {};
      const blanks = Object.keys(correctChoices);
      const totalBlanks = blanks.length || 1;

      let correctCount = 0;
      for (const blankId of blanks) {
        if (studentChoices[blankId] === correctChoices[blankId]) {
          correctCount++;
        }
      }

      if (!allowPartial) {
        const isCorrect = correctCount === totalBlanks;
        return { isCorrect, awardedPoints: isCorrect ? maxPoints : 0, maxPoints, status: 'auto_marked' };
      }

      const awarded = Math.round((correctCount / totalBlanks) * maxPoints * 100) / 100;
      return {
        isCorrect: correctCount === totalBlanks,
        awardedPoints: awarded,
        maxPoints,
        status: 'auto_marked'
      };
    }

    case 'fill_blank': {
      const options = typeof question.answer_options === 'object' && question.answer_options !== null ? question.answer_options : {};
      const caseSensitive = Boolean(options.case_sensitive);
      const ignoreSpaces = options.ignore_spaces !== false;
      const ignorePunctuation = options.ignore_punctuation !== false;

      const normStudent = normalizeText(savedAnswer, { caseSensitive, ignoreSpaces, ignorePunctuation });

      let acceptedList = [];
      if (Array.isArray(correctKey)) {
        acceptedList = correctKey;
      } else if (typeof correctKey === 'string') {
        acceptedList = correctKey.split('|').map(s => s.trim());
      } else {
        acceptedList = [String(correctKey)];
      }

      const isMatch = acceptedList.some(accepted => {
        const normAccepted = normalizeText(accepted, { caseSensitive, ignoreSpaces, ignorePunctuation });
        return normStudent === normAccepted;
      });

      return {
        isCorrect: isMatch,
        awardedPoints: isMatch ? maxPoints : 0,
        maxPoints,
        status: 'auto_marked'
      };
    }

    case 'hot_area': {
      // Hot area selection: student chooses region ID or clicked point
      const studentVal = String(savedAnswer).trim();
      const correctArr = Array.isArray(correctKey) ? correctKey.map(String) : [String(correctKey)];
      const isCorrect = correctArr.includes(studentVal);

      return {
        isCorrect,
        awardedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
        status: 'auto_marked'
      };
    }

    case 'hotspot': {
      // Hotspot Statement Matrix (Yes/No table):
      // savedAnswer is an object { [stmtId]: 'Yes' | 'No' } or array
      // correctKey is an object { [stmtId]: 'Yes' | 'No' } or array
      let studentMap = {};
      if (typeof savedAnswer === 'string') {
        try { studentMap = JSON.parse(savedAnswer); } catch (_) { studentMap = {}; }
      } else if (typeof savedAnswer === 'object' && savedAnswer !== null) {
        studentMap = savedAnswer;
      }

      let statements = [];
      if (Array.isArray(question.answer_options)) {
        statements = question.answer_options;
      } else if (typeof question.answer_options === 'string') {
        try { statements = JSON.parse(question.answer_options); } catch (_) { statements = []; }
      }

      let parsedCorrect = correctKey;
      if (typeof correctKey === 'string') {
        try { parsedCorrect = JSON.parse(correctKey); } catch (_) { parsedCorrect = {}; }
      }

      let totalStatements = statements.length;
      let correctMatches = 0;
      const details = {};

      if (Array.isArray(parsedCorrect)) {
        if (totalStatements === 0) totalStatements = parsedCorrect.length;
        parsedCorrect.forEach((item, idx) => {
          let sId, expected;
          if (typeof item === 'object' && item !== null) {
            sId = item.id || (statements[idx] && (statements[idx].id || statements[idx].statement || statements[idx].text)) || `stmt_${idx}`;
            expected = String(item.correct || item.answer || item.value || '').trim().toLowerCase();
          } else {
            sId = (statements[idx] && (statements[idx].id || statements[idx].statement || statements[idx].text)) || `stmt_${idx}`;
            expected = String(item).trim().toLowerCase();
          }
          const actual = String(
            studentMap[sId] !== undefined
              ? studentMap[sId]
              : (Array.isArray(studentMap) ? studentMap[idx] : '')
          ).trim().toLowerCase();
          const match = actual === expected && expected !== '';
          if (match) correctMatches++;
          details[sId] = { expected, actual, isCorrect: match };
        });
      } else if (typeof parsedCorrect === 'object' && parsedCorrect !== null) {
        if (totalStatements === 0) totalStatements = Object.keys(parsedCorrect).length;
        for (const [sId, expectedVal] of Object.entries(parsedCorrect)) {
          const expected = String(expectedVal).trim().toLowerCase();
          const actual = String(studentMap[sId] || '').trim().toLowerCase();
          const match = actual === expected && expected !== '';
          if (match) correctMatches++;
          details[sId] = { expected, actual, isCorrect: match };
        }
      }

      if (totalStatements === 0) totalStatements = 1;

      if (!allowPartial) {
        const isCorrect = correctMatches === totalStatements;
        return {
          isCorrect,
          awardedPoints: isCorrect ? maxPoints : 0,
          maxPoints,
          status: 'auto_marked',
          details
        };
      }

      const awarded = Math.round((correctMatches / totalStatements) * maxPoints * 100) / 100;
      return {
        isCorrect: correctMatches === totalStatements,
        awardedPoints: awarded,
        maxPoints,
        status: 'auto_marked',
        details
      };
    }

    case 'scenario':
    case 'case_study': {
      // Scenario / Case Study questions delegate to their underlying interaction structure
      const studentVal = String(savedAnswer).trim();
      const correctVal = String(correctKey).trim();
      const isCorrect = studentVal === correctVal;
      return {
        isCorrect,
        awardedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
        status: 'auto_marked'
      };
    }

    default: {
      const isCorrect = String(savedAnswer).trim().toLowerCase() === String(correctKey).trim().toLowerCase();
      return {
        isCorrect,
        awardedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
        status: 'auto_marked'
      };
    }
  }
}

module.exports = {
  evaluateQuestion,
  normalizeText
};
