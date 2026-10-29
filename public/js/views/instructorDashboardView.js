// Instructor Dashboard & Class Progress Tracking View

import { api, authState } from '../api.js';

export function renderInstructorDashboard(container, router) {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const requestedClassId = urlParams.get('class_id') || null;
  const requestedInstructorId = urlParams.get('instructor_id') || null;

  container.innerHTML = `
    <div class="eduqe-hero-banner" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
      <div>
        <div class="eduqe-kicker">&#x1F468;&#x200D;&#x1F3EB; INSTRUCTOR-LED TRAINING &bull; COHORT ANALYTICS</div>
        <h1 style="font-size:1.8rem; font-weight:900; font-family:var(--font-heading); margin-bottom:0.25rem;">Instructor Portal</h1>
        <p class="form-hint" style="margin-bottom:0; font-size:0.9rem;">
          Monitor cohort exam readiness, track student progress, and identify topics requiring in-class review.
        </p>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-instructor-dash">
          &#x21BB; Refresh Live Stats
        </button>
        <button type="button" class="btn btn-primary btn-sm" id="btn-export-instructor-report">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export Class CSV
        </button>
      </div>
    </div>

    <!-- Active Class Selector Bar -->
    <div class="card" style="padding:1rem 1.25rem; margin-bottom:1.5rem; background:var(--surface);">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; align-items:center; gap:0.75rem; flex:1; min-width:280px;">
          <label class="form-label" for="instructor-class-select" style="margin-bottom:0; white-space:nowrap; font-weight:700;">
            Select Cohort / Class:
          </label>
          <select id="instructor-class-select" class="form-control" style="font-weight:600; font-family:var(--font-heading);">
            <option value="">Loading allocated classes...</option>
          </select>
        </div>
        <div id="class-metadata-pills" style="display:flex; gap:0.5rem; align-items:center;"></div>
      </div>
    </div>

    <!-- Overview Stats Grid -->
    <div class="stats-grid" id="inst-metrics-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card">
        <span class="stat-label">Enrolled Learners</span>
        <span class="stat-value" id="stat-class-enrolled">-</span>
        <span class="stat-subtext" id="subtext-enrolled">Active cohort students</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Assessment Participation</span>
        <span class="stat-value" id="stat-class-participation">-</span>
        <span class="stat-subtext" id="subtext-participation">Learners attempted</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Class Average Score</span>
        <span class="stat-value" id="stat-class-avg">-</span>
        <span class="stat-subtext" id="subtext-range">High / Low range</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Cohort Pass Rate</span>
        <span class="stat-value" id="stat-class-pass-rate" style="color:var(--brand-lime);">-</span>
        <span class="stat-subtext" id="subtext-pass-count">Met certification mark</span>
      </div>
    </div>

    <!-- Progress Breakdown Bar -->
    <div class="card" style="padding:1.25rem; margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
        <span style="font-weight:700; font-family:var(--font-heading); font-size:0.9rem;">Cohort Certification Readiness Distribution</span>
        <span id="label-completion-status" style="font-size:0.8rem; color:var(--text-muted);">Calculating...</span>
      </div>
      <div style="height:12px; border-radius:var(--radius-full); background:var(--surface-subtle); display:flex; overflow:hidden; border:1px solid var(--border);">
        <div id="bar-passed" style="height:100%; background:var(--brand-lime); width:0%; transition:width 0.4s ease;" title="Passed"></div>
        <div id="bar-failed" style="height:100%; background:var(--danger); width:0%; transition:width 0.4s ease;" title="Failed"></div>
        <div id="bar-unattempted" style="height:100%; background:var(--border-strong); width:100%; transition:width 0.4s ease;" title="Not Started"></div>
      </div>
      <div style="display:flex; gap:1.5rem; margin-top:0.75rem; font-size:0.8rem; color:var(--text-muted); flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--brand-lime);"></span>
          <span>Passed Certification Mark: <strong id="legend-passed" style="color:var(--text-main);">0</strong></span>
        </div>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--danger);"></span>
          <span>Needs Retake (Below Pass Mark): <strong id="legend-failed" style="color:var(--text-main);">0</strong></span>
        </div>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--border-strong);"></span>
          <span>Not Yet Attempted: <strong id="legend-not-started" style="color:var(--text-main);">0</strong></span>
        </div>
      </div>
    </div>

    <!-- Main Content Tabs / Grid -->
    <div style="display:grid; grid-template-columns:1fr; gap:1.5rem;">

      <!-- Sub-Assessment Section Divisions & Help Tracker -->
      <div class="card" style="padding:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-size:1.25rem;">&#x1F4CA;</span>
              <h2 style="font-size:1.15rem; font-weight:700; margin-bottom:0;">Sub-Assessment Section Divisions &amp; Support Tracker</h2>
            </div>
            <p class="form-hint" style="margin-top:0.25rem; margin-bottom:0;">
              Tracks student progression from one section to the next and highlights which specific sections each learner needs help in.
            </p>
          </div>
          <span class="badge badge-warning" id="badge-sections-help-count" style="display:none;">0 Sections Need Support</span>
        </div>

        <div id="sections-analysis-container">
          <div style="text-align:center; padding:1.5rem; color:var(--text-muted);">
            Loading sub-assessment section divisions...
          </div>
        </div>
      </div>
      
      <!-- Student Performance Roster -->
      <div class="card" style="padding:0; overflow:hidden;">
        <div style="padding:1.25rem 1.25rem 0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; border-bottom:1px solid var(--border);">
          <div>
            <h2 style="font-size:1.15rem; font-weight:700; margin-bottom:0.25rem;">Student Assessment &amp; Section Performance</h2>
            <p class="form-hint" style="margin-bottom:0;">Live tracking of attempts, section-by-section scores, and areas where students need help.</p>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
            <input 
              type="text" 
              id="student-search-filter" 
              class="form-control" 
              placeholder="Search student..." 
              style="max-width:190px; padding:0.4rem 0.65rem; font-size:0.85rem;"
            />
            <select id="student-section-help-filter" class="form-control" style="max-width:195px; padding:0.4rem 0.65rem; font-size:0.85rem;">
              <option value="">All Sections (Filter Help)</option>
            </select>
            <select id="student-status-filter" class="form-control" style="max-width:145px; padding:0.4rem 0.65rem; font-size:0.85rem;">
              <option value="">All Statuses</option>
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
              <option value="Not Started">Not Started</option>
            </select>
          </div>
        </div>

        <div class="table-container" style="border:none; border-radius:0;">
          <table class="table">
            <thead>
              <tr>
                <th style="width:22%;">Student</th>
                <th>Student ID</th>
                <th>Attempts</th>
                <th>Best Score</th>
                <th style="width:30%;">Sub-Assessment Sections &amp; Help Needed</th>
                <th>Status</th>
                <th style="text-align:right;">Last Submission</th>
              </tr>
            </thead>
            <tbody id="inst-students-tbody">
              <tr><td colspan="7" style="text-align:center; padding:2rem;">Loading student roster...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Question Difficulty & Drop-off Analysis (Pedagogical Insights) -->
      <div class="card" style="padding:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-size:1.25rem;">&#x1F4A1;</span>
              <h2 style="font-size:1.15rem; font-weight:700; margin-bottom:0;">Class Question & Topic Weak-Spot Analysis</h2>
            </div>
            <p class="form-hint" style="margin-top:0.25rem; margin-bottom:0;">
              Identifies specific questions and concepts where students struggled most during practice exams.
            </p>
          </div>
          <span class="badge badge-warning" id="badge-weak-count" style="display:none;">0 Questions Need Review</span>
        </div>

        <div id="questions-analysis-container">
          <div style="text-align:center; padding:1.5rem; color:var(--text-muted);">
            Analyzing question responses across cohort attempts...
          </div>
        </div>
      </div>

    </div>
  `;

  // UI References
  const classSelect = container.querySelector('#instructor-class-select');
  const metadataPills = container.querySelector('#class-metadata-pills');
  const sectionsContainer = container.querySelector('#sections-analysis-container');
  const studentsTbody = container.querySelector('#inst-students-tbody');
  const questionsContainer = container.querySelector('#questions-analysis-container');
  const searchInput = container.querySelector('#student-search-filter');
  const sectionHelpFilter = container.querySelector('#student-section-help-filter');
  const statusFilter = container.querySelector('#student-status-filter');
  const refreshBtn = container.querySelector('#btn-refresh-instructor-dash');
  const exportBtn = container.querySelector('#btn-export-instructor-report');

  let currentData = null;
  let activeClassId = requestedClassId;

  async function loadDashboardData() {
    try {
      const res = await api.getInstructorProgress(activeClassId, requestedInstructorId);
      currentData = res;

      if (!res.assigned_classes || res.assigned_classes.length === 0) {
        container.innerHTML = `
          <div class="card" style="text-align:center; padding:4rem 2rem; max-width:600px; margin:3rem auto;">
            <div style="font-size:3rem; margin-bottom:1rem;">&#x1F3EB;</div>
            <h2 style="font-size:1.5rem; font-weight:800; margin-bottom:0.75rem;">No Classes Currently Assigned</h2>
            <p class="form-hint" style="font-size:0.95rem; margin-bottom:1.5rem;">
              You do not have any active classes allocated to your instructor account yet. Please contact your training administrator to assign you to a course cohort.
            </p>
            <div>
              <a href="#login" class="btn btn-secondary">Return to Sign In</a>
            </div>
          </div>
        `;
        return;
      }

      // Populate Class Selector
      classSelect.innerHTML = res.assigned_classes.map(c => `
        <option value="${c.id}" ${c.id === res.selected_class.id ? 'selected' : ''}>
          ${escapeHtml(c.name)} &bull; ${escapeHtml(c.course_name)} (${escapeHtml(c.course_code)})
        </option>
      `).join('');

      activeClassId = res.selected_class.id;

      // Class Metadata Pills
      metadataPills.innerHTML = `
        ${res.selected_class.active_code ? `
          <span class="badge badge-neutral" title="Active Class Access Code">&#x1F511; Code: <strong style="font-family:var(--font-mono);">${escapeHtml(res.selected_class.active_code)}</strong>
            ${res.selected_class.code_max_uses ? `<span style="font-weight:600; margin-left:0.35rem; color:${res.selected_class.code_used_count >= res.selected_class.code_max_uses ? 'var(--danger)' : 'inherit'};">(${res.selected_class.code_used_count || 0}/${res.selected_class.code_max_uses} used)</span>` : ''}
          </span>
        ` : ''}
        <span class="badge badge-primary">${escapeHtml(res.selected_class.course_code)}</span>
        <span class="badge badge-neutral">${res.selected_class.assessment_count || 0} Exam(s)</span>
        <span class="badge ${res.selected_class.status === 'active' ? 'badge-success' : 'badge-neutral'}">
          ${escapeHtml((res.selected_class.status || 'ACTIVE').toUpperCase())}
        </span>
      `;

      // Render Summary Metrics
      const sum = res.summary;
      container.querySelector('#stat-class-enrolled').textContent = sum.total_enrolled;
      container.querySelector('#stat-class-participation').textContent = `${sum.completion_rate}% (${sum.students_attempted}/${sum.total_enrolled})`;
      container.querySelector('#stat-class-avg').textContent = `${sum.avg_score}%`;
      container.querySelector('#subtext-range').textContent = `High: ${sum.highest_score}% &bull; Low: ${sum.lowest_score}%`;
      container.querySelector('#stat-class-pass-rate').textContent = `${sum.pass_rate}%`;
      container.querySelector('#subtext-pass-count').textContent = `${sum.students_passed} of ${sum.students_attempted} passed`;

      // Progress bar distribution
      const total = sum.total_enrolled || 1;
      const passedPct = Math.round((sum.students_passed / total) * 100);
      const failedCount = Math.max(0, sum.students_attempted - sum.students_passed);
      const failedPct = Math.round((failedCount / total) * 100);
      const unattemptedCount = Math.max(0, sum.total_enrolled - sum.students_attempted);
      const unattemptedPct = Math.max(0, 100 - passedPct - failedPct);

      container.querySelector('#bar-passed').style.width = `${passedPct}%`;
      container.querySelector('#bar-failed').style.width = `${failedPct}%`;
      container.querySelector('#bar-unattempted').style.width = `${unattemptedPct}%`;

      container.querySelector('#label-completion-status').textContent = `${sum.students_attempted} of ${sum.total_enrolled} students have taken assessments`;
      container.querySelector('#legend-passed').textContent = `${sum.students_passed} (${passedPct}%)`;
      container.querySelector('#legend-failed').textContent = `${failedCount} (${failedPct}%)`;
      container.querySelector('#legend-not-started').textContent = `${unattemptedCount} (${unattemptedPct}%)`;

      // Populate section filter options
      const sectionsList = res.sections_analysis || [];
      if (sectionHelpFilter) {
        const prevSecVal = sectionHelpFilter.value;
        sectionHelpFilter.innerHTML = `<option value="">All Sections (Filter Help)</option>` +
          sectionsList.map(sec => `<option value="${escapeHtml(sec.name)}" ${sec.name === prevSecVal ? 'selected' : ''}>Needs Help: ${escapeHtml(sec.name)}</option>`).join('');
      }

      renderSectionAnalytics();
      renderStudentRoster();
      renderQuestionAnalytics();

    } catch (err) {
      studentsTbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger); text-align:center; padding:2rem;">Failed to load instructor dashboard: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderSectionAnalytics() {
    if (!sectionsContainer) return;
    const sections = (currentData && currentData.sections_analysis) || [];
    const badgeHelpCount = container.querySelector('#badge-sections-help-count');

    if (sections.length === 0) {
      sectionsContainer.innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:var(--text-muted);">
          No assessment sections configured for this class yet.
        </div>
      `;
      if (badgeHelpCount) badgeHelpCount.style.display = 'none';
      return;
    }

    const sectionsWithStrugglingStudents = sections.filter(sec => sec.students_needing_help && sec.students_needing_help.length > 0);
    if (badgeHelpCount) {
      if (sectionsWithStrugglingStudents.length > 0) {
        badgeHelpCount.textContent = `${sectionsWithStrugglingStudents.length} Section(s) Have Learners Needing Help`;
        badgeHelpCount.style.display = 'inline-block';
      } else {
        badgeHelpCount.style.display = 'none';
      }
    }

    sectionsContainer.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:1rem;">
        ${sections.map((sec, idx) => {
          const secName = sec.name || sec.section_name || `Section ${idx + 1}`;
          const helpList = sec.students_needing_help || [];
          const allStudentResults = sec.all_student_results || [];
          const completedCount = sec.completed_students_count ?? sec.students_completed ?? 0;
          const inProgressCount = sec.in_progress_students_count ?? sec.students_in_progress ?? 0;
          const totalEnrolled = sec.total_enrolled ?? (currentData?.summary?.total_enrolled || 0);
          const totalAttempts = sec.total_attempts_count ?? 0;
          const totalAnswers = sec.total_answers ?? 0;
          const correctAnswers = sec.correct_answers ?? 0;
          const hasAttempts = (completedCount + inProgressCount) > 0 || totalAnswers > 0;
          const avgPct = sec.avg_percentage !== null && sec.avg_percentage !== undefined ? sec.avg_percentage : 0;
          const latestAvg = sec.latest_avg_percentage !== null && sec.latest_avg_percentage !== undefined ? sec.latest_avg_percentage : avgPct;
          const bestAvg = sec.best_avg_percentage !== null && sec.best_avg_percentage !== undefined ? sec.best_avg_percentage : avgPct;
          const hasHelpNeeded = helpList.length > 0 || Boolean(sec.needs_help || sec.needs_review);

          return `
            <div style="border:1px solid ${hasHelpNeeded ? 'rgba(220,38,38,0.4)' : 'var(--border)'}; background:${hasHelpNeeded ? 'rgba(220,38,38,0.03)' : 'var(--surface-subtle)'}; border-top:4px solid ${hasHelpNeeded ? 'var(--danger)' : 'var(--brand-lime)'}; border-radius:var(--radius-md); padding:1rem 1.15rem; display:flex; flex-direction:column; justify-content:space-between; gap:0.85rem;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom:0.5rem;">
                  <div>
                    <span style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">Sub-Assessment Division ${idx + 1}</span>
                    <h3 style="font-size:1.05rem; font-weight:800; margin:0.1rem 0 0; color:var(--text-main);">${escapeHtml(secName)}</h3>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:1.35rem; font-weight:900; font-family:var(--font-heading); color:${!hasAttempts ? 'var(--text-muted)' : (hasHelpNeeded ? 'var(--danger)' : 'var(--brand-lime)')};">
                      ${hasAttempts ? `${avgPct}%` : '-'}
                    </div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">
                      ${hasAttempts ? `${correctAnswers}/${totalAnswers} Correct` : 'Cohort Avg'}
                    </div>
                  </div>
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.65rem;">
                  <span class="badge badge-neutral" style="font-size:0.72rem;">${sec.question_count || 0} Question(s)</span>
                  <span class="badge badge-success" style="font-size:0.72rem;">&#x2713; ${completedCount}/${totalEnrolled} Completed</span>
                  ${inProgressCount > 0 ? `<span class="badge badge-warning" style="font-size:0.72rem;">&#x23F3; ${inProgressCount} In Progress</span>` : ''}
                  ${totalAttempts > 0 ? `<span class="badge badge-neutral" style="font-size:0.72rem;">${totalAttempts} Attempt(s) Tracked</span>` : ''}
                </div>

                ${hasAttempts && bestAvg !== latestAvg ? `
                  <div style="display:flex; justify-content:space-between; font-size:0.74rem; color:var(--text-muted); margin-bottom:0.4rem;">
                    <span>Best Attempt Avg: <strong style="color:var(--text-main);">${bestAvg}%</strong></span>
                    <span>Latest Attempt Avg: <strong style="color:var(--text-main);">${latestAvg}%</strong></span>
                  </div>
                ` : ''}

                <div style="height:6px; background:var(--surface); border-radius:var(--radius-full); overflow:hidden; border:1px solid var(--border);">
                  <div style="height:100%; width:${hasAttempts ? Math.min(100, Math.max(0, avgPct)) : 0}%; background:${hasHelpNeeded ? 'var(--danger)' : 'var(--brand-lime)'}; transition:width 0.3s ease;"></div>
                </div>
              </div>

              <!-- Per-Student Tracked Results for this Section -->
              ${allStudentResults.length > 0 ? `
                <div style="border-top:1px solid var(--border); padding-top:0.65rem;">
                  <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.4rem;">
                    Tracked Student Results (${allStudentResults.length})
                  </div>
                  <div style="display:flex; flex-direction:column; gap:0.4rem;">
                    ${allStudentResults.map(st => {
                      const sName = st.student_name || `${st.first_name || ''} ${st.surname || ''}`.trim() || 'Student';
                      const attHist = Array.isArray(st.attempt_history) ? st.attempt_history : [];
                      if (!st.is_completed && !st.is_in_progress) {
                        return `
                          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; padding:0.3rem 0.5rem; background:var(--surface); border-radius:var(--radius-sm); border:1px solid var(--border);">
                            <span style="font-weight:600; color:var(--text-main);">${escapeHtml(sName)}</span>
                            <span class="badge badge-neutral" style="font-size:0.68rem;">Not Started</span>
                          </div>
                        `;
                      }
                      return `
                        <div style="display:flex; flex-direction:column; gap:0.25rem; padding:0.4rem 0.55rem; background:var(--surface); border-radius:var(--radius-sm); border:1px solid ${st.needs_help ? 'rgba(220,38,38,0.35)' : 'var(--border)'};">
                          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                            <span style="font-weight:700; font-size:0.8rem; color:var(--text-main);">${escapeHtml(sName)}</span>
                            <span class="badge ${st.needs_help ? 'badge-danger' : (st.is_in_progress ? 'badge-warning' : 'badge-success')}" style="font-size:0.7rem;">
                              ${st.is_in_progress ? `&#x23F3; ${st.answered_count}/${st.total_questions} (${st.percentage ?? 0}%)` : `Latest: ${st.correct_count}/${st.total_questions} (${st.latest_percentage ?? st.percentage ?? 0}%)`}
                              ${st.needs_help ? ' &#x26A0;&#xFE0F; Needs Help' : ' &#x2713;'}
                            </span>
                          </div>
                          ${attHist.length > 1 ? `
                            <div style="display:flex; flex-wrap:wrap; gap:0.3rem; align-items:center; font-size:0.7rem; color:var(--text-muted);">
                              <span>All Attempts (${st.total_correct_all_attempts}/${st.total_answers_all_attempts} &bull; Avg ${st.avg_percentage}% &bull; Best ${st.best_percentage}%):</span>
                              ${attHist.map(ah => `
                                <span style="padding:0.1rem 0.35rem; border-radius:4px; background:var(--surface-subtle); border:1px solid var(--border); font-weight:600;">
                                  #${ah.attempt_number}: ${ah.correct_count}/${ah.total_questions} (${ah.percentage}%)
                                </span>
                              `).join('')}
                            </div>
                          ` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}

              <div style="border-top:1px dashed var(--border); padding-top:0.65rem;">
                ${helpList.length > 0 ? `
                  <div style="font-size:0.75rem; font-weight:700; color:var(--danger); margin-bottom:0.35rem;">
                    &#x26A0;&#xFE0F; Students Needing Help in ${escapeHtml(secName)} (${helpList.length}):
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
                    ${helpList.map(st => {
                      const sName = st.student_name || `${st.first_name || ''} ${st.surname || ''}`.trim() || 'Student';
                      const pctLabel = st.best_percentage !== undefined && st.best_percentage !== null && st.best_percentage !== st.percentage
                        ? `Latest: ${st.percentage}% | Best: ${st.best_percentage}%`
                        : `${st.percentage ?? 0}%`;
                      return `
                        <span class="badge badge-danger" style="font-size:0.72rem;" title="Student Number: ${escapeHtml(st.student_number || 'N/A')}">
                          ${escapeHtml(sName)} (${pctLabel})
                        </span>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <div style="font-size:0.78rem; color:var(--text-muted); display:flex; align-items:center; gap:0.35rem;">
                    <span style="color:var(--brand-lime); font-weight:800;">&#x2714;</span>
                    ${hasAttempts ? 'All participating students meet the pass threshold for this section.' : 'Awaiting student section submissions.'}
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderStudentRoster() {
    if (!currentData || !currentData.students) return;

    const q = (searchInput.value || '').trim().toLowerCase();
    const statusVal = statusFilter.value;
    const secHelpVal = sectionHelpFilter ? sectionHelpFilter.value : '';

    const filtered = currentData.students.filter(s => {
      const matchQ = !q || (
        s.first_name.toLowerCase().includes(q) ||
        s.surname.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.student_number && s.student_number.toLowerCase().includes(q))
      );
      const matchStatus = !statusVal || s.status_label === statusVal;
      const matchSecHelp = !secHelpVal || (Array.isArray(s.sections_needing_help) && s.sections_needing_help.includes(secHelpVal));
      return matchQ && matchStatus && matchSecHelp;
    });

    if (filtered.length === 0) {
      studentsTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No learners match the current filter.</td></tr>`;
      return;
    }

    studentsTbody.innerHTML = filtered.map(s => {
      let statusBadge = '<span class="badge badge-neutral">Not Started</span>';
      if (s.status_label === 'Passed') {
        statusBadge = '<span class="badge badge-success">&#x2714;&#xFE0F; PASSED</span>';
      } else if (s.status_label === 'Failed') {
        statusBadge = '<span class="badge badge-danger">&#x2718;&#xFE0F; NEEDS RETAKE</span>';
      }

      const secBreakdown = Array.isArray(s.section_breakdown) ? s.section_breakdown : [];
      const helpSections = Array.isArray(s.sections_needing_help) ? s.sections_needing_help : [];

      let sectionCellHtml = '<span style="font-size:0.8rem; color:var(--text-muted);">No section data yet</span>';
      if (secBreakdown.length > 0) {
        sectionCellHtml = `
          <div style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:${helpSections.length > 0 ? '0.35rem' : '0'};">
            ${secBreakdown.map(sec => {
              const secTitle = sec.name || sec.section_name || 'Section';
              const isComp = Boolean(sec.is_completed || sec.status === 'Completed');
              const isInProg = Boolean(sec.is_in_progress || sec.status === 'In Progress');
              const attHistory = Array.isArray(sec.attempt_history) ? sec.attempt_history : [];
              const historyTitle = attHistory.length > 0
                ? attHistory.map(a => `Attempt #${a.attempt_number}: ${a.correct_count}/${a.total_questions} (${a.percentage}%)`).join(' | ')
                : `${secTitle}: ${sec.correct_count ?? 0}/${sec.total_questions ?? 0} correct`;

              if (!isComp && !isInProg && (sec.answered_count === 0 || sec.status === 'Not Started' || sec.status === 'Pending')) {
                return `<span class="badge badge-neutral" style="font-size:0.7rem;" title="${escapeHtml(secTitle)}: Not started">${escapeHtml(secTitle)}: Pending</span>`;
              }
              if (isInProg) {
                return `<span class="badge badge-warning" style="font-size:0.7rem;" title="Currently working on ${escapeHtml(secTitle)}">&#x23F3; ${escapeHtml(secTitle)}: ${sec.answered_count}/${sec.total_questions} (${sec.percentage ?? 0}%)</span>`;
              }
              const pctText = (sec.best_percentage !== null && sec.best_percentage !== undefined && sec.best_percentage !== sec.percentage)
                ? `${sec.percentage}% (Best: ${sec.best_percentage}%)`
                : `${sec.percentage ?? 0}% (${sec.correct_count ?? 0}/${sec.total_questions ?? 0})`;
              return `
                <span class="badge ${sec.needs_help ? 'badge-danger' : 'badge-success'}" style="font-size:0.7rem;" title="${escapeHtml(historyTitle)}">
                  ${escapeHtml(secTitle)}: ${pctText} ${sec.needs_help ? '&#x26A0;&#xFE0F;' : '&#x2713;'}
                </span>
              `;
            }).join('')}
          </div>
          ${helpSections.length > 0 ? `
            <div style="font-size:0.73rem; color:var(--danger); font-weight:700;">
              Needs help in: ${helpSections.map(escapeHtml).join(', ')}
            </div>
          ` : ''}
        `;
      }

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.65rem;">
              <div style="width:32px; height:32px; border-radius:50%; background:var(--surface-subtle); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem;">
                ${escapeHtml((s.first_name?.[0] || 'S').toUpperCase())}
              </div>
              <div>
                <div style="font-weight:700; color:var(--text-main);">${escapeHtml(s.first_name)} ${escapeHtml(s.surname)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(s.email)}</div>
              </div>
            </div>
          </td>
          <td><code>${escapeHtml(s.student_number || 'N/A')}</code></td>
          <td>
            <span class="badge badge-neutral">${s.attempt_count} attempt(s)</span>
          </td>
          <td>
            ${s.best_score !== null ? `<strong style="font-size:1.05rem; font-family:var(--font-heading); color:${s.has_passed ? 'var(--brand-lime)' : 'var(--danger)'};">${s.best_score}%</strong>` : '<span style="color:var(--text-muted);">-</span>'}
            ${s.latest_score !== null && s.latest_score !== s.best_score ? `<div style="font-size:0.72rem; color:var(--text-muted);">Latest: ${s.latest_score}%</div>` : ''}
          </td>
          <td>${sectionCellHtml}</td>
          <td>${statusBadge}</td>
          <td style="text-align:right; font-size:0.8rem; color:var(--text-muted);">
            ${s.latest_attempt_at ? new Date(s.latest_attempt_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderQuestionAnalytics() {
    if (!currentData || !currentData.questions_analysis) return;
    const questions = currentData.questions_analysis;
    const weakCountBadge = container.querySelector('#badge-weak-count');

    if (questions.length === 0) {
      questionsContainer.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--text-muted);">
          No question attempts recorded for this class yet. As students take practice assessments, question drop-off and accuracy stats will appear here.
        </div>
      `;
      weakCountBadge.style.display = 'none';
      return;
    }

    const weakQuestions = questions.filter(q => q.needs_review);
    if (weakQuestions.length > 0) {
      weakCountBadge.textContent = `${weakQuestions.length} Questions Need In-Class Review`;
      weakCountBadge.style.display = 'inline-block';
    } else {
      weakCountBadge.style.display = 'none';
    }

    questionsContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        ${questions.map((q, idx) => {
          const isWeak = q.needs_review;
          const pct = q.success_percentage || 0;
          return `
            <div style="border:1px solid ${isWeak ? 'rgba(220,38,38,0.4)' : 'var(--border)'}; background:${isWeak ? 'rgba(220,38,38,0.03)' : 'var(--surface)'}; border-left:4px solid ${isWeak ? 'var(--danger)' : 'var(--brand-lime)'}; padding:0.9rem 1.15rem; border-radius:var(--radius-md);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:0.4rem;">
                <div style="flex:1;">
                  <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem; flex-wrap:wrap;">
                    <span class="badge ${isWeak ? 'badge-danger' : 'badge-primary'}" style="font-size:0.7rem;">
                      ${isWeak ? '⚠️ REVIEW RECOMMENDED' : '&#x2714;&#xFE0F; GOOD MASTERY'}
                    </span>
                    <span class="badge badge-secondary" style="font-size:0.7rem;">&#x1F4C2; ${escapeHtml(q.section_name || 'Section 1')}</span>
                    <span class="badge badge-neutral" style="font-size:0.7rem;">${escapeHtml(q.topic || 'General')}</span>
                    <span class="badge badge-neutral" style="font-size:0.7rem; text-transform:capitalize;">${escapeHtml(q.difficulty || 'medium')}</span>
                  </div>
                  <div style="font-weight:600; font-size:0.9rem; color:var(--text-main);">
                    ${escapeHtml(q.question_text.length > 140 ? q.question_text.slice(0, 140) + '...' : q.question_text)}
                  </div>
                </div>
                <div style="text-align:right; min-width:110px;">
                  <div style="font-size:1.25rem; font-weight:800; font-family:var(--font-heading); color:${isWeak ? 'var(--danger)' : 'var(--text-main)'};">
                    ${pct}%
                  </div>
                  <div style="font-size:0.725rem; color:var(--text-muted);">
                    ${q.correct_answers} / ${q.total_answers} correct
                  </div>
                </div>
              </div>
              <div style="height:6px; background:var(--surface-subtle); border-radius:var(--radius-full); overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:${isWeak ? 'var(--danger)' : 'var(--brand-lime)'};"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Event Handlers
  classSelect.onchange = () => {
    activeClassId = classSelect.value;
    loadDashboardData();
  };

  searchInput.oninput = renderStudentRoster;
  if (sectionHelpFilter) sectionHelpFilter.onchange = renderStudentRoster;
  statusFilter.onchange = renderStudentRoster;
  refreshBtn.onclick = loadDashboardData;

  // Export CSV
  exportBtn.onclick = async () => {
    if (!activeClassId) return;
    try {
      const params = new URLSearchParams({ class_id: activeClassId });
      if (requestedInstructorId) params.set('instructor_id', requestedInstructorId);
      const res = await fetch(`/api/instructor/export-class?${params.toString()}`, {
        headers: authState.token ? { Authorization: `Bearer ${authState.token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to export class report');
      const csvText = await res.text();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `class_progress_${activeClassId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export CSV: ' + err.message);
    }
  };

  // Initial Load
  loadDashboardData();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
