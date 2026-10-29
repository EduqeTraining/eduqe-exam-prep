// Reporting & Exports View (Sections 28 & 29)

import { api } from '../api.js';

export function renderReportsView(container) {
  let activeTab = 'assessments';

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <div>
        <h1 style="font-size:1.75rem; font-weight:800;">Administrative Reports</h1>
        <p class="form-hint">Analyze candidate performance, assessment statistics, and frequently missed questions.</p>
      </div>
      <div>
        <button type="button" class="btn btn-secondary" id="btn-export-csv">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export Report to CSV
        </button>
      </div>
    </div>

    <!-- Report Tabs -->
    <div style="display:flex; gap:0.5rem; border-bottom:1px solid var(--border); margin-bottom:1.5rem;">
      <button type="button" class="btn btn-secondary r-tab active" data-tab="assessments" style="border-bottom-left-radius:0; border-bottom-right-radius:0;">Assessments</button>
      <button type="button" class="btn btn-secondary r-tab" data-tab="courses" style="border-bottom-left-radius:0; border-bottom-right-radius:0;">Courses</button>
      <button type="button" class="btn btn-secondary r-tab" data-tab="classes" style="border-bottom-left-radius:0; border-bottom-right-radius:0;">Classes</button>
      <button type="button" class="btn btn-secondary r-tab" data-tab="students" style="border-bottom-left-radius:0; border-bottom-right-radius:0;">Students</button>
      <button type="button" class="btn btn-secondary r-tab" data-tab="topics" style="border-bottom-left-radius:0; border-bottom-right-radius:0;">Topics & Objectives</button>
    </div>

    <div id="report-content-area"></div>
  `;

  const contentArea = container.querySelector('#report-content-area');

  async function loadReport(tab) {
    activeTab = tab;
    container.querySelectorAll('.r-tab').forEach(b => {
      if (b.dataset.tab === tab) {
        b.className = 'btn btn-primary r-tab';
      } else {
        b.className = 'btn btn-secondary r-tab';
      }
    });

    contentArea.innerHTML = `<div style="text-align:center; padding:2rem;">Loading ${tab} report...</div>`;

    if (tab === 'assessments') {
      const data = await api.get('/reports/assessments');
      contentArea.innerHTML = `
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Assessment Name</th>
                  <th>Course</th>
                  <th>Total Attempts</th>
                  <th>Completed</th>
                  <th>Passed</th>
                  <th>Pass Rate</th>
                  <th>Avg Score</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(a => {
                  const comp = a.completed_attempts || 0;
                  const passed = a.passed_attempts || 0;
                  const rate = comp > 0 ? Math.round((passed / comp) * 100) : 0;

                  return `
                    <tr>
                      <td><strong>${escapeHtml(a.name)}</strong></td>
                      <td>${escapeHtml(a.course_name)}</td>
                      <td>${a.total_attempts || 0}</td>
                      <td>${comp}</td>
                      <td><span class="badge badge-success">${passed}</span></td>
                      <td><strong>${rate}%</strong></td>
                      <td>${a.average_score !== null ? `${a.average_score} (${a.average_percentage}%)` : '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (tab === 'courses') {
      const data = await api.get('/reports/courses');
      contentArea.innerHTML = `
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Code</th>
                  <th>Classes</th>
                  <th>Enrolled Students</th>
                  <th>Assessments</th>
                  <th>Total Attempts</th>
                  <th>Avg Performance</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(c => `
                  <tr>
                    <td><strong>${escapeHtml(c.name)}</strong></td>
                    <td><span class="badge badge-primary">${escapeHtml(c.code)}</span></td>
                    <td>${c.class_count}</td>
                    <td>${c.enrolled_students}</td>
                    <td>${c.assessment_count}</td>
                    <td>${c.total_attempts}</td>
                    <td><strong>${c.avg_percentage !== null ? `${c.avg_percentage}%` : '-'}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (tab === 'classes') {
      const data = await api.get('/reports/classes');
      contentArea.innerHTML = `
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Course</th>
                  <th>Active Students</th>
                  <th>Exams</th>
                  <th>Total Attempts</th>
                  <th>Avg Performance</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(cl => `
                  <tr>
                    <td><strong>${escapeHtml(cl.name)}</strong></td>
                    <td>${escapeHtml(cl.course_name)}</td>
                    <td>${cl.active_students}</td>
                    <td>${cl.assigned_assessments}</td>
                    <td>${cl.total_attempts}</td>
                    <td><strong>${cl.avg_percentage !== null ? `${cl.avg_percentage}%` : '-'}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (tab === 'students') {
      const data = await api.get('/reports/students');
      contentArea.innerHTML = `
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Student #</th>
                  <th>Total Attempts</th>
                  <th>Passed Assessments</th>
                  <th>Avg Percentage</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(s => `
                  <tr>
                    <td><strong>${escapeHtml(s.first_name)} ${escapeHtml(s.surname)}</strong></td>
                    <td><code>${escapeHtml(s.username)}</code></td>
                    <td>${escapeHtml(s.email)}</td>
                    <td>${escapeHtml(s.student_number || '-')}</td>
                    <td>${s.total_attempts}</td>
                    <td><span class="badge badge-success">${s.passed_assessments}</span></td>
                    <td><strong>${s.average_percentage !== null ? `${s.average_percentage}%` : '-'}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (tab === 'topics') {
      const data = await api.get('/reports/topics');
      contentArea.innerHTML = `
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Topic / Learning Domain</th>
                  <th>Total Questions</th>
                  <th>Total Answers Evaluated</th>
                  <th>Total Correct</th>
                  <th>Accuracy Rate</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(t => `
                  <tr>
                    <td><strong>${escapeHtml(t.topic)}</strong></td>
                    <td>${t.total_questions}</td>
                    <td>${t.total_answers}</td>
                    <td>${t.total_correct}</td>
                    <td>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <strong>${t.accuracy_rate !== null ? `${t.accuracy_rate}%` : '-'}</strong>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  container.querySelectorAll('.r-tab').forEach(b => {
    b.onclick = () => loadReport(b.dataset.tab);
  });

  // Export to CSV
  container.querySelector('#btn-export-csv').onclick = async () => {
    try {
      const csv = await api.get(`/reports/export?type=${activeTab}`);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `eduqe_${activeTab}_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  loadReport('assessments');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
