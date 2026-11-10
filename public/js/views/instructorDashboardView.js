// Instructor Dashboard & Class Progress Tracking View

import { api, authState } from '../api.js';

let savedSelectedClassId = null;

export function renderInstructorDashboard(container, router, options = {}) {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const requestedClassId = urlParams.get('class_id') || savedSelectedClassId || null;
  const requestedInstructorId = urlParams.get('instructor_id') || null;
  const currentHashPath = window.location.hash.split('?')[0].replace('#', '');
  const activeTab = (options && options.activeTab) || (currentHashPath === 'instructor-questions' ? 'questions' : 'overview');

  let isConfigCollapsed = sessionStorage.getItem('eduqe_inst_cfg_collapsed') !== 'false';

  if (activeTab === 'questions') {
    // TAB 2: Class Questions & Topics Weak-Spot Analysis
    container.innerHTML = `
      <div class="eduqe-hero-banner" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <div class="eduqe-kicker">&#x1F4A1; INSTRUCTOR-LED TRAINING &bull; TOPIC &amp; QUESTION ANALYSIS</div>
          <h1 style="font-size:1.8rem; font-weight:900; font-family:var(--font-heading); margin-bottom:0.25rem;">Class Questions &amp; Weak-Spot Analysis</h1>
          <p class="form-hint" style="margin-bottom:0; font-size:0.9rem;">
            Deep-dive analysis of student accuracy across all questions, identifying weak spots for in-class review, with answer keys and pedagogical explanations.
          </p>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <span class="badge" style="background:rgba(34,197,94,0.12); color:var(--brand-lime); border:1px solid var(--brand-lime); font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem; padding:0.35rem 0.65rem;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--brand-lime);"></span>
            Live Auto-Refresh (15s)
          </span>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh-instructor-dash">
            &#x21BB; Refresh Live Stats
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

      <!-- Question Overview Stats Grid -->
      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card">
          <span class="stat-label">Total Questions</span>
          <span class="stat-value" id="stat-q-total">-</span>
          <span class="stat-subtext" id="subtext-q-total">Configured for assessment</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Weak Spots (&lt; 60% Accuracy)</span>
          <span class="stat-value" id="stat-q-weak" style="color:var(--danger);">-</span>
          <span class="stat-subtext">Needs in-class review</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">High Mastery (&ge; 60% Accuracy)</span>
          <span class="stat-value" id="stat-q-mastery" style="color:var(--brand-lime);">-</span>
          <span class="stat-subtext">Well understood by cohort</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Questions Attempted</span>
          <span class="stat-value" id="stat-q-attempted">-</span>
          <span class="stat-subtext" id="subtext-q-attempted">Answered by students</span>
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
    `;
  } else {
    // TAB 1: Cohort Progress & Stats
    container.innerHTML = `
      <div class="eduqe-hero-banner" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <div class="eduqe-kicker">&#x1F468;&#x200D;&#x1F3EB; INSTRUCTOR-LED TRAINING &bull; COHORT ANALYTICS</div>
          <h1 style="font-size:1.8rem; font-weight:900; font-family:var(--font-heading); margin-bottom:0.25rem;">Instructor Portal</h1>
          <p class="form-hint" style="margin-bottom:0; font-size:0.9rem;">
            Monitor cohort exam readiness, track student progress, and configure assessment sections.
          </p>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
          <span class="badge" style="background:rgba(34,197,94,0.12); color:var(--brand-lime); border:1px solid var(--brand-lime); font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem; padding:0.35rem 0.65rem;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--brand-lime);"></span>
            Live Auto-Refresh (15s)
          </span>
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

      <!-- Main Content Grid -->
      <div style="display:grid; grid-template-columns:1fr; gap:1.5rem;">

        <!-- Assessment Pass Rate & Section Question Breakdown Controls (Minimizable) -->
        <div class="card" id="assessment-config-card" style="padding:0; overflow:hidden; margin-bottom:0;">
          <div id="assessment-config-container">
            <div style="text-align:center; padding:1.25rem; color:var(--text-muted);">
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

      </div>
    `;
  }

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

  async function loadDashboardData(isSilent = false) {
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

      if (classSelect) {
        classSelect.innerHTML = allOptionHtml + res.assigned_classes.map(c => `
          <option value="${c.id}" ${c.id === res.selected_class.id ? 'selected' : ''}>
            ${escapeHtml(c.name)} • ${escapeHtml(c.course_name || 'Course')} (${c.student_count || 0} learner${c.student_count === 1 ? '' : 's'}${c.active_code ? ` • Code: ${escapeHtml(c.active_code)}` : ''})
          </option>
        `).join('');
      }

      activeClassId = res.selected_class.id;
      savedSelectedClassId = activeClassId;

      // Class Metadata Pills
      if (metadataPills) {
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
      }

      if (activeTab === 'overview') {
        // Render Summary Metrics
        const sum = res.summary;
        const setEl = (sel, val) => { const el = container.querySelector(sel); if (el) el.textContent = val; };
        setEl('#stat-class-enrolled', sum.total_enrolled);
        setEl('#stat-class-participation', `${sum.completion_rate}% (${sum.students_attempted}/${sum.total_enrolled})`);
        setEl('#stat-class-avg', `${sum.avg_score}%`);
        setEl('#subtext-range', `High: ${sum.highest_score}% • Low: ${sum.lowest_score}%`);
        setEl('#stat-class-pass-rate', `${sum.pass_rate}%`);
        setEl('#subtext-pass-count', `${sum.students_passed} of ${sum.students_attempted} passed`);

        // Progress bar distribution
        const total = sum.total_enrolled || 1;
        const passedPct = Math.round((sum.students_passed / total) * 100);
        const failedCount = Math.max(0, sum.students_attempted - sum.students_passed);
        const failedPct = Math.round((failedCount / total) * 100);
        const unattemptedCount = Math.max(0, sum.total_enrolled - sum.students_attempted);
        const unattemptedPct = Math.max(0, 100 - passedPct - failedPct);

        const barP = container.querySelector('#bar-passed'); if (barP) barP.style.width = `${passedPct}%`;
        const barF = container.querySelector('#bar-failed'); if (barF) barF.style.width = `${failedPct}%`;
        const barU = container.querySelector('#bar-unattempted'); if (barU) barU.style.width = `${unattemptedPct}%`;

        setEl('#label-completion-status', `${sum.students_attempted} of ${sum.total_enrolled} students have taken assessments`);
        setEl('#legend-passed', `${sum.students_passed} (${passedPct}%)`);
        setEl('#legend-failed', `${failedCount} (${failedPct}%)`);
        setEl('#legend-not-started', `${unattemptedCount} (${unattemptedPct}%)`);

        // Populate section filter options
        const sectionsList = res.sections_analysis || [];
        if (sectionHelpFilter) {
          const prevSecVal = sectionHelpFilter.value;
          sectionHelpFilter.innerHTML = `<option value="">All Sections (Filter Help)</option>` +
            sectionsList.map(sec => `<option value="${escapeHtml(sec.name)}" ${sec.name === prevSecVal ? 'selected' : ''}>Needs Help: ${escapeHtml(sec.name)}</option>`).join('');
        }

        renderAssessmentConfig(isSilent);
        renderSectionAnalytics();
        renderStudentRoster();
      } else if (activeTab === 'questions') {
        const questions = res.questions_analysis || [];
        const weakCount = questions.filter(q => q.needs_review).length;
        const masteryCount = questions.filter(q => q.is_attempted && !q.needs_review).length;
        const attemptedCount = questions.filter(q => q.is_attempted).length;

        const setEl = (sel, val) => { const el = container.querySelector(sel); if (el) el.textContent = val; };
        setEl('#stat-q-total', questions.length);
        setEl('#stat-q-weak', weakCount);
        setEl('#stat-q-mastery', masteryCount);
        setEl('#stat-q-attempted', `${attemptedCount} / ${questions.length}`);

        renderQuestionAnalytics();
      }

    } catch (err) {
      if (studentsTbody) {
        studentsTbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger); text-align:center; padding:2rem;">Failed to load instructor dashboard: ${escapeHtml(err.message)}</td></tr>`;
      } else if (questionsContainer) {
        questionsContainer.innerHTML = `<div style="color:var(--danger); text-align:center; padding:2rem;">Failed to load questions analysis: ${escapeHtml(err.message)}</div>`;
      }
    }
  }

  function renderAssessmentConfig(isSilent = false) {
    const configContainer = container.querySelector('#assessment-config-container');
    if (!configContainer) return;
    if (isSilent && configContainer.contains(document.activeElement)) {
      // Don't overwrite if instructor is actively editing inputs
      return;
    }

    if (!currentData || !currentData.selected_class || currentData.selected_class.id === 'all') {
      configContainer.innerHTML = `
        <div style="padding:1.15rem 1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-size:1.25rem;">⚙️</span>
            <div>
              <h2 style="font-size:1.05rem; font-weight:700; margin-bottom:0;">Assessment Pass Rate &amp; Section Question Breakdown</h2>
              <p class="form-hint" style="margin-top:0.15rem; margin-bottom:0; font-size:0.8rem;">
                Customize the passing threshold and divide assessment sections into smaller sequential parts.
              </p>
            </div>
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted); font-style:italic; background:var(--surface-subtle); padding:0.35rem 0.65rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
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
      <!-- Minimizable Header Bar -->
      <div id="cfg-card-header" style="padding:0.95rem 1.25rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer; background:var(--surface); user-select:none; border-bottom:${isConfigCollapsed ? 'none' : '1px solid var(--border)'}; transition:background 0.15s ease;">
        <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
          <span style="font-size:1.35rem;">⚙️</span>
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <h2 style="font-size:1.05rem; font-weight:800; margin-bottom:0; font-family:var(--font-heading); color:var(--text-main);">
                Assessment Pass Rate &amp; Section Question Breakdown: <span style="color:var(--brand-lime);">${escapeHtml(cls.name)}</span>
              </h2>
              <span class="badge ${isConfigCollapsed ? 'badge-primary' : 'badge-neutral'}" style="font-size:0.72rem; font-weight:700;">
                🎯 Pass Mark: ${passMark}%
              </span>
              <span class="badge badge-neutral" style="font-size:0.72rem;">
                ✂️ ${baseSections.length} Section${baseSections.length === 1 ? '' : 's'} Configured
              </span>
            </div>
            <p class="form-hint" style="margin-top:0.2rem; margin-bottom:0; font-size:0.8rem;">
              ${isConfigCollapsed ? 'Settings minimized to save space. Click here or use the button to expand and customize pass percentage, question limits, or timers.' : 'Set the required pass percentage for this cohort and customize how many questions delegates answer or break sections into smaller sequential parts.'}
            </p>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-toggle-cfg-collapse" style="font-size:0.75rem; font-weight:700; padding:0.35rem 0.75rem;">
            ${isConfigCollapsed ? '➕ Expand Settings' : '▲ Minimize Settings'}
          </button>
        </div>
      </div>

      <!-- Collapsible Body Content -->
      <div id="cfg-body-wrapper" style="display:${isConfigCollapsed ? 'none' : 'block'}; padding:1.25rem; background:var(--surface);">
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
                const timerVal = rule.time_limit_minutes !== null && rule.time_limit_minutes !== undefined ? rule.time_limit_minutes : '';
                return `
                  <div style="padding:0.9rem 1.15rem; background:var(--surface-subtle); border:1px solid var(--border); border-radius:var(--radius-md);">
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

                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:1rem; padding-top:0.65rem; border-top:1px dashed var(--border);">
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
                          Delegates answer first N questions only. Leave blank for all.
                        </span>
                      </div>

                      <div>
                        <label style="font-size:0.8rem; font-weight:700; display:block; margin-bottom:0.25rem; color:var(--text-main);">
                          Break Down Into Parts (e.g. 25 per part):
                        </label>
                        <input 
                          type="number" 
                          class="form-control input-sec-chunk" 
                          data-sec="${escapeHtml(sec.name)}" 
                          min="1" 
                          max="${sec.question_count}" 
                          value="${chunkVal}" 
                          placeholder="Keep as 1 section" 
                          style="font-size:0.85rem; padding:0.35rem 0.6rem;" 
                        />
                        <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:0.2rem;">
                          Splits section into sequential unlockable parts.
                        </span>
                      </div>

                      <div>
                        <label style="font-size:0.8rem; font-weight:700; display:block; margin-bottom:0.25rem; color:var(--text-main);">
                          ⏳ Section Timer (Minutes):
                        </label>
                        <input 
                          type="number" 
                          class="form-control input-sec-timer" 
                          data-sec="${escapeHtml(sec.name)}" 
                          min="1" 
                          max="300" 
                          value="${timerVal}" 
                          placeholder="Exam default" 
                          style="font-size:0.85rem; padding:0.35rem 0.6rem;" 
                        />
                        <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:0.2rem;">
                          Separate timer for this section. Blank for default.
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
        <div style="display:flex; align-items:center; justify-content:space-between; gap:0.85rem; flex-wrap:wrap; padding-top:0.75rem; border-top:1px solid var(--border);">
          <div style="display:flex; align-items:center; gap:0.85rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="btn-save-class-assessment-config" style="font-weight:700; font-size:0.875rem; padding:0.45rem 1.15rem;">
              💾 Save Assessment &amp; Section Configuration
            </button>
            <span id="cfg-status-message" style="display:none; font-size:0.85rem; font-weight:700;"></span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-footer-cfg-collapse" style="font-size:0.75rem; font-weight:700;">
            ▲ Minimize Settings
          </button>
        </div>
      </div>
    `;

    function toggleCollapse(e) {
      if (e) e.stopPropagation();
      isConfigCollapsed = !isConfigCollapsed;
      sessionStorage.setItem('eduqe_inst_cfg_collapsed', isConfigCollapsed ? 'true' : 'false');
      renderAssessmentConfig();
    }

    const headerBar = configContainer.querySelector('#cfg-card-header');
    if (headerBar) {
      headerBar.onclick = toggleCollapse;
    }
    const collapseBtn = configContainer.querySelector('#btn-toggle-cfg-collapse');
    if (collapseBtn) {
      collapseBtn.onclick = toggleCollapse;
    }
    const footerCollapseBtn = configContainer.querySelector('#btn-footer-cfg-collapse');
    if (footerCollapseBtn) {
      footerCollapseBtn.onclick = toggleCollapse;
    }

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
            const timerInput = configContainer.querySelector(`.input-sec-timer[data-sec="${CSS.escape(sName)}"]`);
            const lim = limitInput.value ? parseInt(limitInput.value, 10) : null;
            const chk = chunkInput && chunkInput.value ? parseInt(chunkInput.value, 10) : null;
            const timer = timerInput && timerInput.value ? parseInt(timerInput.value, 10) : null;
            sectionsPayload[sName] = { limit: lim, chunk_size: chk, time_limit_minutes: timer };
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
          const avgPct = (sec.avg_percentage !== null && sec.avg_percentage !== undefined)
            ? sec.avg_percentage
            : ((sec.avg_score !== null && sec.avg_score !== undefined) ? sec.avg_score : 0);
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
    if (!studentsTbody || !currentData) return;
    const students = currentData.students || [];
    const searchVal = (searchInput?.value || '').trim().toLowerCase();
    const sectionVal = sectionHelpFilter?.value || '';
    const statusVal = statusFilter?.value || '';

    const filtered = students.filter(s => {
      const nameMatch = !searchVal || 
        `${s.first_name} ${s.surname}`.toLowerCase().includes(searchVal) ||
        (s.student_number || '').toLowerCase().includes(searchVal) ||
        (s.email || '').toLowerCase().includes(searchVal);

      const sectionMatch = !sectionVal || (Array.isArray(s.sections_needing_help) && s.sections_needing_help.includes(sectionVal));

      const statusMatch = !statusVal || s.status_label === statusVal;

      return nameMatch && sectionMatch && statusMatch;
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
      } else if (s.status_label === 'In Progress') {
        statusBadge = '<span class="badge badge-warning">&#x23F3; IN PROGRESS</span>';
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
            ${formatLocalDate(s.latest_attempt_at)}
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
      const found = parsed.find(o => (typeof o === 'object' && o !== null ? (String(o.id) === key || String(o.value) === key || String(o.statement) === key) : String(o) === key));
      if (found && typeof found === 'object') return found.statement || found.text || found.label || found.prompt || key;
      const stmtMatch = key.match(/^stmt_(\d+)$/i);
      if (stmtMatch) {
        const sIndex = parseInt(stmtMatch[1], 10) - 1;
        if (parsed[sIndex]) {
          const item = parsed[sIndex];
          if (typeof item === 'object' && item !== null) {
            return `Statement ${sIndex + 1}`;
          }
          return `Statement ${sIndex + 1}`;
        }
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
      const targets = Array.isArray(parsed.targets) ? parsed.targets : [];
      for (const item of [...sources, ...targets]) {
        if (item && (String(item.id) === key || String(item.value) === key)) {
          return item.text || item.label || item.statement || key;
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
      return Object.entries(val).map(([k, v]) => {
        const cleanK = resolveOptionText(k, opts);
        const cleanV = resolveOptionText(v, opts);
        return `${cleanK}: ${cleanV}`;
      }).join(' • ');
    }
    return resolveOptionText(val, opts);
  }

  function renderQuestionChoices(q) {
    const rawType = (q.question_type || 'single_choice').toLowerCase().trim();
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
        return correct.some(c => {
          if (typeof c === 'object' && c !== null) {
            return Object.values(c).some(val => String(val).trim().toLowerCase() === strOpt);
          }
          return String(c).trim().toLowerCase() === strOpt;
        });
      }
      if (typeof correct === 'object' && correct !== null) {
        return Object.entries(correct).some(([k, v]) => {
          return String(k).trim().toLowerCase() === strOpt || String(v).trim().toLowerCase() === strOpt;
        });
      }
      return String(correct).trim().toLowerCase() === strOpt;
    }

    if (rawType === 'yes_no' || rawType === 'true_false') {
      const list = rawType === 'yes_no' ? ['Yes', 'No'] : ['True', 'False'];
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

    if (
      rawType === 'single_choice' ||
      rawType === 'multiple_choice' ||
      rawType === 'multiple_response' ||
      rawType === 'multiple_select' ||
      rawType === 'scenario' ||
      rawType === 'case_study'
    ) {
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
                ${isCorrect ? '<span class="badge badge-success" style="font-size:0.72rem; font-weight:800; flex-shrink:0;">✔ CORRECT CHOICE</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    if (rawType === 'dropdown') {
      let groups = [];
      if (Array.isArray(opts)) {
        if (opts.length > 0 && (opts[0].options || opts[0].choices || opts[0].dropdowns)) {
          groups = opts;
        } else {
          groups = [{ label: 'Dropdown Options', options: opts }];
        }
      } else if (typeof opts === 'object' && opts !== null) {
        groups = Object.entries(opts).map(([k, v]) => ({
          label: k,
          options: Array.isArray(v) ? v : [v]
        }));
      }

      return `
        <div style="display:flex; flex-direction:column; gap:0.65rem; margin-top:0.5rem;">
          ${groups.map((grp, gIdx) => {
            const grpLabel = grp.label || grp.name || grp.prompt || `Dropdown Option Area ${gIdx + 1}`;
            const choices = Array.isArray(grp.options) ? grp.options : (Array.isArray(grp.choices) ? grp.choices : []);
            return `
              <div style="padding:0.75rem 0.95rem; border-radius:var(--radius-md); border:1px solid var(--border); background:var(--surface);">
                <div style="font-weight:700; font-size:0.85rem; color:var(--text-main); margin-bottom:0.45rem;">
                  🔽 ${escapeHtml(grpLabel)}
                </div>
                <div style="display:flex; flex-direction:column; gap:0.35rem;">
                  ${choices.map((c, cIdx) => {
                    const cId = typeof c === 'object' && c !== null ? (c.id || c.value || c.text) : c;
                    const cText = typeof c === 'object' && c !== null ? (c.text || c.label || c.id) : c;
                    const isCorrect = isOptCorrect(cId) || isOptCorrect(cText);
                    return `
                      <div style="padding:0.45rem 0.75rem; border-radius:var(--radius-sm); border:1px solid ${isCorrect ? 'var(--brand-lime)' : 'var(--border)'}; background:${isCorrect ? 'rgba(34,197,94,0.12)' : 'var(--surface-subtle)'}; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.875rem; color:var(--text-main);"><strong style="margin-right:0.35rem;">${cIdx + 1}.</strong>${escapeHtml(String(cText))}</span>
                        ${isCorrect ? '<span class="badge badge-success" style="font-size:0.7rem; font-weight:800;">✔ CORRECT SELECTION</span>' : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    if (rawType === 'ordering' || rawType === 'ordering_sequence') {
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

    if (rawType === 'matching' || rawType === 'drag_drop') {
      let sources = [];
      let targets = [];
      let sourceTitle = 'Sources';
      let targetTitle = 'Answer Area';

      if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
        sources = Array.isArray(opts.sources) ? opts.sources : [];
        targets = Array.isArray(opts.targets) ? opts.targets : [];
        sourceTitle = opts.source_title || 'Sources';
        targetTitle = opts.target_title || 'Answer Area';
      } else if (Array.isArray(opts) && opts.length > 0 && (opts[0].source || opts[0].left || opts[0].target || opts[0].right)) {
        sources = opts.map((p, idx) => ({ id: 'src_' + idx, text: p.source || p.left || '' }));
        targets = opts.map((p, idx) => ({ id: 'tgt_' + idx, text: p.target || p.right || '' }));
      }

      let correctMap = {};
      if (typeof correct === 'object' && correct !== null && !Array.isArray(correct)) {
        correctMap = correct;
      } else if (Array.isArray(correct)) {
        correct.forEach((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            const t = item.target || item.left || item.target_id || `tgt_${idx}`;
            const s = item.source || item.right || item.source_id || '';
            correctMap[t] = s;
          }
        });
      }

      return `
        <div class="ms-drag-container" style="margin-top:0.75rem; border:1px solid var(--border); border-radius:var(--radius-md); padding:1rem; background:var(--surface);">
          <div style="display:inline-block; font-size:0.72rem; font-weight:800; background:var(--surface-subtle); border:1px solid var(--border); padding:0.2rem 0.5rem; border-radius:var(--radius-sm); color:var(--text-muted); margin-bottom:0.5rem;">
            DRAG DROP &bull; STUDENT VIEW
          </div>
          <div style="font-size:0.875rem; color:var(--text-muted); line-height:1.45; margin-bottom:0.85rem;">
            Match each item on the left to its appropriate description on the right.
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1.25rem;">
            <!-- Left Column: Source Draggable Pool -->
            <div style="background:var(--surface-subtle); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.85rem;">
              <div style="font-weight:800; font-size:0.82rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.6rem;">
                ${escapeHtml(sourceTitle)}
              </div>
              <div style="display:flex; flex-direction:column; gap:0.5rem;">
                ${sources.map(s => `
                  <div style="padding:0.6rem 0.85rem; background:var(--surface); border:1.5px solid var(--border); border-radius:var(--radius-sm); font-size:0.88rem; font-weight:600; color:var(--text-main); display:flex; justify-content:space-between; align-items:center;">
                    <span>${escapeHtml(s.text)}</span>
                    <span style="color:var(--brand-cyan, #00a4ef); font-size:0.85rem; opacity:0.8;">⠿</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Right Column: Answer Area Targets with Correct Slotting -->
            <div style="background:var(--surface-subtle); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.85rem;">
              <div style="font-weight:800; font-size:0.82rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:0.6rem;">
                ${escapeHtml(targetTitle)} (Correct Matching)
              </div>
              <div style="display:flex; flex-direction:column; gap:0.6rem;">
                ${targets.map(t => {
                  const targetVal = correctMap[t.id] !== undefined ? correctMap[t.id] : (correctMap[t.text] !== undefined ? correctMap[t.text] : '');
                  let matchedSource = sources.find(s => s.id === targetVal || s.text === targetVal);
                  let filledText = matchedSource ? matchedSource.text : (targetVal || 'Unmatched');
                  return `
                    <div style="display:flex; flex-direction:column; gap:0.35rem; padding:0.65rem 0.85rem; background:var(--surface); border:1.5px solid var(--border); border-radius:var(--radius-sm);">
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.25rem 0.65rem; background:rgba(34,197,94,0.18); border:1.5px solid var(--brand-lime, #62b017); color:var(--success, #16a34a); border-radius:var(--radius-xs, 4px); font-size:0.82rem; font-weight:800;">
                          ✔ ${escapeHtml(filledText)}
                        </span>
                      </div>
                      <div style="font-size:0.85rem; color:var(--text-main); line-height:1.4;">
                        ${escapeHtml(t.text)}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (rawType === 'hotspot') {
      let statements = [];
      if (Array.isArray(opts)) {
        statements = opts;
      } else if (typeof opts === 'object' && opts !== null) {
        statements = Object.entries(opts).map(([k, v]) => ({
          id: k,
          statement: typeof v === 'object' && v !== null ? (v.statement || v.text || k) : String(v)
        }));
      }

      let correctMap = {};
      if (typeof correct === 'object' && correct !== null && !Array.isArray(correct)) {
        correctMap = correct;
      } else if (Array.isArray(correct)) {
        correct.forEach((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            const id = item.id || item.statement_id || `stmt_${idx + 1}`;
            correctMap[id] = item.answer || item.correct || item.value || '';
          } else {
            correctMap[`stmt_${idx + 1}`] = String(item);
          }
        });
      }

      return `
        <div class="hotspot-area" style="border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; background:var(--surface); margin-top:0.65rem;">
          <div style="padding:0.75rem 1.25rem; background:var(--surface-subtle); border-bottom:1px solid var(--border); font-weight:800; font-family:var(--font-heading); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <span>Hot Area: Answer Area</span>
            <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">Select Yes or No for each statement</span>
          </div>
          <div class="table-container" style="border:none; margin:0; overflow-x:auto;">
            <table class="table" style="margin:0; width:100%;">
              <thead>
                <tr style="background:var(--surface-subtle);">
                  <th style="width:70%; font-weight:700; padding:0.85rem 1.25rem;">Statements</th>
                  <th style="width:15%; text-align:center; font-weight:700; padding:0.85rem 1rem;">Yes</th>
                  <th style="width:15%; text-align:center; font-weight:700; padding:0.85rem 1rem;">No</th>
                </tr>
              </thead>
              <tbody>
                ${statements.map((st, sIdx) => {
                  const sId = st.id || ('stmt_' + (sIdx + 1));
                  const sText = st.statement || st.text || st;
                  const correctVal = correctMap[sId] || correctMap[String(sIdx + 1)] || correctMap[sText] || '';
                  const isYes = String(correctVal).trim().toLowerCase() === 'yes';
                  const isNo = String(correctVal).trim().toLowerCase() === 'no';

                  return `
                    <tr style="border-bottom:1px solid var(--border);">
                      <td style="padding:1rem 1.25rem; font-size:0.92rem; line-height:1.5; color:var(--text-main);">
                        ${escapeHtml(String(sText))}
                      </td>
                      <td style="text-align:center; vertical-align:middle; padding:0.75rem 0.5rem;">
                        ${isYes ? `
                          <span style="display:inline-flex; align-items:center; justify-content:center; gap:0.35rem; padding:0.35rem 0.85rem; background:rgba(34,197,94,0.18); border:2px solid var(--brand-lime, #62b017); color:var(--success, #16a34a); border-radius:var(--radius-sm); font-weight:800; font-size:0.85rem;">
                            ✔ Yes
                          </span>
                        ` : `
                          <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; border:2px solid var(--border); color:var(--text-muted); opacity:0.4;"></span>
                        `}
                      </td>
                      <td style="text-align:center; vertical-align:middle; padding:0.75rem 0.5rem;">
                        ${isNo ? `
                          <span style="display:inline-flex; align-items:center; justify-content:center; gap:0.35rem; padding:0.35rem 0.85rem; background:rgba(34,197,94,0.18); border:2px solid var(--brand-lime, #62b017); color:var(--success, #16a34a); border-radius:var(--radius-sm); font-weight:800; font-size:0.85rem;">
                            ✔ No
                          </span>
                        ` : `
                          <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; border:2px solid var(--border); color:var(--text-muted); opacity:0.4;"></span>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (rawType === 'fill_blank' || rawType === 'fill_in_the_blank') {
      return `
        <div style="margin-top:0.5rem; padding:0.75rem 1rem; border-radius:var(--radius-md); background:rgba(34,197,94,0.1); border:1px solid var(--brand-lime);">
          <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Expected Fill-In-The-Blank Answer:</span>
          <div style="font-family:monospace; font-weight:700; font-size:1.05rem; color:var(--text-main); margin-top:0.25rem;">
            ${escapeHtml(formatAnswerText(correct, opts))}
          </div>
        </div>
      `;
    }

    // Default fallback
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
    const qAnalysisContainer = container.querySelector('#questions-analysis-container');
    if (!qAnalysisContainer || !currentData || !currentData.questions_analysis) return;
    const questions = currentData.questions_analysis;
    const weakCountBadge = container.querySelector('#badge-weak-count');
    const qSearchFilter = container.querySelector('#q-search-filter');
    const qSectionFilter = container.querySelector('#q-section-filter');
    const qStatusFilter = container.querySelector('#q-status-filter');
    const qCountBadge = container.querySelector('#q-count-badge');
    const toggleAllBtn = container.querySelector('#btn-toggle-all-questions');

    if (questions.length === 0) {
      qAnalysisContainer.innerHTML = `
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
      const currentlyOpenIds = new Set(
        Array.from(qAnalysisContainer.querySelectorAll('.q-details-drawer'))
          .filter(d => d.style.display === 'block')
          .map(d => d.id.replace('q-details-', ''))
      );
      const searchVal = (qSearchFilter?.value || '').trim().toLowerCase();
      const secVal = qSectionFilter?.value || '';
      const statusVal = qStatusFilter?.value || '';

      const filtered = questions.filter(q => {
        const textMatch = !searchVal ||
          (q.question_text || '').toLowerCase().includes(searchVal) ||
          (q.topic || '').toLowerCase().includes(searchVal) ||
          (q.section_name || '').toLowerCase().includes(searchVal);

        const secMatch = !secVal || (q.section_name || '').trim().toLowerCase() === secVal.trim().toLowerCase();

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
        qAnalysisContainer.innerHTML = `
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">
            No questions match the current filter.
          </div>
        `;
        return;
      }

      // Sort filtered questions strictly in sequential delegate view order: by section then question_number (1 to 25)
      const sectionOrder = (
        (currentData?.selected_class?.section_names && currentData.selected_class.section_names.length > 0)
          ? currentData.selected_class.section_names
          : (currentData?.ordered_section_names && currentData.ordered_section_names.length > 0)
            ? currentData.ordered_section_names
            : (currentData?.sections_analysis || []).map(s => s.name || s.section_name)
      );

      filtered.sort((a, b) => {
        const aSec = (a.section_name || 'Section 1').trim();
        const bSec = (b.section_name || 'Section 1').trim();
        const aIdx = sectionOrder.findIndex(s => s && s.trim().toLowerCase() === aSec.toLowerCase());
        const bIdx = sectionOrder.findIndex(s => s && s.trim().toLowerCase() === bSec.toLowerCase());
        const secDiff = (aIdx !== -1 ? aIdx : 999) - (bIdx !== -1 ? bIdx : 999);
        if (secDiff !== 0) return secDiff;
        if (aIdx === -1 && bIdx === -1) {
          const comp = aSec.localeCompare(bSec, undefined, { numeric: true, sensitivity: 'base' });
          if (comp !== 0) return comp;
        }
        return (a.question_number || 0) - (b.question_number || 0);
      });

      let lastSection = null;
      qAnalysisContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.85rem;">
          ${filtered.map((q, idx) => {
            const qNum = q.question_number || (idx + 1);
            const isWeak = q.needs_review;
            const isAttempted = q.is_attempted;
            const pct = isAttempted && q.success_percentage !== null ? q.success_percentage : null;
            const cardBorder = isWeak ? 'rgba(220,38,38,0.45)' : (isAttempted ? 'var(--border)' : 'var(--border)');
            const accentBorder = isWeak ? 'var(--danger)' : (isAttempted ? 'var(--brand-lime)' : 'var(--border)');

            let sectionHeaderHtml = '';
            const secName = (q.section_name || 'Section 1').trim();
            const normSec = secName.toLowerCase();
            if (normSec !== lastSection) {
              lastSection = normSec;
              const countInSec = q.total_questions_in_section || filtered.filter(item => (item.section_name || 'Section 1').trim().toLowerCase() === normSec).length;
              sectionHeaderHtml = `
                <div style="margin:${idx === 0 ? '0 0 0.4rem 0' : '1.25rem 0 0.4rem 0'}; padding:0.65rem 1rem; background:var(--surface-subtle); border:1px solid var(--border); border-left:4px solid var(--brand-lime); border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-size:1.1rem;">📁</span>
                    <span style="font-weight:800; font-family:var(--font-heading); font-size:1rem; color:var(--text-main);">
                      ${escapeHtml(secName)} &bull; Questions 1 - ${countInSec}
                    </span>
                  </div>
                  <span class="badge badge-primary" style="font-size:0.75rem; font-weight:700;">
                    ${countInSec} Question${countInSec === 1 ? '' : 's'}
                  </span>
                </div>
              `;
            }

            return `
              ${sectionHeaderHtml}
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
                      ${currentlyOpenIds.has(String(q.id)) ? '▲ Close Details' : '👁 View Answers ▼'}
                    </button>
                  </div>
                </div>

                <!-- Accuracy Progress Bar -->
                <div style="height:4px; background:var(--surface-subtle); width:100%;">
                  <div style="height:100%; width:${pct !== null ? pct : 0}%; background:${isWeak ? 'var(--danger)' : 'var(--brand-lime)'};"></div>
                </div>

                <!-- Expandable Question Details Drawer -->
                <div id="q-details-${escapeHtml(q.id)}" class="q-details-drawer" style="display:${currentlyOpenIds.has(String(q.id)) ? 'block' : 'none'}; padding:1.15rem; background:var(--surface-subtle); border-top:1px dashed var(--border);">
                  
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
      qAnalysisContainer.querySelectorAll('.q-card-header, .btn-toggle-q-details').forEach(el => {
        el.onclick = (e) => {
          e.stopPropagation();
          const qid = el.dataset.qid;
          if (!qid) return;
          const drawer = qAnalysisContainer.querySelector(`#q-details-${CSS.escape(qid)}`);
          const btn = qAnalysisContainer.querySelector(`.btn-toggle-q-details[data-qid="${CSS.escape(qid)}"]`);
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
        const allDrawers = qAnalysisContainer.querySelectorAll('.q-details-drawer');
        const anyHidden = Array.from(allDrawers).some(d => d.style.display === 'none' || !d.style.display);
        allDrawers.forEach(d => {
          d.style.display = anyHidden ? 'block' : 'none';
        });
        qAnalysisContainer.querySelectorAll('.btn-toggle-q-details').forEach(btn => {
          btn.textContent = anyHidden ? '▲ Close Details' : '👁 View Answers ▼';
        });
        toggleAllBtn.textContent = anyHidden ? 'Collapse All Details' : 'Expand All Details';
      };
    }

    updateQuestionList();
  }

  // Event Handlers
  if (classSelect) {
    classSelect.onchange = () => {
      activeClassId = classSelect.value;
      savedSelectedClassId = activeClassId;
      loadDashboardData();
    };
  }

  if (searchInput) searchInput.oninput = renderStudentRoster;
  if (sectionHelpFilter) sectionHelpFilter.onchange = renderStudentRoster;
  if (statusFilter) statusFilter.onchange = renderStudentRoster;
  if (refreshBtn) refreshBtn.onclick = () => loadDashboardData();

  // Export CSV
  if (exportBtn) {
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
  }

  // 15-second background auto-refresh loop
  const autoRefreshInterval = setInterval(() => {
    if (document.body.contains(container)) {
      loadDashboardData(true);
    } else {
      clearInterval(autoRefreshInterval);
    }
  }, 15000);

  // Initial Load
  loadDashboardData();
}

function formatLocalDate(dateStr) {
  if (!dateStr) return 'Never';
  let d;
  if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) {
    d = new Date(dateStr.replace(' ', 'T') + 'Z');
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
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
