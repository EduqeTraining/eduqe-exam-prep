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

      <!-- Assessment Pass Rate & Section Question Breakdown Controls -->
      <div class="card" id="assessment-config-card" style="padding:1.25rem;">
        <div id="assessment-config-container">
          <div style="text-align:center; padding:1rem; color:var(--text-muted);">
            Loading assessment settings...
          </div>
        </div>
      </div>

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
              <h2 style="font-size:1.15rem; font-weight:700; margin-bottom:0;">Class Questions &amp; Topics Weak-Spot Analysis</h2>
            </div>
            <p class="form-hint" style="margin-top:0.25rem; margin-bottom:0;">
              All questions configured for this course/assessment with student accuracy breakdown, answer keys, and pedagogical explanations. Click on any question to view its options and correct answer.
            </p>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span class="badge badge-warning" id="badge-weak-count" style="display:none;">0 Questions Need Review</span>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-toggle-all-questions" style="font-size:0.75rem; font-weight:700;">
              Expand All Details
            </button>
          </div>
        </div>

        <!-- Filter bar for questions -->
        <div style="display:flex; gap:0.65rem; margin-bottom:1rem; align-items:center; flex-wrap:wrap; padding:0.65rem 0.85rem; background:var(--surface-subtle); border-radius:var(--radius-md); border:1px solid var(--border);">
          <input 
            type="text" 
            id="q-search-filter" 
            class="form-control" 
            placeholder="Search questions or topics..." 
            style="max-width:240px; padding:0.4rem 0.65rem; font-size:0.85rem;"
          />
          <select id="q-section-filter" class="form-control" style="max-width:200px; padding:0.4rem 0.65rem; font-size:0.85rem;">
            <option value="">All Sections</option>
          </select>
          <select id="q-status-filter" class="form-control" style="max-width:185px; padding:0.4rem 0.65rem; font-size:0.85rem;">
            <option value="">All Statuses</option>
            <option value="weak">⚠️ Review Recommended (&lt; 60%)</option>
            <option value="mastery">✔ Good Mastery (≥ 60%)</option>
            <option value="unattempted">⏳ Not Yet Attempted</option>
          </select>
          <span id="q-count-badge" style="font-size:0.75rem; color:var(--text-muted); margin-left:auto; font-weight:600;"></span>
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
      const totalLearnersAcrossClasses = res.assigned_classes.reduce((sum, c) => sum + (Number(c.student_count) || 0), 0);
      const allOptionHtml = res.assigned_classes.length > 1
        ? `<option value="all" ${res.selected_class.id === 'all' ? 'selected' : ''}>&#x1F4DA; All Cohorts / Classes (${totalLearnersAcrossClasses} Total Learners)</option>`
        : '';

      classSelect.innerHTML = allOptionHtml + res.assigned_classes.map(c => `
        <option value="${c.id}" ${c.id === res.selected_class.id ? 'selected' : ''}>
          ${escapeHtml(c.name)} &bull; ${escapeHtml(c.course_name || 'Course')} (${c.student_count || 0} learner${c.student_count === 1 ? '' : 's'}${c.active_code ? ` &bull; Code: ${escapeHtml(c.active_code)}` : ''})
        </option>
      `).join('');

      activeClassId = res.selected_class.id;

      // Class Metadata Pills
      metadataPills.innerHTML = res.selected_class.id === 'all'
        ? `
          <span class="badge badge-primary">&#x1F4DA; All Cohorts Overview</span>
          <span class="badge badge-neutral">${res.assigned_classes.length} Classes</span>
          <span class="badge badge-success">${totalLearnersAcrossClasses} Total Learners</span>
        `
        : `
          ${res.selected_class.active_code ? `
            <span class="badge badge-neutral" title="Active Class Access Code">&#x1F511; Code: <strong style="font-family:var(--font-mono);">${escapeHtml(res.selected_class.active_code)}</strong>
              ${res.selected_class.code_max_uses ? `<span style="font-weight:600; margin-left:0.35rem; color:${res.selected_class.code_used_count >= res.selected_class.code_max_uses ? 'var(--danger)' : 'inherit'};">(${res.selected_class.code_used_count || 0}/${res.selected_class.code_max_uses} used)</span>` : ''}
            </span>
          ` : ''}
          <span class="badge badge-primary">${escapeHtml(res.selected_class.course_code || 'COHORT')}</span>
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

      renderAssessmentConfig();
      renderSectionAnalytics();
      renderStudentRoster();
      renderQuestionAnalytics();

    } catch (err) {
      studentsTbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger); text-align:center; padding:2rem;">Failed to load instructor dashboard: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderAssessmentConfig() {
    const configContainer = container.querySelector('#assessment-config-container');
    if (!configContainer) return;

    if (!currentData || !currentData.selected_class || currentData.selected_class.id === 'all') {
      configContainer.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-size:1.25rem;">⚙️</span>
              <h2 style="font-size:1.15rem; font-weight:700; margin-bottom:0;">Assessment Pass Rate &amp; Section Question Breakdown</h2>
            </div>
            <p class="form-hint" style="margin-top:0.25rem; margin-bottom:0;">
              Customize the passing threshold and divide assessment sections into smaller sequential parts.
            </p>
          </div>
          <div style="font-size:0.825rem; color:var(--text-muted); font-style:italic; background:var(--surface-subtle); padding:0.35rem 0.65rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
            👉 Please select a specific cohort above to customize pass rates and question breakdowns.
          </div>
        </div>
      `;
      return;
    }

    const cls = currentData.selected_class;
    const cfg = currentData.class_assessment_config || {};
    const passMark = cfg.pass_mark_percentage || 70;
    const cfgSections = cfg.sections || {};
    const baseSections = currentData.base_sections || [];

    configContainer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.1rem; flex-wrap:wrap; gap:0.75rem;">
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-size:1.25rem;">⚙️</span>
            <h2 style="font-size:1.15rem; font-weight:700; margin-bottom:0;">
              Assessment Pass Rate &amp; Section Question Breakdown: <span style="color:var(--brand-lime);">${escapeHtml(cls.name)}</span>
            </h2>
          </div>
          <p class="form-hint" style="margin-top:0.25rem; margin-bottom:0;">
            Set the required pass percentage for this cohort and customize how many questions delegates answer or break sections into smaller sequential parts.
          </p>
        </div>
      </div>

      <!-- Pass Rate Control -->
      <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; padding:0.85rem 1.15rem; background:var(--surface-subtle); border-radius:var(--radius-md); border:1px solid var(--border); flex-wrap:wrap;">
        <div>
          <label for="cfg-pass-rate" style="font-weight:700; font-size:0.92rem; display:block; margin-bottom:0.15rem; color:var(--text-main);">
            🎯 Required Pass Rate Percentage (%)
          </label>
          <span style="font-size:0.78rem; color:var(--text-muted);">
            Minimum score percentage required to pass this assessment for this cohort.
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <input 
            type="number" 
            id="cfg-pass-rate" 
            min="1" 
            max="100" 
            class="form-control" 
            value="${passMark}" 
            style="width:95px; font-weight:800; font-size:1.15rem; text-align:center; padding:0.35rem 0.5rem;" 
          />
          <span style="font-weight:800; font-size:1.15rem; color:var(--text-main);">%</span>
        </div>
      </div>

      <!-- Section Question Limiting & Part Breakdown -->
      <div style="margin-bottom:1.25rem;">
        <div style="font-weight:700; font-size:0.95rem; margin-bottom:0.25rem; color:var(--text-main);">
          ✂️ Section Question Limits &amp; Sub-Section Chunking
        </div>
        <p class="form-hint" style="margin-bottom:0.85rem;">
          Limit questions (e.g. only do the first 20 of 50 questions) or split a section into smaller parts (e.g. 50 questions &rarr; Part 1 with 25 questions and Part 2 with 25 questions) so delegates do them in stages and you unlock each part sequentially.
        </p>

        ${baseSections.length === 0 ? `
          <div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem; background:var(--surface-subtle); border-radius:var(--radius-sm);">
            No assessment sections detected for this class.
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${baseSections.map((sec, idx) => {
              const rule = cfgSections[sec.name] || cfgSections[sec.name.trim()] || {};
              const limitVal = rule.limit !== null && rule.limit !== undefined ? rule.limit : '';
              const chunkVal = rule.chunk_size !== null && rule.chunk_size !== undefined ? rule.chunk_size : '';
              return `
                <div style="padding:0.9rem 1.15rem; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md);">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; margin-bottom:0.65rem;">
                    <div>
                      <span style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted);">Assessment Section ${idx + 1}</span>
                      <div style="font-weight:800; font-size:0.95rem; color:var(--text-main); margin-top:0.1rem;">
                        ${escapeHtml(sec.name)}
                      </div>
                    </div>
                    <span class="badge badge-neutral" style="font-weight:700; font-size:0.75rem;">
                      ${sec.question_count} Questions in Bank
                    </span>
                  </div>

                  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1rem; padding-top:0.65rem; border-top:1px dashed var(--border);">
                    <div>
                      <label style="font-size:0.8rem; font-weight:700; display:block; margin-bottom:0.25rem; color:var(--text-main);">
                        Limit Questions (e.g. 20 of ${sec.question_count}):
                      </label>
                      <input 
                        type="number" 
                        class="form-control input-sec-limit" 
                        data-sec="${escapeHtml(sec.name)}" 
                        min="1" 
                        max="${sec.question_count}" 
                        value="${limitVal}" 
                        placeholder="All ${sec.question_count} questions" 
                        style="font-size:0.85rem; padding:0.35rem 0.6rem;" 
                      />
                      <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:0.2rem;">
                        Delegates will only see and answer the first N questions. Leave blank for all.
                      </span>
                    </div>

                    <div>
                      <label style="font-size:0.8rem; font-weight:700; display:block; margin-bottom:0.25rem; color:var(--text-main);">
                        Break Down Into Parts (e.g. 25 questions per part):
                      </label>
                      <input 
                        type="number" 
                        class="form-control input-sec-chunk" 
                        data-sec="${escapeHtml(sec.name)}" 
                        min="1" 
                        max="${sec.question_count}" 
                        value="${chunkVal}" 
                        placeholder="Do not split (keep as 1 section)" 
                        style="font-size:0.85rem; padding:0.35rem 0.6rem;" 
                      />
                      <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:0.2rem;">
                        Creates Part 1, Part 2, etc. that can be locked and unlocked sequentially.
                      </span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Action & Save Button -->
      <div style="display:flex; align-items:center; gap:0.85rem; flex-wrap:wrap; padding-top:0.5rem; border-top:1px solid var(--border);">
        <button type="button" class="btn btn-primary" id="btn-save-class-assessment-config" style="font-weight:700; font-size:0.875rem; padding:0.45rem 1.15rem;">
          💾 Save Assessment &amp; Section Configuration
        </button>
        <span id="cfg-status-message" style="display:none; font-size:0.85rem; font-weight:700;"></span>
      </div>
    `;

    const saveBtn = configContainer.querySelector('#btn-save-class-assessment-config');
    const statusMsg = configContainer.querySelector('#cfg-status-message');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving configuration...';
        if (statusMsg) statusMsg.style.display = 'none';

        try {
          const passRateInput = configContainer.querySelector('#cfg-pass-rate');
          const passMarkPercentage = passRateInput ? parseInt(passRateInput.value, 10) : 70;

          const sectionsPayload = {};
          configContainer.querySelectorAll('.input-sec-limit').forEach(limitInput => {
            const sName = limitInput.dataset.sec;
            const chunkInput = configContainer.querySelector(`.input-sec-chunk[data-sec="${CSS.escape(sName)}"]`);
            const lim = limitInput.value ? parseInt(limitInput.value, 10) : null;
            const chk = chunkInput && chunkInput.value ? parseInt(chunkInput.value, 10) : null;
            sectionsPayload[sName] = { limit: lim, chunk_size: chk };
          });

          await api.updateClassAssessmentConfig(activeClassId, {
            pass_mark_percentage: passMarkPercentage,
            sections: sectionsPayload
          });

          if (statusMsg) {
            statusMsg.textContent = '✔ Configuration saved successfully!';
            statusMsg.style.color = 'var(--brand-lime)';
            statusMsg.style.display = 'inline-block';
          }
          await loadDashboardData();
        } catch (err) {
          if (statusMsg) {
            statusMsg.textContent = 'Failed to save: ' + (err.message || 'Unknown error');
            statusMsg.style.color = 'var(--danger)';
            statusMsg.style.display = 'inline-block';
          }
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save Assessment & Section Configuration';
        }
      };
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

              <!-- Cohort Section Access Control & Progressive Unlocking -->
              <div style="border-top:1px solid var(--border); padding-top:0.65rem; margin-top:0.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <span class="badge ${sec.is_unlocked ? 'badge-success' : 'badge-warning'}" style="font-size:0.72rem; font-weight:700;">
                    ${sec.is_unlocked ? '&#x1F513; UNLOCKED FOR COHORT' : '&#x1F512; LOCKED FOR COHORT'}
                  </span>
                </div>
                <div>
                  ${activeClassId !== 'all' ? `
                    ${!sec.is_unlocked ? `
                      <button type="button" class="btn btn-primary btn-sm btn-cohort-unlock" data-sec="${escapeHtml(secName)}" style="font-weight:700; font-size:0.75rem; padding:0.25rem 0.65rem;">
                        &#x1F513; Unlock ${escapeHtml(secName)} for Cohort
                      </button>
                    ` : (idx > 0 ? `
                      <button type="button" class="btn btn-secondary btn-sm btn-cohort-relock" data-sec="${escapeHtml(secName)}" style="font-size:0.72rem; padding:0.2rem 0.5rem; color:var(--text-muted);" title="Re-lock this section if needed">
                        &#x1F512; Re-Lock
                      </button>
                    ` : `
                      <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">(Default Unlocked)</span>
                    `)}
                  ` : `
                    <span style="font-size:0.72rem; color:var(--text-muted);">(Select cohort above to manage locks)</span>
                  `}
                </div>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    // Attach unlock / relock event listeners
    sectionsContainer.querySelectorAll('.btn-cohort-unlock').forEach(btn => {
      btn.onclick = async () => {
        const secToUnlock = btn.dataset.sec;
        if (!secToUnlock) return;
        const currentUnlocked = (currentData?.selected_class?.unlocked_sections) || ['Section 1'];
        const nextList = [...new Set([...currentUnlocked, secToUnlock])];
        btn.disabled = true;
        btn.textContent = 'Unlocking...';
        try {
          const res = await api.setUnlockedSections(activeClassId, nextList);
          if (currentData && currentData.selected_class) {
            currentData.selected_class.unlocked_sections = res?.unlocked_sections || nextList;
          }
          await loadDashboardData();
        } catch (err) {
          alert('Failed to unlock section: ' + (err.message || 'Error occurred'));
          btn.disabled = false;
          btn.textContent = `🔓 Unlock ${secToUnlock} for Cohort`;
        }
      };
    });

    sectionsContainer.querySelectorAll('.btn-cohort-relock').forEach(btn => {
      btn.onclick = async () => {
        const secToLock = btn.dataset.sec;
        if (!secToLock) return;
        if (!confirm(`Are you sure you want to lock ${secToLock} for this cohort?`)) return;
        const currentUnlocked = (currentData?.selected_class?.unlocked_sections) || ['Section 1'];
        const nextList = currentUnlocked.filter(s => s !== secToLock);
        btn.disabled = true;
        btn.textContent = 'Locking...';
        try {
          const res = await api.setUnlockedSections(activeClassId, nextList);
          if (currentData && currentData.selected_class) {
            currentData.selected_class.unlocked_sections = res?.unlocked_sections || nextList;
          }
          await loadDashboardData();
        } catch (err) {
          alert('Failed to lock section: ' + (err.message || 'Error occurred'));
          btn.disabled = false;
        }
      };
    });
  }

  function renderStudentRoster() {
    if (!currentData || !currentData.students) return;

    const q = (searchInput.value || '').trim().toLowerCase();
    const statusVal = statusFilter.value;
    const secHelpVal = sectionHelpFilter ? sectionHelpFilter.value : '';

    const filtered = currentData.students.filter(s => {
      const fName = (s.first_name || '').toLowerCase();
      const sName = (s.surname || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const sNum = (s.student_number || '').toLowerCase();
      const uName = (s.username || '').toLowerCase();
      const matchQ = !q || (
        fName.includes(q) ||
        sName.includes(q) ||
        email.includes(q) ||
        sNum.includes(q) ||
        uName.includes(q)
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
        const secUnlockedList = (currentData?.selected_class?.unlocked_sections) || ['Section 1'];
        sectionCellHtml = `
          <div style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:${helpSections.length > 0 ? '0.35rem' : '0'};">
            ${secBreakdown.map(sec => {
              const secTitle = sec.name || sec.section_name || 'Section';
              const isComp = Boolean(sec.is_completed || sec.status === 'Completed' || sec.is_submitted);
              const isInProg = Boolean(sec.is_in_progress || sec.status === 'In Progress');
              const isLocked = !secUnlockedList.includes(secTitle);
              const attHistory = Array.isArray(sec.attempt_history) ? sec.attempt_history : [];
              const historyTitle = attHistory.length > 0
                ? attHistory.map(a => `Attempt #${a.attempt_number}: ${a.correct_count}/${a.total_questions} (${a.percentage}%)`).join(' | ')
                : `${secTitle}: ${sec.correct_count ?? 0}/${sec.total_questions ?? 0} correct`;

              if (!isComp && !isInProg && (sec.answered_count === 0 || sec.status === 'Not Started' || sec.status === 'Pending')) {
                if (isLocked) {
                  return `<span class="badge badge-neutral" style="font-size:0.7rem; opacity:0.8;" title="${escapeHtml(secTitle)}: Locked for cohort">&#x1F512; ${escapeHtml(secTitle)}: Locked</span>`;
                }
                return `<span class="badge badge-neutral" style="font-size:0.7rem;" title="${escapeHtml(secTitle)}: Ready to start">&#x23F3; ${escapeHtml(secTitle)}: Ready</span>`;
              }
              if (isInProg) {
                return `<span class="badge badge-warning" style="font-size:0.7rem;" title="Currently working on ${escapeHtml(secTitle)}">&#x23F3; ${escapeHtml(secTitle)}: ${sec.answered_count}/${sec.total_questions} (${sec.percentage ?? 0}%)</span>`;
              }
              const pctText = (sec.best_percentage !== null && sec.best_percentage !== undefined && sec.best_percentage !== sec.percentage)
                ? `${sec.percentage}% (Best: ${sec.best_percentage}%)`
                : `${sec.percentage ?? 0}% (${sec.correct_count ?? 0}/${sec.total_questions ?? 0})`;
              return `
                <span class="badge ${sec.needs_help ? 'badge-danger' : 'badge-success'}" style="font-size:0.7rem;" title="${escapeHtml(historyTitle)}">
                  ${escapeHtml(secTitle)}: ${pctText} ${sec.needs_help ? '&#x26A0;&#xFE0F;' : '&#x2713; (Submitted)'}
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
                <div style="font-weight:700; color:var(--text-main);">
                  ${escapeHtml(s.first_name)} ${escapeHtml(s.surname)}
                  ${currentData?.selected_class?.id === 'all' && s.class_name ? `<span class="badge badge-neutral" style="font-size:0.68rem; margin-left:0.35rem; font-weight:600;">${escapeHtml(s.class_name)}</span>` : ''}
                </div>
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

  function resolveOptionText(idOrVal, opts) {
    if (idOrVal === null || idOrVal === undefined) return '';
    const key = String(idOrVal);
    if (!opts) return key;

    let parsed = opts;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (_) {}
    }

    if (Array.isArray(parsed)) {
      const found = parsed.find(o => (typeof o === 'object' && o !== null ? (String(o.id) === key || String(o.value) === key) : String(o) === key));
      if (found && typeof found === 'object') return found.text || found.label || key;
    } else if (typeof parsed === 'object' && parsed !== null) {
      const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
      const targets = Array.isArray(parsed.targets) ? parsed.targets : [];
      for (const item of [...sources, ...targets]) {
        if (item && (String(item.id) === key || String(item.value) === key)) {
          return item.text || item.label || key;
        }
      }
    }
    return key;
  }

  function formatAnswerText(val, opts) {
    if (val === null || val === undefined || val === '') return 'None';
    if (typeof val === 'object') {
      if (Array.isArray(val)) {
        return val.map(item => {
          if (typeof item === 'object' && item !== null) {
            const left = item.left || item.target || item.source;
            const right = item.right || item.source || item.target;
            return `${resolveOptionText(left, opts)} → ${resolveOptionText(right, opts)}`;
          }
          return resolveOptionText(item, opts);
        }).join(', ');
      }
      return Object.entries(val).map(([k, v]) => `${resolveOptionText(k, opts)} → ${resolveOptionText(v, opts)}`).join(' | ');
    }
    return resolveOptionText(val, opts);
  }

  function renderQuestionChoices(q) {
    const type = q.question_type || 'single_choice';
    let opts = q.answer_options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch (_) {}
    }
    let correct = q.correct_answer;
    if (typeof correct === 'string') {
      try { correct = JSON.parse(correct); } catch (_) {}
    }

    function isOptCorrect(optVal) {
      if (correct === null || correct === undefined) return false;
      const strOpt = String(optVal).trim().toLowerCase();
      if (Array.isArray(correct)) {
        return correct.some(c => String(c).trim().toLowerCase() === strOpt);
      }
      if (typeof correct === 'object' && correct !== null) {
        return Object.values(correct).some(c => String(c).trim().toLowerCase() === strOpt);
      }
      return String(correct).trim().toLowerCase() === strOpt;
    }

    if (type === 'yes_no' || type === 'true_false') {
      const list = type === 'yes_no' ? ['Yes', 'No'] : ['True', 'False'];
      return `
        <div style="display:flex; gap:0.65rem; flex-wrap:wrap; margin-top:0.5rem;">
          ${list.map(val => {
            const isCorrect = isOptCorrect(val);
            return `
              <div style="padding:0.6rem 1rem; border-radius:var(--radius-md); border:2px solid ${isCorrect ? 'var(--brand-lime)' : 'var(--border)'}; background:${isCorrect ? 'rgba(34,197,94,0.12)' : 'var(--surface)'}; display:flex; align-items:center; gap:0.5rem;">
                <strong style="color:var(--text-main); font-size:0.95rem;">${escapeHtml(val)}</strong>
                ${isCorrect ? '<span class="badge badge-success" style="font-size:0.7rem; font-weight:800;">✔ CORRECT</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    if (type === 'single_choice' || type === 'multiple_choice' || type === 'scenario' || type === 'case_study') {
      const list = Array.isArray(opts) ? opts : [];
      return `
        <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
          ${list.map((opt, i) => {
            const optId = typeof opt === 'object' && opt !== null ? (opt.id || opt.value || `opt_${i}`) : opt;
            const optText = typeof opt === 'object' && opt !== null ? (opt.text || opt.label || opt.id || '') : opt;
            const isCorrect = isOptCorrect(optId) || isOptCorrect(optText);
            const letter = String.fromCharCode(65 + i);
            return `
              <div style="padding:0.65rem 0.85rem; border-radius:var(--radius-md); border:2px solid ${isCorrect ? 'var(--brand-lime)' : 'var(--border)'}; background:${isCorrect ? 'rgba(34,197,94,0.12)' : 'var(--surface)'}; display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
                <div style="display:flex; align-items:flex-start; gap:0.6rem;">
                  <span style="display:inline-flex; width:24px; height:24px; border-radius:50%; background:${isCorrect ? 'var(--brand-lime)' : 'var(--surface-subtle)'}; color:${isCorrect ? '#000' : 'var(--text-main)'}; font-weight:800; font-size:0.75rem; align-items:center; justify-content:center; flex-shrink:0;">
                    ${letter}
                  </span>
                  <span style="font-size:0.9rem; color:var(--text-main); line-height:1.4;">${escapeHtml(String(optText))}</span>
                </div>
                ${isCorrect ? '<span class="badge badge-success" style="font-size:0.72rem; font-weight:800; flex-shrink:0;">✔ CORRECT ANSWER</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    if (type === 'fill_blank') {
      return `
        <div style="margin-top:0.5rem; padding:0.75rem 1rem; border-radius:var(--radius-md); background:rgba(34,197,94,0.1); border:1px solid var(--brand-lime);">
          <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Expected Fill-In-The-Blank Answer:</span>
          <div style="font-family:monospace; font-weight:700; font-size:1.05rem; color:var(--text-main); margin-top:0.25rem;">
            ${escapeHtml(formatAnswerText(correct, opts))}
          </div>
        </div>
      `;
    }

    if (type === 'ordering_sequence') {
      const list = Array.isArray(correct) ? correct : (Array.isArray(opts) ? opts : []);
      return `
        <div style="margin-top:0.5rem; display:flex; flex-direction:column; gap:0.4rem;">
          <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Correct Sequential Order:</span>
          ${list.map((item, idx) => {
            let text = typeof item === 'object' && item !== null ? (item.text || item.label || item.id) : item;
            if (Array.isArray(opts)) {
              const matchOpt = opts.find(o => (typeof o === 'object' ? (o.id === item || o.value === item) : o === item));
              if (matchOpt && typeof matchOpt === 'object') text = matchOpt.text || matchOpt.label || text;
            }
            return `
              <div style="padding:0.5rem 0.75rem; border-radius:var(--radius-sm); border:1px solid var(--brand-lime); background:rgba(34,197,94,0.08); display:flex; align-items:center; gap:0.6rem;">
                <span class="badge badge-primary" style="font-size:0.72rem; font-weight:800;">Step ${idx + 1}</span>
                <span style="font-size:0.875rem; color:var(--text-main);">${escapeHtml(String(text))}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Matching pairs / drag drop / hotspot / dropdown
    return `
      <div style="margin-top:0.5rem; display:flex; flex-direction:column; gap:0.4rem;">
        <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Answer Key &amp; Matches:</span>
        <div style="font-family:monospace; font-size:0.875rem; padding:0.6rem 0.85rem; border-radius:var(--radius-sm); background:rgba(34,197,94,0.08); border:1px solid var(--brand-lime); color:var(--text-main); white-space:pre-wrap;">
          ${escapeHtml(formatAnswerText(correct, opts))}
        </div>
      </div>
    `;
  }

  function renderQuestionAnalytics() {
    if (!currentData || !currentData.questions_analysis) return;
    const questions = currentData.questions_analysis;
    const weakCountBadge = container.querySelector('#badge-weak-count');
    const qSearchFilter = container.querySelector('#q-search-filter');
    const qSectionFilter = container.querySelector('#q-section-filter');
    const qStatusFilter = container.querySelector('#q-status-filter');
    const qCountBadge = container.querySelector('#q-count-badge');
    const toggleAllBtn = container.querySelector('#btn-toggle-all-questions');

    if (questions.length === 0) {
      questionsContainer.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--text-muted);">
          No questions found for the assigned assessment or class.
        </div>
      `;
      if (weakCountBadge) weakCountBadge.style.display = 'none';
      if (qCountBadge) qCountBadge.textContent = '0 Questions';
      return;
    }

    const weakQuestions = questions.filter(q => q.needs_review);
    if (weakCountBadge) {
      if (weakQuestions.length > 0) {
        weakCountBadge.textContent = `${weakQuestions.length} Questions Need In-Class Review`;
        weakCountBadge.style.display = 'inline-block';
      } else {
        weakCountBadge.style.display = 'none';
      }
    }

    // Populate section filter options if not already done
    if (qSectionFilter && qSectionFilter.options.length <= 1) {
      const distinctSections = [...new Set(questions.map(q => q.section_name).filter(Boolean))];
      qSectionFilter.innerHTML = '<option value="">All Sections</option>' +
        distinctSections.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    }

    function updateQuestionList() {
      const searchVal = (qSearchFilter?.value || '').trim().toLowerCase();
      const secVal = qSectionFilter?.value || '';
      const statusVal = qStatusFilter?.value || '';

      const filtered = questions.filter(q => {
        const textMatch = !searchVal ||
          (q.question_text || '').toLowerCase().includes(searchVal) ||
          (q.topic || '').toLowerCase().includes(searchVal) ||
          (q.section_name || '').toLowerCase().includes(searchVal);

        const secMatch = !secVal || q.section_name === secVal;

        let statusMatch = true;
        if (statusVal === 'weak') {
          statusMatch = Boolean(q.needs_review);
        } else if (statusVal === 'mastery') {
          statusMatch = Boolean(q.is_attempted && !q.needs_review);
        } else if (statusVal === 'unattempted') {
          statusMatch = !q.is_attempted;
        }

        return textMatch && secMatch && statusMatch;
      });

      if (qCountBadge) {
        qCountBadge.textContent = `Showing ${filtered.length} of ${questions.length} Questions`;
      }

      if (filtered.length === 0) {
        questionsContainer.innerHTML = `
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">
            No questions match the current filter.
          </div>
        `;
        return;
      }

      questionsContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.85rem;">
          ${filtered.map((q, idx) => {
            const qNum = q.question_number || (idx + 1);
            const isWeak = q.needs_review;
            const isAttempted = q.is_attempted;
            const pct = isAttempted && q.success_percentage !== null ? q.success_percentage : null;
            const cardBorder = isWeak ? 'rgba(220,38,38,0.45)' : (isAttempted ? 'var(--border)' : 'var(--border)');
            const accentBorder = isWeak ? 'var(--danger)' : (isAttempted ? 'var(--brand-lime)' : 'var(--border)');

            return `
              <div class="card q-card-item" data-qid="${escapeHtml(q.id)}" style="border:1px solid ${cardBorder}; border-left:5px solid ${accentBorder}; padding:0; overflow:hidden; transition:border-color 0.15s ease;">
                <!-- Clickable Question Card Header -->
                <div class="q-card-header" data-qid="${escapeHtml(q.id)}" style="padding:0.9rem 1.15rem; cursor:pointer; background:${isWeak ? 'rgba(220,38,38,0.03)' : 'var(--surface)'}; display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; user-select:none;">
                  <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:0.45rem; margin-bottom:0.35rem; flex-wrap:wrap;">
                      <span class="badge" style="font-size:0.75rem; font-weight:800; background:var(--brand-lime, #62b017); color:#000;">
                        Question ${qNum}
                      </span>
                      ${isWeak ? `
                        <span class="badge badge-danger" style="font-size:0.7rem; font-weight:800;">
                          ⚠️ WEAK SPOT (${pct}%)
                        </span>
                      ` : (isAttempted ? `
                        <span class="badge badge-success" style="font-size:0.7rem; font-weight:800;">
                          ✔ GOOD MASTERY (${pct}%)
                        </span>
                      ` : `
                        <span class="badge badge-neutral" style="font-size:0.7rem;">
                          ⏳ NOT YET ATTEMPTED
                        </span>
                      `)}
                      <span class="badge badge-secondary" style="font-size:0.7rem;">📁 ${escapeHtml(q.section_name || 'Section 1')}</span>
                      <span class="badge badge-neutral" style="font-size:0.7rem;">🏷️ ${escapeHtml(q.topic || 'General')}</span>
                      <span class="badge badge-neutral" style="font-size:0.7rem; text-transform:capitalize;">${escapeHtml(q.difficulty || 'medium')}</span>
                      <span class="badge badge-neutral" style="font-size:0.7rem;">${q.points || 1} pt(s)</span>
                    </div>
                    <div style="font-weight:700; font-size:0.95rem; color:var(--text-main); line-height:1.45;">
                      <span style="color:var(--brand-lime, #62b017); font-weight:800; margin-right:0.35rem;">Q${qNum}.</span>${escapeHtml(q.question_text)}
                    </div>
                  </div>

                  <div style="text-align:right; min-width:130px; display:flex; flex-direction:column; align-items:flex-end; gap:0.35rem;">
                    <div style="font-size:1.35rem; font-weight:900; font-family:var(--font-heading); color:${!isAttempted ? 'var(--text-muted)' : (isWeak ? 'var(--danger)' : 'var(--brand-lime)')};">
                      ${pct !== null ? `${pct}%` : '-'}
                    </div>
                    <div style="font-size:0.72rem; color:var(--text-muted);">
                      ${isAttempted ? `${q.correct_answers} / ${q.total_answers} correct` : '0 attempts recorded'}
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm btn-toggle-q-details" data-qid="${escapeHtml(q.id)}" style="font-size:0.72rem; font-weight:700; padding:0.2rem 0.55rem; margin-top:0.25rem;">
                      👁 View Answers ▼
                    </button>
                  </div>
                </div>

                <!-- Accuracy Progress Bar -->
                <div style="height:4px; background:var(--surface-subtle); width:100%;">
                  <div style="height:100%; width:${pct !== null ? pct : 0}%; background:${isWeak ? 'var(--danger)' : 'var(--brand-lime)'};"></div>
                </div>

                <!-- Expandable Question Details Drawer -->
                <div id="q-details-${escapeHtml(q.id)}" class="q-details-drawer" style="display:none; padding:1.15rem; background:var(--surface-subtle); border-top:1px dashed var(--border);">
                  
                  <!-- Scenario / Reference Material if Present -->
                  ${q.question_description ? `
                    <div style="margin-bottom:1rem; padding:0.85rem 1rem; border-radius:var(--radius-md); background:var(--surface); border:1px solid var(--border); border-left:4px solid var(--primary);">
                      <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.3rem;">
                        📋 Scenario &amp; Reference Material
                      </div>
                      <div style="font-size:0.875rem; color:var(--text-main); white-space:pre-wrap; line-height:1.45;">${escapeHtml(q.question_description)}</div>
                    </div>
                  ` : ''}

                  <!-- Question Text Full Prompt -->
                  <div style="margin-bottom:1rem;">
                    <span style="font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted);">
                      Question ${qNum} Prompt:
                    </span>
                    <div style="font-size:1.05rem; font-weight:800; color:var(--text-main); margin-top:0.25rem; line-height:1.45;">
                      <span style="color:var(--brand-lime, #62b017); font-weight:800; margin-right:0.35rem;">Q${qNum}.</span>${escapeHtml(q.question_text)}
                    </div>
                  </div>

                  <!-- Choices & Options Delegates Could Choose -->
                  <div style="margin-bottom:1.15rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                      <span style="font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted);">
                        Answer Options &amp; Correct Answer Key:
                      </span>
                      <span class="badge badge-neutral" style="font-size:0.7rem;">${escapeHtml(q.question_type.toUpperCase().replace(/_/g, ' '))}</span>
                    </div>
                    ${renderQuestionChoices(q)}
                  </div>

                  <!-- Official Correct Answer Summary Box -->
                  <div style="margin-bottom:1rem; padding:0.75rem 1rem; border-radius:var(--radius-md); background:rgba(34,197,94,0.1); border:1px solid var(--brand-lime);">
                    <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.25rem;">
                      <span style="color:var(--brand-lime); font-size:1rem;">✔</span>
                      <strong style="font-size:0.85rem; color:var(--text-main);">Official Correct Answer:</strong>
                    </div>
                    <div style="font-family:monospace; font-size:0.9rem; font-weight:700; color:var(--text-main);">
                      ${escapeHtml(formatAnswerText(q.correct_answer, q.answer_options))}
                    </div>
                  </div>

                  <!-- Explanation & Discussion Notes -->
                  ${q.answer_explanation ? `
                    <div style="margin-bottom:1rem; padding:0.85rem 1rem; border-radius:var(--radius-md); background:var(--surface); border:1px solid var(--border); border-left:4px solid var(--brand-lime);">
                      <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.35rem;">
                        💡 Pedagogical Explanation &amp; Discussion Notes for Class
                      </div>
                      <div style="font-size:0.875rem; color:var(--text-main); line-height:1.5; white-space:pre-wrap;">${escapeHtml(q.answer_explanation)}</div>
                    </div>
                  ` : ''}

                  <!-- Cohort Performance Stats Bar -->
                  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding-top:0.75rem; border-top:1px dashed var(--border); font-size:0.78rem; color:var(--text-muted);">
                    <div>
                      Cohort Accuracy: <strong style="color:var(--text-main);">${pct !== null ? `${pct}%` : 'No attempts'}</strong>
                      ${isAttempted ? ` (${q.correct_answers} correct, ${q.incorrect_answers} incorrect out of ${q.total_answers} answers)` : ''}
                    </div>
                    <div>
                      Section: <strong style="color:var(--text-main);">${escapeHtml(q.section_name)}</strong>
                    </div>
                  </div>

                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Attach click handlers to headers and toggle buttons
      questionsContainer.querySelectorAll('.q-card-header, .btn-toggle-q-details').forEach(el => {
        el.onclick = (e) => {
          e.stopPropagation();
          const qid = el.dataset.qid;
          if (!qid) return;
          const drawer = questionsContainer.querySelector(`#q-details-${CSS.escape(qid)}`);
          const btn = questionsContainer.querySelector(`.btn-toggle-q-details[data-qid="${CSS.escape(qid)}"]`);
          if (!drawer) return;
          const isCurrentlyHidden = drawer.style.display === 'none' || !drawer.style.display;
          drawer.style.display = isCurrentlyHidden ? 'block' : 'none';
          if (btn) {
            btn.textContent = isCurrentlyHidden ? '▲ Close Details' : '👁 View Answers ▼';
          }
        };
      });
    }

    if (qSearchFilter) qSearchFilter.oninput = updateQuestionList;
    if (qSectionFilter) qSectionFilter.onchange = updateQuestionList;
    if (qStatusFilter) qStatusFilter.onchange = updateQuestionList;

    if (toggleAllBtn) {
      toggleAllBtn.onclick = () => {
        const allDrawers = questionsContainer.querySelectorAll('.q-details-drawer');
        const anyHidden = Array.from(allDrawers).some(d => d.style.display === 'none' || !d.style.display);
        allDrawers.forEach(d => {
          d.style.display = anyHidden ? 'block' : 'none';
        });
        questionsContainer.querySelectorAll('.btn-toggle-q-details').forEach(btn => {
          btn.textContent = anyHidden ? '▲ Close Details' : '👁 View Answers ▼';
        });
        toggleAllBtn.textContent = anyHidden ? 'Collapse All Details' : 'Expand All Details';
      };
    }

    updateQuestionList();
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
