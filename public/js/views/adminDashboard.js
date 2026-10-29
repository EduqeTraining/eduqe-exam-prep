// Administrator Dashboard View (Section 4)

import { api } from '../api.js';

export async function renderAdminDashboard(container, router) {
  container.innerHTML = `<div style="text-align:center; padding:3rem;">Loading Dashboard Overview...</div>`;

  try {
    const data = await api.get('/reports/dashboard');
    const s = data.summary;

    container.innerHTML = `
      <div class="eduqe-hero-banner" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.25rem;">
        <div>
          <div class="eduqe-kicker">&#x26A1; EXPERTS IN IT TRAINING &bull; EDUQE ASSESSMENT SYSTEM</div>
          <h1 style="font-size:1.8rem; font-weight:900; margin-bottom:0.25rem;">Administrator Control Centre</h1>
          <p class="form-hint" style="margin-bottom:0; font-size:0.9rem;">Monitor Multi-OEM certification courses, active exam sessions, instructor cohorts, and learner readiness across Eduqe.</p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" id="dash-create-course">+ Create Course</button>
          <button type="button" class="btn btn-secondary" id="dash-create-class">+ Create Class</button>
          <button type="button" class="btn btn-secondary" id="dash-add-instructor">+ Add Instructor</button>
          <button type="button" class="btn btn-secondary" id="dash-add-student">+ Add Student</button>
          <button type="button" class="btn btn-secondary" id="dash-create-q">+ Create Question</button>
          <button type="button" class="btn btn-secondary" id="dash-create-assess">+ Create Assessment</button>
        </div>
      </div>

      <!-- Quick Stats Grid (Section 4 Metrics) -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total Courses</span>
          <span class="stat-value">${s.totalCourses}</span>
          <span class="stat-subtext">${s.activeCourses} Active &bull; ${s.draftCourses} Draft</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Total Classes</span>
          <span class="stat-value">${s.totalClasses}</span>
          <span class="stat-subtext">Across all courses</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Active Students</span>
          <span class="stat-value">${s.activeStudents}</span>
          <span class="stat-subtext">Total: ${s.totalStudents} accounts</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Assessments</span>
          <span class="stat-value">${s.publishedAssessments}</span>
          <span class="stat-subtext">${s.publishedAssessments} Published &bull; ${s.draftAssessments} Draft</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Current Exam Sessions</span>
          <span class="stat-value" style="color:var(--primary);">${s.currentSessions}</span>
          <span class="stat-subtext">In-progress active attempts</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Needs Review</span>
          <span class="stat-value" style="color:${s.needingReview > 0 ? 'var(--warning)' : 'var(--text-main)'};">${s.needingReview}</span>
          <span class="stat-subtext">Subjective / manual review</span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1.5rem; margin-top:1.5rem;">
        <!-- Recent Assessment Attempts -->
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="card-header" style="padding:1rem 1.25rem; margin-bottom:0;">
            <h3 class="card-title">Recent Assessment Attempts</h3>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-view-all-reports">View All Reports &rarr;</button>
          </div>
          <div class="table-container" style="border:none;">
            <table class="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Assessment / Course</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${(data.recentAttempts || []).length === 0 ? `
                  <tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">No attempts recorded yet.</td></tr>
                ` : (data.recentAttempts || []).map(att => `
                  <tr>
                    <td>
                      <strong>${escapeHtml(att.first_name)} ${escapeHtml(att.surname)}</strong>
                      <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(att.username)}</div>
                    </td>
                    <td>
                      <div>${escapeHtml(att.assessment_name)}</div>
                      <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(att.class_name)}</div>
                    </td>
                    <td>
                      <span class="badge ${att.is_passed ? 'badge-success' : (att.status === 'in_progress' ? 'badge-primary' : 'badge-danger')}">
                        ${att.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <strong>${att.score} / ${att.max_score}</strong>
                      <span style="font-size:0.75rem; color:var(--text-muted);">(${att.percentage}%)</span>
                    </td>
                    <td style="font-size:0.8125rem; color:var(--text-muted);">${att.started_at ? att.started_at.substring(0, 16) : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Alerts Side Column: Expiring Soon & Not Started -->
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
          <!-- Expiring Soon -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom:0.75rem; color:var(--warning); display:flex; align-items:center; gap:0.5rem;">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Access Expiring Soon (Next 7 Days)
            </h3>
            ${(data.expiringSoon || []).length === 0 ? `
              <p class="form-hint">No student access records expiring within 7 days.</p>
            ` : `
              <div style="display:flex; flex-direction:column; gap:0.5rem;">
                ${(data.expiringSoon || []).map(item => `
                  <div style="padding:0.6rem; background:var(--surface-subtle); border-radius:var(--radius-md); font-size:0.8125rem;">
                    <strong>${escapeHtml(item.first_name)} ${escapeHtml(item.surname)}</strong> &bull; ${escapeHtml(item.class_name)}
                    <div style="color:var(--warning); font-weight:600;">Expires: ${item.access_expires_at ? item.access_expires_at.substring(0, 10) : ''}</div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Students Not Started -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom:0.75rem;">Students Not Started</h3>
            <p class="form-hint" style="margin-bottom:0.75rem;">Enrolled students who have not started assigned exams:</p>
            ${(data.notStarted || []).length === 0 ? `
              <p class="form-hint">All enrolled students have started their exams.</p>
            ` : `
              <div style="display:flex; flex-direction:column; gap:0.5rem;">
                ${(data.notStarted || []).slice(0, 5).map(item => `
                  <div style="padding:0.6rem; background:var(--surface-subtle); border-radius:var(--radius-md); font-size:0.8125rem; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <strong>${escapeHtml(item.first_name)} ${escapeHtml(item.surname)}</strong>
                      <div style="color:var(--text-muted); font-size:0.75rem;">${escapeHtml(item.assessment_name)}</div>
                    </div>
                    <span class="badge badge-neutral">Not Started</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    // Hook up quick action buttons
    container.querySelector('#dash-create-course').onclick = () => router.navigate('#courses', { action: 'create' });
    container.querySelector('#dash-create-class').onclick = () => router.navigate('#classes', { action: 'create' });
    container.querySelector('#dash-add-instructor').onclick = () => router.navigate('#instructors', { action: 'add' });
    container.querySelector('#dash-add-student').onclick = () => router.navigate('#students', { action: 'add' });
    container.querySelector('#dash-create-q').onclick = () => router.navigate('#question-bank', { action: 'create' });
    container.querySelector('#dash-create-assess').onclick = () => router.navigate('#assessments', { action: 'create' });
    container.querySelector('#btn-view-all-reports').onclick = () => router.navigate('#reports');

  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--danger)">Failed to load dashboard: ${err.message}</div>`;
  }
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
