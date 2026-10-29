const { getDatabase } = require('../db');
const { logAction } = require('./auditService');

function getDashboardMetrics() {
  const db = getDatabase();

  const totalCourses = db.get("SELECT COUNT(*) as count FROM courses")?.count || 0;
  const activeCourses = db.get("SELECT COUNT(*) as count FROM courses WHERE status = 'published'")?.count || 0;
  const draftCourses = db.get("SELECT COUNT(*) as count FROM courses WHERE status = 'draft'")?.count || 0;

  const totalClasses = db.get("SELECT COUNT(*) as count FROM classes")?.count || 0;
  const totalStudents = db.get("SELECT COUNT(*) as count FROM users WHERE role = 'student'")?.count || 0;
  const activeStudents = db.get("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND account_status = 'active'")?.count || 0;

  const publishedAssessments = db.get("SELECT COUNT(*) as count FROM assessments WHERE status = 'published'")?.count || 0;
  const draftAssessments = db.get("SELECT COUNT(*) as count FROM assessments WHERE status = 'draft'")?.count || 0;

  const currentSessions = db.get("SELECT COUNT(*) as count FROM student_attempts WHERE status = 'in_progress'")?.count || 0;
  const needingReview = db.get("SELECT COUNT(*) as count FROM student_attempts WHERE status = 'awaiting_review'")?.count || 0;

  // Recent attempts
  const recentAttempts = db.all(
    `SELECT sa.id, sa.attempt_number, sa.started_at, sa.submitted_at, sa.status, sa.score, sa.max_score, sa.percentage, sa.is_passed,
            u.username, u.first_name, u.surname,
            a.name as assessment_name, c.name as course_name, cl.name as class_name
     FROM student_attempts sa
     JOIN users u ON u.id = sa.user_id
     JOIN assessments a ON a.id = sa.assessment_id
     JOIN courses c ON c.id = a.course_id
     JOIN classes cl ON cl.id = sa.class_id
     ORDER BY sa.started_at DESC
     LIMIT 10`
  );

  // Expiring access soon (within 7 days)
  const expiringSoon = db.all(
    `SELECT ce.id, ce.access_expires_at,
            u.id as user_id, u.username, u.first_name, u.surname, u.email,
            cl.name as class_name, c.name as course_name
     FROM class_enrollments ce
     JOIN users u ON u.id = ce.user_id
     JOIN classes cl ON cl.id = ce.class_id
     JOIN courses c ON c.id = cl.course_id
     WHERE ce.status = 'active' 
       AND ce.access_expires_at IS NOT NULL
       AND datetime(ce.access_expires_at) >= datetime('now')
       AND datetime(ce.access_expires_at) <= datetime('now', '+7 days')
     ORDER BY ce.access_expires_at ASC
     LIMIT 10`
  );

  // Students who have not started assigned assessments
  const notStarted = db.all(
    `SELECT u.id as user_id, u.username, u.first_name, u.surname, u.email,
            a.id as assessment_id, a.name as assessment_name,
            c.name as course_name, cl.name as class_name
     FROM class_enrollments ce
     JOIN users u ON u.id = ce.user_id
     JOIN classes cl ON cl.id = ce.class_id
     JOIN courses c ON c.id = cl.course_id
     JOIN assessment_classes ac ON ac.class_id = cl.id
     JOIN assessments a ON a.id = ac.assessment_id
     WHERE a.status = 'published' AND ce.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM student_attempts sa
         WHERE sa.user_id = u.id AND sa.assessment_id = a.id
       )
     ORDER BY u.surname, u.first_name
     LIMIT 15`
  );

  return {
    summary: {
      totalCourses,
      activeCourses,
      draftCourses,
      totalClasses,
      totalStudents,
      activeStudents,
      publishedAssessments,
      draftAssessments,
      currentSessions,
      needingReview
    },
    recentAttempts,
    expiringSoon,
    notStarted
  };
}

function getAssessmentReport(assessmentId = null) {
  const db = getDatabase();
  let sql = `
    SELECT a.id, a.name, a.pass_mark_percentage, a.status,
           c.name as course_name,
           COUNT(sa.id) as total_attempts,
           SUM(CASE WHEN sa.status IN ('marked', 'submitted') THEN 1 ELSE 0 END) as completed_attempts,
           SUM(CASE WHEN sa.is_passed = 1 THEN 1 ELSE 0 END) as passed_attempts,
           ROUND(AVG(CASE WHEN sa.status IN ('marked', 'submitted') THEN sa.percentage ELSE NULL END), 2) as average_percentage,
           ROUND(AVG(CASE WHEN sa.status IN ('marked', 'submitted') THEN sa.score ELSE NULL END), 2) as average_score
    FROM assessments a
    JOIN courses c ON c.id = a.course_id
    LEFT JOIN student_attempts sa ON sa.assessment_id = a.id
    WHERE 1=1
  `;
  const params = [];
  if (assessmentId) {
    sql += ' AND a.id = ?';
    params.push(assessmentId);
  }
  sql += ' GROUP BY a.id ORDER BY a.created_at DESC';

  const rows = db.all(sql, params);

  // If single assessment, also get frequently missed questions
  if (assessmentId && rows.length > 0) {
    const missedQuestions = db.all(
      `SELECT q.id, q.question_text, q.question_type, q.topic, q.difficulty,
              COUNT(aa.id) as times_answered,
              SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as times_correct,
              SUM(CASE WHEN aa.is_correct = 0 THEN 1 ELSE 0 END) as times_incorrect
       FROM attempt_answers aa
       JOIN student_attempts sa ON sa.id = aa.attempt_id
       JOIN questions q ON q.id = aa.question_id
       WHERE sa.assessment_id = ? AND sa.status IN ('marked', 'submitted')
       GROUP BY q.id
       ORDER BY times_incorrect DESC
       LIMIT 10`,
      [assessmentId]
    );

    return {
      overview: rows[0],
      missed_questions: missedQuestions
    };
  }

  return rows;
}

function getCourseReport(courseId = null) {
  const db = getDatabase();
  let sql = `
    SELECT c.id, c.name, c.code, c.status,
           (SELECT COUNT(*) FROM classes cl WHERE cl.course_id = c.id) as class_count,
           (SELECT COUNT(DISTINCT ce.user_id) FROM class_enrollments ce JOIN classes cl ON cl.id = ce.class_id WHERE cl.course_id = c.id) as enrolled_students,
           (SELECT COUNT(*) FROM assessments a WHERE a.course_id = c.id) as assessment_count,
           (SELECT COUNT(*) FROM student_attempts sa JOIN assessments a ON a.id = sa.assessment_id WHERE a.course_id = c.id) as total_attempts,
           (SELECT ROUND(AVG(sa.percentage), 2) FROM student_attempts sa JOIN assessments a ON a.id = sa.assessment_id WHERE a.course_id = c.id AND sa.status IN ('marked', 'submitted')) as avg_percentage
    FROM courses c
    WHERE 1=1
  `;
  const params = [];
  if (courseId) {
    sql += ' AND c.id = ?';
    params.push(courseId);
  }
  sql += ' ORDER BY c.created_at DESC';
  return db.all(sql, params);
}

function getClassReport(classId = null) {
  const db = getDatabase();
  let sql = `
    SELECT cl.id, cl.name, cl.status,
           c.name as course_name,
           (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = cl.id AND ce.status = 'active') as active_students,
           (SELECT COUNT(*) FROM assessment_classes ac WHERE ac.class_id = cl.id) as assigned_assessments,
           (SELECT COUNT(*) FROM student_attempts sa WHERE sa.class_id = cl.id) as total_attempts,
           (SELECT ROUND(AVG(sa.percentage), 2) FROM student_attempts sa WHERE sa.class_id = cl.id AND sa.status IN ('marked', 'submitted')) as avg_percentage
    FROM classes cl
    JOIN courses c ON c.id = cl.course_id
    WHERE 1=1
  `;
  const params = [];
  if (classId) {
    sql += ' AND cl.id = ?';
    params.push(classId);
  }
  sql += ' ORDER BY cl.created_at DESC';
  return db.all(sql, params);
}

function getStudentReport(userId = null) {
  const db = getDatabase();
  let sql = `
    SELECT u.id, u.username, u.first_name, u.surname, u.email, u.student_number, u.account_status,
           COUNT(sa.id) as total_attempts,
           SUM(CASE WHEN sa.is_passed = 1 THEN 1 ELSE 0 END) as passed_assessments,
           ROUND(AVG(sa.percentage), 2) as average_percentage
    FROM users u
    LEFT JOIN student_attempts sa ON sa.user_id = u.id AND sa.status IN ('marked', 'submitted')
    WHERE u.role = 'student'
  `;
  const params = [];
  if (userId) {
    sql += ' AND u.id = ?';
    params.push(userId);
  }
  sql += ' GROUP BY u.id ORDER BY u.surname, u.first_name';
  return db.all(sql, params);
}

function getTopicReport() {
  const db = getDatabase();
  return db.all(
    `SELECT q.topic,
            COUNT(DISTINCT q.id) as total_questions,
            COUNT(aa.id) as total_answers,
            SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as total_correct,
            ROUND(AVG(CASE WHEN aa.is_correct = 1 THEN 100.0 ELSE 0.0 END), 1) as accuracy_rate
     FROM questions q
     LEFT JOIN attempt_answers aa ON aa.question_id = q.id
     WHERE q.topic IS NOT NULL AND q.topic != ''
     GROUP BY q.topic
     ORDER BY accuracy_rate DESC`
  );
}

function exportToCsv(data, columns, reportName = 'report', adminUserId = null, adminUsername = 'admin') {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const keys = columns || Object.keys(data[0]);
  const headerLine = keys.map(k => `"${String(k).replace(/"/g, '""')}"`).join(',');

  const rows = data.map(row => {
    return keys.map(k => {
      const val = row[k] === null || row[k] === undefined ? '' : String(row[k]);
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
  });

  logAction({
    userId: adminUserId,
    username: adminUsername,
    action: 'EXPORT_REPORT_CSV',
    entityType: 'reports',
    details: { reportName, rowCount: data.length }
  });

  return [headerLine, ...rows].join('\r\n');
}

module.exports = {
  getDashboardMetrics,
  getAssessmentReport,
  getCourseReport,
  getClassReport,
  getStudentReport,
  getTopicReport,
  exportToCsv
};
