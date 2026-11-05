// Student Assessment Player & Exam Interface (Sections 22, 23, 24, 25, 26, 27)

import { api } from '../api.js';

export function renderAssessmentPlayer(container, { assessmentId = null, classId = null, attemptId = null, forceRestart = false, onExit = null } = {}) {
  let currentAttempt = null;
  let activeQuestionIndex = 0;
  let timerInterval = null;
  let autosaveTimeout = null;

  container.innerHTML = `
    <div id="player-view-container">
      <div style="text-align:center; padding:3rem;">Loading assessment...</div>
    </div>

    <!-- End / Final Submission Confirmation Modal (Section 25) -->
    <dialog id="modal-confirm-submit" style="max-width:520px; width:95%;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;">End or Submit Assessment</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-confirm">&times;</button>
      </div>
      <div class="modal-body" id="confirm-submit-body"></div>
      <div class="modal-footer" style="display:flex; justify-content:space-between; gap:0.5rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary" id="btn-return-to-exam">Return to Assessment</button>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" id="btn-end-and-retry" style="font-weight:700; border-color:var(--primary); color:var(--text-main);">
            &#x21bb; End &amp; Try Again
          </button>
          <button type="button" class="btn btn-primary" id="btn-final-submit" style="font-weight:700;">
            &#x2714; End &amp; View Results
          </button>
        </div>
      </div>
    </dialog>

    <!-- Restart Assessment Confirmation Modal -->
    <dialog id="modal-confirm-restart" style="max-width:500px; width:95%;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;">Restart Assessment</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-restart">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.95rem; color:var(--text-main); margin-bottom:1rem;">
          How would you like to restart this assessment?
        </p>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div class="card" style="padding:0.9rem; background:var(--surface-subtle); border:1px solid var(--border);">
            <div style="font-weight:700; font-size:0.9rem; margin-bottom:0.25rem;">Option 1: Reset &amp; Start Fresh</div>
            <div class="form-hint" style="margin-bottom:0.6rem;">Clears your current in-progress answers and resets the timer from Question 1 without recording an incomplete attempt.</div>
            <button type="button" class="btn btn-primary btn-sm" id="btn-confirm-reset-fresh" style="width:100%; font-weight:700;">
              &#x21bb; Reset &amp; Restart From Beginning
            </button>
          </div>
          <div class="card" style="padding:0.9rem; background:var(--surface-subtle); border:1px solid var(--border);">
            <div style="font-weight:700; font-size:0.9rem; margin-bottom:0.25rem;">Option 2: End Current Attempt &amp; Try Again</div>
            <div class="form-hint" style="margin-bottom:0.6rem;">Grades and saves your current progress to Past Attempts, then immediately launches a new attempt.</div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-confirm-submit-restart" style="width:100%; font-weight:700;">
              &#x23F9; End Current Attempt &amp; Start New Attempt
            </button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-cancel-restart">Cancel</button>
      </div>
    </dialog>

    <!-- Section Transition / Unanswered Questions Prompt Modal -->
    <dialog id="modal-section-transition" style="max-width:500px; width:95%;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;" id="sec-trans-title">Move to Next Section</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-sec-trans">&times;</button>
      </div>
      <div class="modal-body" id="sec-trans-body"></div>
      <div class="modal-footer" style="display:flex; justify-content:space-between; gap:0.5rem;">
        <button type="button" class="btn btn-secondary" id="btn-stay-in-section">Finish Current Section First</button>
        <button type="button" class="btn btn-primary" id="btn-proceed-next-section" style="font-weight:700;">Move to Next Section &rarr;</button>
      </div>
    </dialog>

    <!-- Section Submit for Review Modal -->
    <dialog id="modal-submit-section" style="max-width:520px; width:95%;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;" id="sec-submit-title">Submit Section for Review</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-sec-submit">&times;</button>
      </div>
      <div class="modal-body" id="sec-submit-body"></div>
      <div class="modal-footer" style="display:flex; justify-content:space-between; gap:0.5rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary" id="btn-cancel-sec-submit">Return to Questions</button>
        <button type="button" class="btn btn-primary" id="btn-confirm-sec-submit" style="font-weight:700;">
          &#x2714; Confirm &amp; Submit Section for Review
        </button>
      </div>
    </dialog>

    <!-- Section Results Summary Modal -->
    <dialog id="modal-section-results" style="max-width:540px; width:95%;">
      <div class="modal-header">
        <h3 style="font-size:1.15rem; font-weight:800;" id="sec-results-title">Section Results</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-sec-results">&times;</button>
      </div>
      <div class="modal-body" id="sec-results-body"></div>
      <div class="modal-footer" style="display:flex; justify-content:space-between; gap:0.5rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-primary" id="btn-modal-review-questions" style="font-weight:700;">
          Review Questions &rarr;
        </button>
        <button type="button" class="btn btn-secondary" id="btn-modal-go-next-sec" style="font-weight:700; background:var(--brand-lime); color:#000;">
          Go to Next Section &rarr;
        </button>
      </div>
    </dialog>

    <!-- Next Section Locked Waiting Modal -->
    <dialog id="modal-section-locked" style="max-width:520px; width:95%;">
      <div class="modal-header">
        <h3 style="font-size:1.15rem; font-weight:800;" id="sec-locked-title">&#x1F512; Section Locked</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-sec-locked">&times;</button>
      </div>
      <div class="modal-body" id="sec-locked-body"></div>
      <div class="modal-footer" style="display:flex; justify-content:space-between; gap:0.5rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary" id="btn-cancel-sec-locked">
          &larr; Return to Questions
        </button>
        <button type="button" class="btn btn-primary" id="btn-proceed-unlocked-modal" style="font-weight:800; display:none; background:var(--brand-lime); color:#000;">
          &#x1F513; Start Next Section &rarr;
        </button>
      </div>
    </dialog>
  `;

  const viewContainer = container.querySelector('#player-view-container');
  const confirmModal = container.querySelector('#modal-confirm-submit');
  const restartModal = container.querySelector('#modal-confirm-restart');
  const sectionModal = container.querySelector('#modal-section-transition');
  const secSubmitModal = container.querySelector('#modal-submit-section');
  const secResultsModal = container.querySelector('#modal-section-results');
  const secLockedModal = container.querySelector('#modal-section-locked');
  let sectionUnlockPoller = null;
  let lockedModalPoller = null;

  async function initPlayer() {
    try {
      if (attemptId) {
        // Resume or view specific attempt
        currentAttempt = await api.get(`/student/attempts/${attemptId}`);
      } else if (forceRestart && assessmentId) {
        // Immediately start a fresh attempt when requested via Restart / Try Again
        currentAttempt = await api.post('/student/attempts/start', {
          assessment_id: assessmentId,
          class_id: classId,
          force_new: true
        });
      } else {
        // Check if student already has an active in-progress attempt for this assessment
        try {
          const activeCheck = await api.getActiveAttempt(assessmentId);
          if (activeCheck && activeCheck.has_active && activeCheck.attempt_id) {
            currentAttempt = await api.get(`/student/attempts/${activeCheck.attempt_id}`);
          }
        } catch (_) {}

        if (!currentAttempt) {
          // Pre-flight instruction screen
          const assessment = await api.get(`/assessments/${assessmentId}`);
          renderPreflightScreen(assessment);
          return;
        }
      }

      if (currentAttempt && currentAttempt.id && typeof window !== 'undefined') {
        if (window.location.hash !== `#exam-attempt/${currentAttempt.id}`) {
          try { history.replaceState(null, '', `#exam-attempt/${currentAttempt.id}`); } catch (_) {}
        }
      }

      if (currentAttempt.status === 'in_progress') {
        const distinctSecs = getDistinctSections();
        const activeSec = distinctSecs.find(s => !s.is_submitted);
        if (activeSec && !activeSec.is_unlocked) {
          const prevSec = distinctSecs[distinctSecs.indexOf(activeSec) - 1];
          if (prevSec && prevSec.is_submitted) {
            activeQuestionIndex = (prevSec.indices && prevSec.indices[0]) || 0;
            renderLiveExamInterface();
            return;
          }
          renderSectionWaitingCard(prevSec ? prevSec.name : 'Previous Section', activeSec.name);
          return;
        }
        renderLiveExamInterface();
      } else {
        renderResultsScreen();
      }
    } catch (err) {
      viewContainer.innerHTML = `
        <div class="card" style="text-align:center; padding:3rem;">
          <h3 style="color:var(--danger); margin-bottom:1rem;">Unable to Load Assessment</h3>
          <p style="margin-bottom:1.5rem;">${escapeHtml(err.message)}</p>
          <button type="button" class="btn btn-secondary" id="btn-error-exit">Return to Dashboard</button>
        </div>
      `;
      viewContainer.querySelector('#btn-error-exit').onclick = () => onExit && onExit();
    }
  }

  // Pre-flight Instructions Screen (Section 22)
  function renderPreflightScreen(assessment) {
    viewContainer.innerHTML = `
      <div class="card" style="max-width:800px; margin:2rem auto; padding:2rem;">
        <div style="border-bottom:1px solid var(--border); padding-bottom:1.25rem; margin-bottom:1.5rem;">
          <span class="badge badge-primary" style="margin-bottom:0.5rem;">EXAM PREPARATION ASSESSMENT</span>
          <h1 style="font-size:1.75rem; font-weight:800;">${escapeHtml(assessment.name)}</h1>
          <p class="form-hint" style="font-size:0.95rem;">${escapeHtml(assessment.description || '')}</p>
        </div>

        <div class="stats-grid" style="grid-template-columns:repeat(4, 1fr); margin-bottom:1.5rem;">
          <div class="stat-card">
            <span class="stat-label">Duration</span>
            <span class="stat-value" style="font-size:1.5rem;">${assessment.duration_minutes} min</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Sections</span>
            <span class="stat-value" style="font-size:1.5rem;">${(assessment.sections || []).length || 3}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Total Questions</span>
            <span class="stat-value" style="font-size:1.5rem;">${assessment.question_count}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Pass Mark</span>
            <span class="stat-value" style="font-size:1.5rem;">${assessment.pass_mark_percentage}%</span>
          </div>
        </div>

        ${Array.isArray(assessment.sections) && assessment.sections.length > 0 ? `
          <div class="card" style="background:var(--surface-subtle); border-color:var(--border); margin-bottom:1.5rem; padding:1.15rem;">
            <h4 style="font-size:0.9rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">
              Sub-Assessment Sections (Complete in Order)
            </h4>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:0.75rem;">
              ${assessment.sections.map((sec, idx) => `
                <div style="background:var(--surface); border:1px solid var(--border); border-left:4px solid var(--brand-lime); border-radius:var(--radius-md); padding:0.75rem 0.9rem;">
                  <div style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Division ${idx + 1}</div>
                  <div style="font-weight:800; font-family:var(--font-heading); font-size:0.95rem; margin:0.15rem 0;">${escapeHtml(sec.name)}</div>
                  <div style="font-size:0.8rem; color:var(--text-muted);">${sec.question_count || 0} Question(s) &bull; ${sec.total_points || 0} pt(s)</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${assessment.instructions ? `
          <div class="question-description-box" style="margin-bottom:1.5rem;">
            <h4>Assessment Instructions</h4>
            <div style="white-space:pre-wrap;">${escapeHtml(assessment.instructions)}</div>
          </div>
        ` : ''}

        <div class="card" style="background:var(--surface-subtle); border-color:var(--border); margin-bottom:1.5rem; font-size:0.875rem;">
          <h4 style="font-weight:700; margin-bottom:0.5rem;">Important Assessment Rules:</h4>
          <ul style="padding-left:1.25rem; display:flex; flex-direction:column; gap:0.35rem; color:var(--text-muted);">
            <li>Your answers save automatically as you progress.</li>
            <li>If the page is refreshed or your connection drops, your progress will be safely restored.</li>
            <li>The assessment timer is managed by the server and will submit automatically if time expires.</li>
            <li>You may flag questions to easily review them before final submission.</li>
          </ul>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <button type="button" class="btn btn-secondary" id="btn-preflight-cancel">Cancel</button>
          <button type="button" class="btn btn-primary btn-lg" id="btn-preflight-start">
            Start Assessment Now &rarr;
          </button>
        </div>
      </div>
    `;

    viewContainer.querySelector('#btn-preflight-cancel').onclick = () => onExit && onExit();
    viewContainer.querySelector('#btn-preflight-start').onclick = async () => {
      const btn = viewContainer.querySelector('#btn-preflight-start');
      btn.disabled = true;
      btn.textContent = 'Starting attempt...';

      try {
        currentAttempt = await api.post('/student/attempts/start', {
          assessment_id: assessment.id,
          class_id: classId
        });
        if (currentAttempt && currentAttempt.id && typeof window !== 'undefined') {
          try { history.replaceState(null, '', `#exam-attempt/${currentAttempt.id}`); } catch (_) {}
        }
        renderLiveExamInterface();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
        btn.textContent = 'Start Assessment Now →';
      }
    };
  }

  // Live In-Assessment Interface
  function renderLiveExamInterface() {
    if (timerInterval) clearInterval(timerInterval);
    if (currentAttempt && currentAttempt.id && typeof window !== 'undefined') {
      if (window.location.hash !== `#exam-attempt/${currentAttempt.id}`) {
        try { history.replaceState(null, '', `#exam-attempt/${currentAttempt.id}`); } catch (_) {}
      }
    }

    viewContainer.innerHTML = `
      <!-- Assessment Top Banner -->
      <div class="card" style="padding:0.75rem 1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem;">
        <div style="display:flex; align-items:center; gap:0.85rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-save-exit-exam" title="Save progress and return to Student Learning Portal">
            &larr; Save &amp; Exit
          </button>
          <div>
            <div style="font-weight:700; font-size:1.1rem; color:var(--text-main);">${escapeHtml(currentAttempt.assessment_name)}</div>
            <div style="font-size:0.8125rem; color:var(--text-muted);">${escapeHtml(currentAttempt.course_name)} &bull; Attempt #${currentAttempt.attempt_number}</div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
          <div class="autosave-indicator" id="autosave-badge">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
            <span>Saved</span>
          </div>

          <div class="timer-badge" id="exam-timer">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span id="timer-display">--:--:--</span>
          </div>

          <button type="button" class="btn btn-secondary btn-sm" id="btn-restart-exam" title="Restart this assessment from Question 1">
            &#x21bb; Restart Assessment
          </button>

          <button type="button" class="btn btn-primary" id="btn-review-submit" title="End assessment, view results, or try again">
            &#x23F9; End / Submit Assessment
          </button>
        </div>
      </div>

      <!-- Sub-Assessment Section Progression Stepper -->
      <div class="card" id="section-stepper-bar" style="padding:0.9rem 1.25rem; margin-bottom:1.25rem; background:var(--surface);"></div>

      <!-- Main Assessment Player Layout -->
      <div class="assessment-player">
        <div class="player-main">
          <div class="card" id="question-card" style="padding:1.5rem; min-height:480px; display:flex; flex-direction:column; justify-content:space-between;">
            <div id="question-display-area">
              <!-- Active question rendered here -->
            </div>

            <!-- Bottom Navigation Bar -->
            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:2rem; padding-top:1.25rem; border-top:1px solid var(--border); flex-wrap:wrap; gap:0.5rem;">
              <button type="button" class="btn btn-secondary" id="btn-prev-q">
                &larr; Previous
              </button>

              <div style="display:flex; gap:0.5rem; align-items:center;">
                <button type="button" class="btn btn-secondary" id="btn-flag-q">
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clip-rule="evenodd"/></svg>
                  <span id="flag-label">Flag for Review</span>
                </button>
              </div>

              <button type="button" class="btn btn-primary" id="btn-next-q">
                Next &rarr;
              </button>
            </div>
          </div>
        </div>

        <!-- Sidebar Question Navigator Palette -->
        <div class="player-sidebar">
          <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:0.75rem;">Question Navigator</h4>
          <p class="form-hint" style="margin-bottom:1rem;">Jump directly to any question:</p>

          <div class="nav-palette" id="nav-palette"></div>

          <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border); font-size:0.8125rem; display:flex; flex-direction:column; gap:0.4rem; color:var(--text-muted);">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="width:12px; height:12px; border-radius:3px; background:rgba(34,197,94,0.25); border:1.5px solid var(--success);"></span>
              <span>&#x2714; Correct (Submitted)</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="width:12px; height:12px; border-radius:3px; background:rgba(239,68,68,0.25); border:1.5px solid var(--danger);"></span>
              <span>&#x2718; Incorrect (Submitted)</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="width:12px; height:12px; border-radius:3px; background:var(--primary-light); border:1px solid var(--primary-border);"></span>
              <span>Answered</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="width:12px; height:12px; border-radius:3px; background:var(--surface); border:1px solid var(--border);"></span>
              <span>Unanswered</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="width:12px; height:12px; border-radius:3px; background:var(--warning);"></span>
              <span>Flagged for Review</span>
            </div>
          </div>

          <div style="margin-top:1.25rem; padding-top:1rem; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:0.5rem;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-sidebar-restart" style="width:100%;">
              &#x21bb; Restart Assessment
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="btn-sidebar-end" style="width:100%;">
              &#x23F9; End Assessment
            </button>
          </div>
        </div>
      </div>
    `;

    // Start Authoritative Countdown Timer
    startAuthoritativeTimer();

    // Render initial question
    renderQuestion(activeQuestionIndex);
    renderPalette();

    // Attach navigation events
    viewContainer.querySelector('#btn-save-exit-exam').onclick = () => {
      if (timerInterval) clearInterval(timerInterval);
      if (onExit) onExit();
    };

    viewContainer.querySelector('#btn-prev-q').onclick = () => {
      if (activeQuestionIndex > 0) {
        activeQuestionIndex--;
        renderQuestion(activeQuestionIndex);
        renderPalette();
      }
    };

    viewContainer.querySelector('#btn-next-q').onclick = () => {
      handleNextNavigation();
    };

    viewContainer.querySelector('#btn-flag-q').onclick = () => {
      const q = currentAttempt.questions[activeQuestionIndex];
      q.is_flagged = !q.is_flagged;
      triggerAutosave(q.id, q.saved_answer, q.is_flagged);
      updateFlagButton(q.is_flagged);
      renderPalette();
    };

    viewContainer.querySelector('#btn-review-submit').onclick = openConfirmModal;
    viewContainer.querySelector('#btn-sidebar-end').onclick = openConfirmModal;
    viewContainer.querySelector('#btn-restart-exam').onclick = openRestartModal;
    viewContainer.querySelector('#btn-sidebar-restart').onclick = openRestartModal;
  }

  function startAuthoritativeTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const timerDisplay = viewContainer.querySelector('#timer-display');
    const timerBadge = viewContainer.querySelector('#exam-timer');
    if (!timerDisplay || !timerBadge) return;

    if (currentAttempt.is_paused) {
      const remainingSec = currentAttempt.paused_remaining_seconds !== null && currentAttempt.paused_remaining_seconds !== undefined
        ? currentAttempt.paused_remaining_seconds
        : (currentAttempt.time_remaining_seconds || 0);
      const hours = Math.floor(remainingSec / 3600);
      const mins = Math.floor((remainingSec % 3600) / 60);
      const secs = remainingSec % 60;
      timerDisplay.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} (Paused)`;
      timerBadge.className = 'timer-badge paused';
      timerBadge.title = 'Timer is paused during section review & discussion. Resumes when you begin the next section.';
      return;
    }

    timerBadge.title = 'Assessment countdown timer';
    const deadlineMs = parseUtc(currentAttempt.deadline_at).getTime();

    function updateClock() {
      const now = Date.now();
      const remainingMs = deadlineMs - now;

      if (remainingMs <= 0) {
        clearInterval(timerInterval);
        timerDisplay.textContent = '00:00:00';
        timerBadge.className = 'timer-badge danger';
        // Auto-submit immediately
        handleAutoSubmit();
        return;
      }

      const totalSec = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      timerDisplay.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      if (totalSec < 300 && totalSec >= 60) {
        timerBadge.className = 'timer-badge warning';
      } else if (totalSec < 60) {
        timerBadge.className = 'timer-badge danger';
      } else {
        timerBadge.className = 'timer-badge';
      }
    }

    updateClock();
    timerInterval = setInterval(updateClock, 1000);
  }

  function updateFlagButton(isFlagged) {
    const flagBtn = viewContainer.querySelector('#btn-flag-q');
    const flagLabel = viewContainer.querySelector('#flag-label');
    if (isFlagged) {
      flagBtn.style.color = 'var(--warning)';
      flagBtn.style.borderColor = 'var(--warning)';
      flagLabel.textContent = 'Flagged';
    } else {
      flagBtn.style.color = '';
      flagBtn.style.borderColor = '';
      flagLabel.textContent = 'Flag for Review';
    }
  }

  function isQuestionAnswered(q) {
    if (!q) return false;
    const ans = q.saved_answer;
    if (ans === null || ans === undefined) return false;
    if (typeof ans === 'string') return ans.trim().length > 0;
    if (typeof ans === 'number') return true;
    if (typeof ans === 'boolean') return true;
    if (Array.isArray(ans)) return ans.length > 0;
    if (typeof ans === 'object') {
      const keys = Object.keys(ans);
      if (keys.length === 0) return false;
      return keys.some(k => {
        const val = ans[k];
        return val !== null && val !== undefined && String(val).trim() !== '';
      });
    }
    return true;
  }

  function showRequiredQuestionWarning(msg) {
    const banner = viewContainer.querySelector('#required-question-warning-banner');
    const textEl = viewContainer.querySelector('#required-warning-text');
    if (banner && textEl) {
      textEl.textContent = msg || 'Please answer this question before continuing to the next question. All questions are required.';
      banner.style.display = 'flex';
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const ansArea = viewContainer.querySelector('#interactive-answer-area');
    if (ansArea) {
      ansArea.style.border = '2px solid var(--danger)';
      ansArea.style.borderRadius = 'var(--radius-md)';
      ansArea.style.padding = '0.5rem';
      setTimeout(() => {
        if (ansArea) {
          ansArea.style.border = '';
          ansArea.style.padding = '';
        }
      }, 2500);
    }
  }

  function hideRequiredQuestionWarning() {
    const banner = viewContainer.querySelector('#required-question-warning-banner');
    if (banner) banner.style.display = 'none';
  }

  function getDistinctSections() {
    const map = new Map();
    const unlockedList = currentAttempt.unlocked_sections || ['Section 1'];
    const completedList = currentAttempt.completed_sections || [];
    (currentAttempt.questions || []).forEach((q, idx) => {
      const secName = q.section_name || 'Section 1';
      if (!map.has(secName)) {
        map.set(secName, { name: secName, indices: [] });
      }
      map.get(secName).indices.push(idx);
    });
    return Array.from(map.values()).map((sec, sIdx) => {
      const answered = sec.indices.filter(i => isQuestionAnswered(currentAttempt.questions[i])).length;
      const isSubmitted = completedList.includes(sec.name);
      const isUnlocked = unlockedList.includes(sec.name);
      const secMeta = (currentAttempt.sections || []).find(s => s.name === sec.name) || {};
      const secQuestions = sec.indices.map(i => currentAttempt.questions[i]).filter(Boolean);
      const secCorrect = secQuestions.filter(q => q.is_correct).length;
      return {
        ...sec,
        section_index: sIdx,
        total: sec.indices.length,
        answered,
        unanswered: sec.indices.length - answered,
        is_completed: isSubmitted || (sec.indices.length > 0 && answered === sec.indices.length),
        is_submitted: isSubmitted,
        is_unlocked: isUnlocked,
        score: secMeta.score ?? (isSubmitted ? secCorrect : null),
        max_score: secMeta.max_score ?? sec.indices.length,
        percentage: secMeta.percentage ?? (isSubmitted && sec.indices.length > 0 ? Math.round((secCorrect / sec.indices.length) * 100) : null),
        is_passed: secMeta.is_passed ?? (isSubmitted ? (secCorrect / (sec.indices.length || 1) >= ((currentAttempt.pass_mark_percentage || 70) / 100)) : false)
      };
    });
  }

  async function attemptTransitionToQuestion(targetIdx, fromSecName, toSecName) {
    const sections = getDistinctSections();
    const fromSec = sections.find(s => s.name === fromSecName);
    const toSec = sections.find(s => s.name === toSecName);

    // If target section is locked by instructor
    if (toSec && !toSec.is_unlocked && !toSec.is_submitted) {
      if (fromSec && !fromSec.is_submitted) {
        openSectionSubmitModal(fromSec.name);
      } else {
        await handleGoToNextSection(toSec.name);
      }
      return;
    }

    // If moving forward to a later section while current section has not been submitted yet
    if (fromSec && toSec && toSec.section_index > fromSec.section_index && !fromSec.is_submitted) {
      openSectionSubmitModal(fromSec.name);
      return;
    }

    // If target section is an uncompleted section and attempt was paused, resume timer!
    if (toSec && !toSec.is_submitted && currentAttempt.is_paused) {
      try {
        const resumed = await api.resumeAttemptTimer(currentAttempt.id, toSec.name);
        currentAttempt = resumed.attempt_state || resumed;
      } catch (e) {
        console.warn('Failed to resume timer:', e);
      }
    }

    activeQuestionIndex = targetIdx;
    renderQuestion(activeQuestionIndex);
    renderPalette();
  }


  async function handleGoToNextSection(nextSecName) {
    if (!nextSecName) {
      renderResultsScreen();
      return;
    }
    try {
      const status = await api.getAttemptUnlockStatus(currentAttempt.id);
      currentAttempt.unlocked_sections = status.unlocked_sections || ['Section 1'];
      if (status.status && status.status !== 'in_progress') {
        currentAttempt.status = status.status;
        renderResultsScreen();
        return;
      }

      (currentAttempt.questions || []).forEach(q => {
        if (currentAttempt.unlocked_sections.includes(q.section_name || 'Section 1')) {
          q.is_locked = false;
        }
      });

      const distinctSecs = getDistinctSections();
      const targetSec = distinctSecs.find(s => s.name === nextSecName);

      if (currentAttempt.unlocked_sections.includes(nextSecName)) {
        if (secLockedModal.open) secLockedModal.close();

        // Resume timer now that student is starting the new section
        if (currentAttempt.is_paused) {
          try {
            const resumed = await api.resumeAttemptTimer(currentAttempt.id, nextSecName);
            currentAttempt = resumed.attempt_state || resumed;
          } catch (e) {
            console.warn('Failed to resume timer:', e);
          }
        }

        if (targetSec && targetSec.indices && targetSec.indices.length > 0) {
          activeQuestionIndex = targetSec.indices[0];
        }
        renderLiveExamInterface();
        return;
      }

      // Next section is currently locked by instructor -> show locked modal with live polling
      openSectionLockedModal(nextSecName);
    } catch (err) {
      alert('Unable to check section status: ' + err.message);
    }
  }

  function openSectionLockedModal(nextSecName) {
    if (lockedModalPoller) clearInterval(lockedModalPoller);

    const titleEl = container.querySelector('#sec-locked-title');
    const bodyEl = container.querySelector('#sec-locked-body');
    const proceedBtn = container.querySelector('#btn-proceed-unlocked-modal');

    titleEl.innerHTML = `&#x1F512; ${escapeHtml(nextSecName)} Locked by Instructor`;
    proceedBtn.style.display = 'none';

    bodyEl.innerHTML = `
      <div style="padding:0.5rem 0; text-align:center;">
        <div style="font-size:2.5rem; margin-bottom:0.75rem;">&#x1F4AC;</div>
        <h4 style="font-size:1.1rem; font-weight:800; margin-bottom:0.5rem;">
          Instructor Discussion Underway
        </h4>
        <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.5; margin-bottom:1.25rem;">
          Your instructor is currently discussing the completed section with the cohort. Once the discussion concludes, your instructor will unlock <strong>${escapeHtml(nextSecName)}</strong>.
        </p>
        <div id="modal-unlock-polling" style="display:inline-flex; align-items:center; gap:0.5rem; font-size:0.825rem; font-weight:600; padding:0.5rem 0.9rem; background:var(--surface-subtle); border-radius:var(--radius-full); border:1px solid var(--border);">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--warning); animation:pulse 1.5s infinite;"></span>
          <span id="modal-unlock-polling-text">Waiting for instructor unlock (checking every 3s)...</span>
        </div>
      </div>
    `;

    secLockedModal.showModal();

    container.querySelector('#btn-close-sec-locked').onclick = () => {
      if (lockedModalPoller) clearInterval(lockedModalPoller);
      secLockedModal.close();
    };
    container.querySelector('#btn-cancel-sec-locked').onclick = () => {
      if (lockedModalPoller) clearInterval(lockedModalPoller);
      secLockedModal.close();
    };

    proceedBtn.onclick = async () => {
      if (lockedModalPoller) clearInterval(lockedModalPoller);
      secLockedModal.close();
      (currentAttempt.questions || []).forEach(q => {
        if (currentAttempt.unlocked_sections.includes(q.section_name || 'Section 1')) {
          q.is_locked = false;
        }
      });
      if (currentAttempt.is_paused) {
        try {
          const resumed = await api.resumeAttemptTimer(currentAttempt.id, nextSecName);
          currentAttempt = resumed.attempt_state || resumed;
        } catch (e) {
          console.warn('Failed to resume timer:', e);
        }
      }
      const distinctSecs = getDistinctSections();
      const targetSec = distinctSecs.find(s => s.name === nextSecName);
      if (targetSec && targetSec.indices && targetSec.indices.length > 0) {
        activeQuestionIndex = targetSec.indices[0];
      }
      renderLiveExamInterface();
    };

    lockedModalPoller = setInterval(async () => {
      try {
        const status = await api.getAttemptUnlockStatus(currentAttempt.id);
        const unlockedList = status.unlocked_sections || ['Section 1'];
        if (unlockedList.includes(nextSecName)) {
          clearInterval(lockedModalPoller);
          lockedModalPoller = null;
          currentAttempt.unlocked_sections = unlockedList;
          (currentAttempt.questions || []).forEach(q => {
            if (unlockedList.includes(q.section_name || 'Section 1')) {
              q.is_locked = false;
            }
          });

          const pollEl = container.querySelector('#modal-unlock-polling');
          const pollText = container.querySelector('#modal-unlock-polling-text');
          if (pollEl) {
            pollEl.style.borderColor = 'var(--brand-lime)';
            pollEl.style.background = 'rgba(34, 197, 94, 0.1)';
          }
          if (pollText) {
            pollText.innerHTML = `&#x2714; <strong>${escapeHtml(nextSecName)} has been unlocked!</strong>`;
            pollText.style.color = 'var(--success)';
          }
          if (proceedBtn) {
            proceedBtn.style.display = 'inline-flex';
            proceedBtn.innerHTML = `&#x1F513; Start ${escapeHtml(nextSecName)} Now &rarr;`;
          }
        }
      } catch (e) {
        // Continue silently
      }
    }, 3000);
  }

  function handleNextNavigation() {
    const q = currentAttempt.questions[activeQuestionIndex];
    const secName = q?.section_name || 'Section 1';
    const distinctSecs = getDistinctSections();
    const currSec = distinctSecs.find(s => s.name === secName) || distinctSecs[0];
    const nextQ = activeQuestionIndex < currentAttempt.questions.length - 1 ? currentAttempt.questions[activeQuestionIndex + 1] : null;
    const isLastInSection = nextQ && (nextQ.section_name || 'Section 1') !== secName;
    const isLastOverall = activeQuestionIndex === currentAttempt.questions.length - 1;

    // If current section has not been submitted yet
    if (!currSec.is_submitted) {
      // ENFORCE REQUIRED: Current question must be answered before advancing
      if (!isQuestionAnswered(q)) {
        showRequiredQuestionWarning('Please answer this question before continuing to the next question. All questions are required.');
        return;
      }

      if (isLastInSection || isLastOverall) {
        // ENFORCE REQUIRED: All questions in this section must be answered before submitting
        const hasUnanswered = currSec.indices.some(idx => !isQuestionAnswered(currentAttempt.questions[idx]));
        if (hasUnanswered) {
          showRequiredQuestionWarning(`Please answer all questions in ${secName} before submitting.`);
          return;
        }
        openSectionSubmitModal(secName);
        return;
      }
      activeQuestionIndex++;
      renderQuestion(activeQuestionIndex);
      renderPalette();
      return;
    }

    // Current section is already submitted (review mode)
    if (isLastInSection) {
      const nextSecName = nextQ?.section_name || 'Section 2';
      handleGoToNextSection(nextSecName);
      return;
    }

    if (isLastOverall) {
      renderResultsScreen();
      return;
    }

    activeQuestionIndex++;
    renderQuestion(activeQuestionIndex);
    renderPalette();
  }

  function renderSectionStepper() {
    const stepperEl = viewContainer.querySelector('#section-stepper-bar');
    if (!stepperEl) return;

    const sections = getDistinctSections();
    const activeQ = currentAttempt.questions[activeQuestionIndex];
    const activeSecName = activeQ?.section_name || 'Section 1';

    stepperEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.65rem; flex-wrap:wrap; gap:0.5rem;">
        <span style="font-family:var(--font-heading); font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted);">
          Sub-Assessment Section Progression (Complete One Section &rarr; Move to Next)
        </span>
        <span class="badge badge-primary">Active: ${escapeHtml(activeSecName)}</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:0.65rem;">
        ${sections.map((sec, idx) => {
          const isActive = sec.name === activeSecName;
          const pct = sec.total > 0 ? Math.round((sec.answered / sec.total) * 100) : 0;
          return `
            <button
              type="button"
              class="btn-step-section"
              data-target-idx="${sec.indices[0] || 0}"
              data-sec-name="${escapeHtml(sec.name)}"
              style="text-align:left; cursor:${sec.is_unlocked || sec.is_submitted ? 'pointer' : 'not-allowed'}; padding:0.65rem 0.85rem; border-radius:var(--radius-md); background:${isActive ? 'var(--primary-light)' : (sec.is_submitted ? 'var(--surface-accent)' : 'var(--surface-subtle)')}; border:2px solid ${isActive ? 'var(--brand-lime)' : (sec.is_submitted ? 'var(--success-border)' : (sec.is_unlocked ? 'var(--border)' : 'rgba(255,255,255,0.08)'))}; opacity:${sec.is_unlocked || sec.is_submitted ? '1' : '0.65'}; transition:all 0.15s ease;"
            >
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <span style="font-family:var(--font-heading); font-weight:800; font-size:0.82rem; color:var(--text-main);">
                  ${idx + 1}. ${escapeHtml(sec.name)}
                </span>
                <span class="badge ${sec.is_submitted ? 'badge-success' : (!sec.is_unlocked ? 'badge-warning' : (isActive ? 'badge-primary' : 'badge-neutral'))}" style="font-size:0.68rem;">
                  ${sec.is_submitted ? `&#x2714; Submitted (${sec.percentage ?? 0}%)` : (!sec.is_unlocked ? '&#x1F512; Locked' : (isActive ? 'Active' : `${sec.answered}/${sec.total}`))}
                </span>
              </div>
              <div style="height:5px; background:var(--border); border-radius:var(--radius-full); overflow:hidden;">
                <div style="height:100%; width:${sec.is_submitted ? 100 : pct}%; background:${sec.is_submitted ? 'var(--success)' : (sec.is_unlocked ? 'var(--brand-lime)' : 'var(--text-muted)')}; transition:width 0.25s ease;"></div>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    `;

    stepperEl.querySelectorAll('.btn-step-section').forEach(btn => {
      btn.onclick = async () => {
        const targetIdx = parseInt(btn.dataset.targetIdx, 10);
        const targetSecName = btn.dataset.secName;
        let targetSecObj = sections.find(s => s.name === targetSecName);
        if (targetSecObj && !targetSecObj.is_unlocked && !targetSecObj.is_submitted) {
          try {
            const status = await api.getAttemptUnlockStatus(currentAttempt.id);
            currentAttempt.unlocked_sections = status.unlocked_sections || ['Section 1'];
            (currentAttempt.questions || []).forEach(q => {
              if (currentAttempt.unlocked_sections.includes(q.section_name || 'Section 1')) {
                q.is_locked = false;
              }
            });
          } catch (_) {}
          const refreshedSecs = getDistinctSections();
          targetSecObj = refreshedSecs.find(s => s.name === targetSecName);
          if (targetSecObj && !targetSecObj.is_unlocked && !targetSecObj.is_submitted) {
            openSectionLockedModal(targetSecName);
            return;
          }
        }
        if (targetSecName !== activeSecName) {
          await attemptTransitionToQuestion(targetIdx, activeSecName, targetSecName);
        } else {
          activeQuestionIndex = targetIdx;
          renderQuestion(activeQuestionIndex);
          renderPalette();
        }
      };
    });
  }

  function renderPalette() {
    renderSectionStepper();
    const palette = viewContainer.querySelector('#nav-palette');
    const sections = getDistinctSections();
    const activeQ = currentAttempt.questions[activeQuestionIndex];
    const activeSecName = activeQ?.section_name || 'Section 1';

    palette.style.display = 'flex';
    palette.style.flexDirection = 'column';
    palette.style.gap = '0.85rem';

    palette.innerHTML = sections.map((sec, sIdx) => `
      <div style="border:1px solid ${sec.name === activeSecName ? 'var(--brand-lime)' : (sec.is_submitted ? 'var(--success-border)' : 'var(--border)')}; border-radius:var(--radius-md); padding:0.6rem; background:${sec.name === activeSecName ? 'var(--surface-accent)' : 'var(--surface-subtle)'}; opacity:${sec.is_unlocked || sec.is_submitted ? '1' : '0.7'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem; font-size:0.75rem; font-family:var(--font-heading); font-weight:800;">
          <span>${sIdx + 1}. ${escapeHtml(sec.name)}</span>
          <span style="font-size:0.7rem; color:${sec.is_submitted ? 'var(--success)' : (!sec.is_unlocked ? 'var(--warning)' : 'var(--text-muted)')};">
            ${sec.is_submitted ? `&#x2714; Submitted (${sec.percentage ?? 0}%)` : (!sec.is_unlocked ? '&#x1F512; Locked' : `${sec.answered}/${sec.total}`)}
          </span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:0.4rem;">
          ${sec.indices.map(idx => {
            const q = currentAttempt.questions[idx];
            const isAnswered = q.saved_answer !== null && q.saved_answer !== undefined && q.saved_answer !== '' && (typeof q.saved_answer !== 'object' || Object.keys(q.saved_answer).length > 0);
            const isCurrent = idx === activeQuestionIndex;
            const classes = ['palette-btn'];

            if (isCurrent) classes.push('active');
            if (sec.is_submitted) {
              classes.push(q.is_correct ? 'correct' : 'incorrect');
            } else if (isAnswered) {
              classes.push('answered');
            }
            if (q.is_flagged && !sec.is_submitted) classes.push('flagged');

            return `<button type="button" class="${classes.join(' ')}" data-idx="${idx}" data-sec="${escapeHtml(sec.name)}" ${!sec.is_unlocked && !sec.is_submitted ? 'disabled style="cursor:not-allowed; opacity:0.5;"' : ''}>${!sec.is_unlocked && !sec.is_submitted ? '&#x1F512;' : (idx + 1)}</button>`;
          }).join('')}
        </div>
      </div>
    `).join('');

    palette.querySelectorAll('.palette-btn').forEach(btn => {
      btn.onclick = async () => {
        const targetIdx = parseInt(btn.dataset.idx, 10);
        const targetSec = btn.dataset.sec;
        let targetSecObj = sections.find(s => s.name === targetSec);
        if (targetSecObj && !targetSecObj.is_unlocked && !targetSecObj.is_submitted) {
          try {
            const status = await api.getAttemptUnlockStatus(currentAttempt.id);
            currentAttempt.unlocked_sections = status.unlocked_sections || ['Section 1'];
            (currentAttempt.questions || []).forEach(q => {
              if (currentAttempt.unlocked_sections.includes(q.section_name || 'Section 1')) {
                q.is_locked = false;
              }
            });
          } catch (_) {}
          const refreshedSecs = getDistinctSections();
          targetSecObj = refreshedSecs.find(s => s.name === targetSec);
          if (targetSecObj && !targetSecObj.is_unlocked && !targetSecObj.is_submitted) {
            openSectionLockedModal(targetSec);
            return;
          }
        }
        if (targetSec !== activeSecName) {
          await attemptTransitionToQuestion(targetIdx, activeSecName, targetSec);
        } else {
          // ENFORCE REQUIRED: If jumping forward in active unsubmitted section, ensure no preceding question is unanswered
          if (!targetSecObj.is_submitted && targetIdx > activeQuestionIndex) {
            const firstUnanswered = targetSecObj.indices.find(i => !isQuestionAnswered(currentAttempt.questions[i]));
            if (firstUnanswered !== undefined && firstUnanswered < targetIdx) {
              showRequiredQuestionWarning(`Question ${firstUnanswered + 1} is required. Please answer all questions in order.`);
              if (activeQuestionIndex !== firstUnanswered) {
                activeQuestionIndex = firstUnanswered;
                renderQuestion(activeQuestionIndex);
                renderPalette();
              }
              return;
            }
          }
          activeQuestionIndex = targetIdx;
          renderQuestion(activeQuestionIndex);
          renderPalette();
        }
      };
    });
  }

  function renderQuestion(idx) {
    const q = currentAttempt.questions[idx];
    const area = viewContainer.querySelector('#question-display-area');
    const prevBtn = viewContainer.querySelector('#btn-prev-q');
    const nextBtn = viewContainer.querySelector('#btn-next-q');

    const sections = getDistinctSections();
    const currSec = sections.find(s => s.name === (q.section_name || 'Section 1')) || sections[0];
    const posInSec = currSec ? currSec.indices.indexOf(idx) + 1 : idx + 1;
    const totalInSec = currSec ? currSec.total : currentAttempt.questions.length;

    const isSecSubmitted = Boolean(currSec.is_submitted);
    const isSecUnlocked = Boolean(currSec.is_unlocked);
    const isQuestionLocked = (!isSecUnlocked && !isSecSubmitted) || Boolean(q.is_locked);

    // If section or question is locked, show locked placeholder and prevent answering
    if (isQuestionLocked) {
      prevBtn.disabled = idx === 0 || !currentAttempt.allow_back_navigation;
      nextBtn.disabled = true;
      nextBtn.textContent = '🔒 Section Locked by Instructor';

      area.innerHTML = `
        <div class="card" style="text-align:center; padding:3rem 1.5rem; border:2px dashed var(--warning); background:var(--surface-subtle); margin:1.5rem 0; border-radius:var(--radius-lg);">
          <div style="font-size:3rem; margin-bottom:0.75rem;">🔒</div>
          <h3 style="font-family:var(--font-heading); font-weight:800; font-size:1.35rem; margin-bottom:0.5rem; color:var(--text-main);">
            ${escapeHtml(currSec.name)} is Locked
          </h3>
          <p style="color:var(--text-muted); max-width:520px; margin:0 auto 1.5rem auto; font-size:0.95rem; line-height:1.5;">
            This section is currently locked by your instructor. Please wait for the group review discussion to finish before proceeding.
          </p>
          <div style="display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary" id="btn-return-unlocked-q">
              ← Return to Previous Section
            </button>
            <button type="button" class="btn btn-primary" id="btn-poll-unlock-q">
              Check Unlock Status
            </button>
          </div>
        </div>
      `;

      const returnBtn = area.querySelector('#btn-return-unlocked-q');
      if (returnBtn) {
        returnBtn.onclick = () => {
          const prevSec = sections.slice(0, currSec.section_index).reverse().find(s => s.is_submitted || s.is_unlocked);
          if (prevSec && prevSec.indices.length > 0) {
            activeQuestionIndex = prevSec.indices[0];
            renderQuestion(activeQuestionIndex);
            renderPalette();
          } else {
            activeQuestionIndex = 0;
            renderQuestion(0);
            renderPalette();
          }
        };
      }

      const pollBtn = area.querySelector('#btn-poll-unlock-q');
      if (pollBtn) {
        pollBtn.onclick = () => {
          handleGoToNextSection(currSec.name);
        };
      }

      return;
    }

    const nextQ = idx < currentAttempt.questions.length - 1 ? currentAttempt.questions[idx + 1] : null;
    const isLastInSection = nextQ && (nextQ.section_name || 'Section 1') !== (q.section_name || 'Section 1');

    prevBtn.disabled = idx === 0 || !currentAttempt.allow_back_navigation;

    const nextSecObj = sections.find(s => s.section_index === currSec.section_index + 1);

    if (!isSecSubmitted) {
      if (idx === currentAttempt.questions.length - 1) {
        nextBtn.textContent = `Submit ${q.section_name || 'Final Section'} for Review →`;
      } else if (isLastInSection) {
        nextBtn.textContent = `Submit ${q.section_name || 'Section'} for Review →`;
      } else {
        nextBtn.textContent = 'Next Question →';
      }
    } else {
      // Completed / submitted section
      if (idx === currentAttempt.questions.length - 1) {
        nextBtn.textContent = 'End & View Results →';
      } else if (isLastInSection && nextSecObj) {
        nextBtn.textContent = `Go to ${nextSecObj.name} →`;
      } else {
        nextBtn.textContent = 'Next Question →';
      }
    }

    updateFlagButton(q.is_flagged);

    area.innerHTML = `
      <!-- Section Review Mode Banner if Submitted -->
      ${isSecSubmitted ? `
        <div class="card" style="background:var(--surface-subtle); border:1px solid var(--border); border-left:4px solid ${q.is_correct ? 'var(--brand-lime)' : 'var(--danger)'}; padding:0.85rem 1.15rem; margin-bottom:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.65rem;">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <span style="font-weight:800; font-family:var(--font-heading); font-size:1rem; color:var(--text-main);">
                  &#x2714; ${escapeHtml(q.section_name || 'Section 1')} Review
                </span>
                <span class="badge ${q.is_correct ? 'badge-success' : 'badge-danger'}" style="font-size:0.825rem; font-weight:800; padding:0.25rem 0.65rem;">
                  ${q.is_correct ? '&#x2714; CORRECT (+1 pt)' : '&#x2718; INCORRECT (0 pts)'}
                </span>
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">
                Question ${posInSec} of ${totalInSec} &bull; Section score: ${currSec.score ?? 0}/${currSec.max_score ?? currSec.total} (${currSec.percentage ?? 0}%)
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              ${nextSecObj ? `
                <button type="button" class="btn btn-primary btn-sm btn-header-go-next" data-next-sec="${escapeHtml(nextSecObj.name)}" style="font-weight:800; font-size:0.8rem; background:var(--brand-lime); color:#000;">
                  Go to ${escapeHtml(nextSecObj.name)} &rarr;
                </button>
              ` : `
                <button type="button" class="btn btn-primary btn-sm btn-header-view-results" style="font-weight:800; font-size:0.8rem;">
                  View Final Results &rarr;
                </button>
              `}
            </div>
          </div>
        </div>
      ` : ''}

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem; padding-bottom:0.75rem; border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <span class="badge ${isSecSubmitted ? 'badge-success' : 'badge-primary'}" style="font-weight:800;">
            ${escapeHtml(q.section_name || 'Section 1')} (${posInSec} of ${totalInSec}) ${isSecSubmitted ? '&#x2714; Submitted' : ''}
          </span>
          <span class="badge badge-neutral">Overall Question ${idx + 1} of ${currentAttempt.questions.length}</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <span class="badge badge-neutral">${q.question_type.toUpperCase().replace(/_/g, ' ')} &bull; ${q.max_points || 1} pt(s)</span>
          ${!isSecSubmitted ? `
            <span class="badge badge-warning" style="font-weight:800; font-size:0.75rem;">
              <span style="color:var(--danger); font-size:1rem; line-height:0.8; vertical-align:middle;">*</span> Required
            </span>
            <button type="button" class="btn btn-primary btn-sm" id="btn-submit-active-sec" style="font-weight:700;">
              &#x2714; Submit ${escapeHtml(q.section_name || 'Section')} for Review
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Required Question Warning Banner -->
      <div id="required-question-warning-banner" style="display:none; margin-bottom:1rem; padding:0.75rem 1rem; border-radius:var(--radius-md); background:rgba(220,38,38,0.1); border:1px solid var(--danger); color:var(--danger); font-weight:700; font-size:0.875rem; align-items:center; gap:0.5rem;">
        <span style="font-size:1.15rem;">⚠️</span>
        <span id="required-warning-text">Please answer this question before continuing to the next question. All questions are required.</span>
      </div>

      <!-- Question Description Box (Scenario / Case Study) -->
      ${q.question_description ? `
        <div class="question-description-box">
          <h4>Scenario & Reference Material</h4>
          <div style="white-space:pre-wrap;">${escapeHtml(q.question_description)}</div>
        </div>
      ` : ''}

      <!-- Question Text -->
      <div style="font-weight:700; font-size:1.15rem; color:var(--text-main); margin-bottom:1.5rem;">
        ${escapeHtml(q.question_text)}
      </div>

      <!-- Interactive Answer Area -->
      <div id="interactive-answer-area">
        ${renderInteractiveInput(q, isSecSubmitted, isQuestionLocked)}
      </div>

      <!-- Revealed Explanation & Correct Answer in Review Mode -->
      ${isSecSubmitted && q.correct_answer !== undefined && q.correct_answer !== null ? `
        <div style="margin-top:1.25rem; padding:1rem; background:var(--surface-subtle); border-radius:var(--radius-md); border-left:4px solid var(--success); font-size:0.875rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="font-weight:700; color:var(--success);">&#x2714; Correct Answer:</span>
            <span class="badge badge-neutral" style="font-size:0.7rem;">Instructor Discussion Reference</span>
          </div>
          <div style="font-family:monospace; font-size:0.9rem; padding:0.4rem 0.6rem; background:var(--surface); border-radius:var(--radius-sm); border:1px solid var(--border); margin-bottom:0.5rem;">
            ${escapeHtml(formatAnswerDisplay(q.correct_answer, q))}
          </div>
          ${q.answer_explanation ? `
            <div style="padding-top:0.5rem; border-top:1px dashed var(--border); color:var(--text-main); font-size:0.825rem; line-height:1.45;">
              <strong>Instructor Note / Explanation:</strong> ${escapeHtml(q.answer_explanation)}
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;

    const submitActiveSecBtn = area.querySelector('#btn-submit-active-sec');
    if (submitActiveSecBtn) {
      submitActiveSecBtn.onclick = () => openSectionSubmitModal(q.section_name);
    }

    const headerGoNext = area.querySelector('.btn-header-go-next');
    if (headerGoNext) {
      headerGoNext.onclick = () => handleGoToNextSection(headerGoNext.dataset.nextSec);
    }
    const headerViewResults = area.querySelector('.btn-header-view-results');
    if (headerViewResults) {
      headerViewResults.onclick = () => renderResultsScreen();
    }

    attachInputHandlers(q, isSecSubmitted, isQuestionLocked);
  }

  function renderInteractiveInput(q, isSecSubmitted = false, isQuestionLocked = false) {
    const isLocked = Boolean(isSecSubmitted) || Boolean(isQuestionLocked) || Boolean(q.is_locked);
    const type = q.question_type;
    const saved = q.saved_answer;

    if (type === 'yes_no' || type === 'true_false') {
      const options = type === 'yes_no' ? ['Yes', 'No'] : ['True', 'False'];
      const correctVal = String(q.correct_answer || '').trim();
      return `
        <div class="options-grid">
          ${options.map(opt => {
            const isUserChoice = saved === opt;
            const isCorrectOption = isSecSubmitted && correctVal.toLowerCase() === opt.toLowerCase();
            let cardClass = '';
            let badgeHtml = '';
            if (isSecSubmitted) {
              if (isUserChoice && isCorrectOption) {
                cardClass = 'review-correct';
                badgeHtml = '<span class="badge badge-success" style="margin-left:auto; font-size:0.75rem;">&#x2714; Your Answer (Correct)</span>';
              } else if (isUserChoice && !isCorrectOption) {
                cardClass = 'review-incorrect';
                badgeHtml = '<span class="badge badge-danger" style="margin-left:auto; font-size:0.75rem;">&#x2718; Your Answer (Incorrect)</span>';
              } else if (!isUserChoice && isCorrectOption) {
                cardClass = 'review-missed';
                badgeHtml = '<span class="badge badge-success" style="margin-left:auto; font-size:0.75rem;">&#x2714; Correct Answer</span>';
              }
            } else if (isUserChoice) {
              cardClass = 'selected';
            }
            return `
              <label class="option-card ${cardClass}" ${isLocked ? 'style="pointer-events:none;"' : ''}>
                <input type="radio" name="active_radio" value="${opt}" ${isUserChoice ? 'checked' : ''} ${isLocked ? 'disabled style="pointer-events:none;"' : ''}>
                <span style="font-size:1rem; font-weight:600;">${opt}</span>
                ${badgeHtml}
              </label>
            `;
          }).join('')}
        </div>
      `;
    }

    if (type === 'single_choice' || type === 'scenario' || type === 'case_study') {
      const correctVal = String(q.correct_answer || '').trim();
      return `
        <div class="options-grid">
          ${(q.answer_options || []).map(opt => {
            const isUserChoice = saved === opt.id || String(saved) === String(opt.id);
            const isCorrectOption = isSecSubmitted && (correctVal === opt.id || correctVal === opt.text || String(correctVal) === String(opt.id));
            let cardClass = '';
            let badgeHtml = '';
            if (isSecSubmitted) {
              if (isUserChoice && isCorrectOption) {
                cardClass = 'review-correct';
                badgeHtml = '<span class="badge badge-success" style="margin-left:auto; font-size:0.75rem; font-weight:700;">&#x2714; Your Answer (Correct)</span>';
              } else if (isUserChoice && !isCorrectOption) {
                cardClass = 'review-incorrect';
                badgeHtml = '<span class="badge badge-danger" style="margin-left:auto; font-size:0.75rem; font-weight:700;">&#x2718; Your Answer (Incorrect)</span>';
              } else if (!isUserChoice && isCorrectOption) {
                cardClass = 'review-missed';
                badgeHtml = '<span class="badge badge-success" style="margin-left:auto; font-size:0.75rem; font-weight:700;">&#x2714; Correct Answer</span>';
              }
            } else if (isUserChoice) {
              cardClass = 'selected';
            }
            return `
              <label class="option-card ${cardClass}" ${isLocked ? 'style="pointer-events:none;"' : ''}>
                <input type="radio" name="active_radio" value="${escapeHtml(opt.id)}" ${isUserChoice ? 'checked' : ''} ${isLocked ? 'disabled style="pointer-events:none;"' : ''}>
                <span>${escapeHtml(opt.text)}</span>
                ${badgeHtml}
              </label>
            `;
          }).join('')}
        </div>
      `;
    }

    if (type === 'multiple_response') {
      const selected = Array.isArray(saved) ? saved.map(String) : [];
      let correctArr = [];
      if (Array.isArray(q.correct_answer)) {
        correctArr = q.correct_answer.map(String);
      } else if (typeof q.correct_answer === 'string') {
        try {
          const parsed = JSON.parse(q.correct_answer);
          if (Array.isArray(parsed)) correctArr = parsed.map(String);
          else correctArr = [q.correct_answer];
        } catch (_) {
          correctArr = [q.correct_answer];
        }
      }
      return `
        <p class="form-hint" style="margin-bottom:0.75rem;">${isSecSubmitted ? 'Review: Options selected vs correct options:' : 'Select all that apply:'}</p>
        <div class="options-grid">
          ${(q.answer_options || []).map(opt => {
            const optIdStr = String(opt.id);
            const isUserChoice = selected.includes(optIdStr);
            const isCorrectOption = isSecSubmitted && (correctArr.includes(optIdStr) || correctArr.includes(opt.text));
            let cardClass = '';
            let badgeHtml = '';
            if (isSecSubmitted) {
              if (isUserChoice && isCorrectOption) {
                cardClass = 'review-correct';
                badgeHtml = '<span class="badge badge-success" style="margin-left:auto; font-size:0.75rem; font-weight:700;">&#x2714; Your Answer (Correct)</span>';
              } else if (isUserChoice && !isCorrectOption) {
                cardClass = 'review-incorrect';
                badgeHtml = '<span class="badge badge-danger" style="margin-left:auto; font-size:0.75rem; font-weight:700;">&#x2718; Your Answer (Incorrect)</span>';
              } else if (!isUserChoice && isCorrectOption) {
                cardClass = 'review-missed';
                badgeHtml = '<span class="badge badge-success" style="margin-left:auto; font-size:0.75rem; font-weight:700;">&#x2714; Correct Option</span>';
              }
            } else if (isUserChoice) {
              cardClass = 'selected';
            }
            return `
              <label class="option-card ${cardClass}" ${isLocked ? 'style="pointer-events:none;"' : ''}>
                <input type="checkbox" class="cb-multi" value="${escapeHtml(opt.id)}" ${isUserChoice ? 'checked' : ''} ${isLocked ? 'disabled style="pointer-events:none;"' : ''}>
                <span>${escapeHtml(opt.text)}</span>
                ${badgeHtml}
              </label>
            `;
          }).join('')}
        </div>
      `;
    }

    if (type === 'matching') {
      const studentMap = (typeof saved === 'object' && saved !== null && !Array.isArray(saved)) ? { ...saved } : {};
      let opts = q.answer_options;
      if (typeof opts === 'string') {
        try { opts = JSON.parse(opts); } catch (_) { opts = {}; }
      }

      let sourceTitle = 'Storage service';
      let targetTitle = 'Answer Area';
      let sources = [];
      let targets = [];

      if (opts && typeof opts === 'object' && !Array.isArray(opts) && (opts.sources || opts.targets)) {
        sourceTitle = opts.source_title || 'Storage service';
        targetTitle = opts.target_title || 'Answer Area';
        sources = Array.isArray(opts.sources) ? opts.sources : [];
        targets = Array.isArray(opts.targets) ? opts.targets : [];
      } else if (Array.isArray(opts) && opts.length > 0) {
        sourceTitle = 'Options';
        targetTitle = 'Answer Area';
        sources = opts.map((p, idx) => ({ id: 'src_' + idx, text: p.left || '' }));
        targets = opts.map((p, idx) => ({ id: 'tgt_' + idx, text: p.right || '' }));
      }

      return `
        <div class="ms-drag-container">
          <div class="ms-drag-header-badge">DRAG DROP</div>
          <div style="font-size:0.95rem; font-weight:600; color:var(--text-main); margin-bottom:0.35rem;">
            Match each item on the left to its appropriate description on the right.
          </div>
          <div style="font-size:0.875rem; color:var(--text-muted); line-height:1.45; margin-bottom:0.25rem;">
            To answer, drag the appropriate item from the column on the left to its description in the Answer Area on the right, or click an item on the left and then click a drop slot. Each item may be used once, more than once, or not at all.
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted); font-style:italic; margin-bottom:1rem;">
            NOTE: Each correct match is worth one point.
          </div>

          <div class="ms-drag-board">
            <!-- Left Column: Source Draggable Pool -->
            <div class="ms-drag-pool">
              <div class="ms-drag-column-title">${escapeHtml(sourceTitle)}</div>
              <div id="ms-drag-sources-container">
                ${sources.map(s => `
                  <div class="ms-drag-card" ${isLocked ? 'draggable="false" style="cursor:not-allowed; opacity:0.6; pointer-events:none;"' : 'draggable="true"'} data-source-id="${escapeHtml(s.id)}" data-source-text="${escapeHtml(s.text)}" tabindex="0" role="button" aria-label="Draggable option: ${escapeHtml(s.text)}" title="${isLocked ? 'Locked' : 'Drag or click to select'}">
                    <span>${escapeHtml(s.text)}</span>
                    <span style="color:#00a4ef; font-size:0.85rem; opacity:0.8;">&#x283f;</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Divider -->
            <div class="ms-drag-divider"></div>

            <!-- Right Column: Answer Area Targets -->
            <div class="ms-drag-answer-area">
              <div class="ms-drag-column-title">${escapeHtml(targetTitle)}</div>
              <div id="ms-drag-targets-container">
                ${targets.map(t => {
                  const targetVal = studentMap[t.id] !== undefined ? studentMap[t.id] : studentMap[t.text];
                  let matchedSource = sources.find(s => s.id === targetVal || s.text === targetVal);
                  let filledText = matchedSource ? matchedSource.text : (targetVal || '');
                  const isFilled = Boolean(filledText);

                  return `
                    <div class="ms-drag-target-row" data-target-id="${escapeHtml(t.id)}">
                      <div class="ms-drag-dropzone ${isFilled ? 'filled' : 'empty'}" data-target-id="${escapeHtml(t.id)}" tabindex="0" role="region" aria-label="Drop slot for ${escapeHtml(t.text)}" title="${isFilled ? 'Filled: ' + escapeHtml(filledText) : 'Drop here'}" ${isLocked ? 'style="pointer-events:none;"' : ''}>
                        ${isFilled ? `
                          <div class="dz-filled-content">
                            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${escapeHtml(filledText)}</span>
                            ${isLocked ? '' : `<button type="button" class="btn-clear-dz" data-target-id="${escapeHtml(t.id)}" title="Clear slot">&times;</button>`}
                          </div>
                        ` : `
                          <span class="dz-placeholder">Drop here</span>
                        `}
                      </div>
                      <div class="ms-drag-target-text">
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

    if (type === 'ordering') {
      const studentSeq = Array.isArray(saved) && saved.length ? saved : (q.answer_options || []).map(st => st.id);
      const itemsMap = Object.fromEntries((q.answer_options || []).map(st => [st.id, st.text]));

      return `
        <p class="form-hint" style="margin-bottom:0.75rem;">Arrange the steps into the correct chronological order:</p>
        <div id="ordering-list" style="display:flex; flex-direction:column; gap:0.5rem;">
          ${studentSeq.map((id, pos) => `
            <div class="dnd-card" data-id="${id}">
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <span class="badge badge-neutral order-num" style="font-weight:700;">${pos + 1}</span>
                <span>${escapeHtml(itemsMap[id] || id)}</span>
              </div>
              <div class="accessible-action-btns">
                <button type="button" class="btn btn-secondary btn-sm btn-order-up" data-pos="${pos}" ${pos === 0 || isLocked ? 'disabled style="pointer-events:none;"' : ''}>&uarr;</button>
                <button type="button" class="btn btn-secondary btn-sm btn-order-down" data-pos="${pos}" ${pos === studentSeq.length - 1 || isLocked ? 'disabled style="pointer-events:none;"' : ''}>&darr;</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (type === 'fill_blank') {
      return `
        <div class="form-group" style="max-width:420px; margin-top:1rem;">
          <label class="form-label">Your Answer:</label>
          <input type="text" id="input-fill-blank" class="form-control" value="${escapeHtml(saved || '')}" placeholder="Type your answer here..." autocomplete="off" ${isLocked ? 'disabled readonly style="pointer-events:none; opacity:0.65;"' : ''}>
        </div>
      `;
    }

    if (type === 'hot_area') {
      return `
        <p class="form-hint" style="margin-bottom:0.75rem;">Select the correct component / region:</p>
        <div style="display:flex; flex-wrap:wrap; gap:0.75rem;">
          ${(q.answer_options || []).map(r => `
            <button type="button" class="btn ${saved === r.id ? 'btn-primary' : 'btn-secondary'} btn-hot-region" data-id="${r.id}" style="padding:0.75rem 1.25rem; ${isLocked ? 'pointer-events:none; opacity:0.65;' : ''}" ${isLocked ? 'disabled' : ''}>
              ${escapeHtml(r.label)}
            </button>
          `).join('')}
        </div>
      `;
    }

    if (type === 'hotspot') {
      const studentMap = (typeof saved === 'object' && saved !== null && !Array.isArray(saved)) ? saved : {};
      const statements = Array.isArray(q.answer_options) ? q.answer_options : [];

      return `
        <div class="hotspot-area" style="border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; background:var(--surface); margin-top:0.75rem;">
          <div style="padding:0.75rem 1.25rem; background:var(--surface-subtle); border-bottom:1px solid var(--border); font-weight:800; font-family:var(--font-heading); display:flex; justify-content:space-between; align-items:center;">
            <span>Hot Area: Answer Area</span>
            <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">Select Yes or No for each statement</span>
          </div>
          <div class="table-container" style="border:none; margin:0;">
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
                  const currentVal = studentMap[sId] || '';
                  return `
                    <tr style="border-bottom:1px solid var(--border);">
                      <td style="padding:1rem 1.25rem; font-size:0.95rem; line-height:1.5;">${escapeHtml(sText)}</td>
                      <td style="text-align:center; vertical-align:middle; ${isLocked ? 'pointer-events:none;' : 'cursor:pointer;'}" ${isLocked ? '' : `onclick="this.querySelector('input').click()"`}>
                        <label style="display:inline-flex; align-items:center; justify-content:center; width:100%; height:100%; margin:0; ${isLocked ? 'pointer-events:none;' : 'cursor:pointer;'}" title="Yes">
                          <input type="radio" class="hotspot-radio" name="hotspot_${escapeHtml(sId)}" data-stmt="${escapeHtml(sId)}" value="Yes" ${currentVal === 'Yes' ? 'checked' : ''} ${isLocked ? 'disabled style="pointer-events:none;"' : ''} style="width:1.25rem; height:1.25rem; accent-color:var(--brand-magenta); cursor:pointer;">
                        </label>
                      </td>
                      <td style="text-align:center; vertical-align:middle; ${isLocked ? 'pointer-events:none;' : 'cursor:pointer;'}" ${isLocked ? '' : `onclick="this.querySelector('input').click()"`}>
                        <label style="display:inline-flex; align-items:center; justify-content:center; width:100%; height:100%; margin:0; ${isLocked ? 'pointer-events:none;' : 'cursor:pointer;'}" title="No">
                          <input type="radio" class="hotspot-radio" name="hotspot_${escapeHtml(sId)}" data-stmt="${escapeHtml(sId)}" value="No" ${currentVal === 'No' ? 'checked' : ''} ${isLocked ? 'disabled style="pointer-events:none;"' : ''} style="width:1.25rem; height:1.25rem; accent-color:var(--brand-magenta); cursor:pointer;">
                        </label>
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

    return `
      <div class="form-group">
        <textarea id="generic-input" class="form-control" placeholder="Enter answer..." ${isLocked ? 'disabled readonly style="pointer-events:none; opacity:0.65;"' : ''}>${escapeHtml(saved ? JSON.stringify(saved) : '')}</textarea>
      </div>
    `;
  }

  function attachInputHandlers(q, isSecSubmitted = false, isQuestionLocked = false) {
    if (isSecSubmitted || isQuestionLocked || Boolean(q.is_locked)) return;
    const area = viewContainer.querySelector('#interactive-answer-area');

    // Single choice / Yes-No / True-False
    area.querySelectorAll('input[name="active_radio"]').forEach(r => {
      r.onchange = () => {
        q.saved_answer = r.value;
        triggerAutosave(q.id, q.saved_answer, q.is_flagged);
        renderPalette();
        renderQuestion(activeQuestionIndex);
      };
    });

    // Multiple response
    area.querySelectorAll('.cb-multi').forEach(cb => {
      cb.onchange = () => {
        const checked = [];
        area.querySelectorAll('.cb-multi:checked').forEach(c => checked.push(c.value));
        q.saved_answer = checked;
        triggerAutosave(q.id, q.saved_answer, q.is_flagged);
        renderPalette();
        renderQuestion(activeQuestionIndex);
      };
    });

    // Matching selects (legacy compatibility)
    area.querySelectorAll('.matching-select').forEach(sel => {
      sel.onchange = () => {
        const map = (typeof q.saved_answer === 'object' && q.saved_answer !== null) ? { ...q.saved_answer } : {};
        map[sel.dataset.left] = sel.value;
        q.saved_answer = map;
        triggerAutosave(q.id, q.saved_answer, q.is_flagged);
        renderPalette();
      };
    });

    // Microsoft DRAG DROP: Drag and Drop & Click-to-Place handlers
    let activeSelectedSource = null;

    area.querySelectorAll('.ms-drag-card').forEach(card => {
      // HTML5 Dragstart
      card.ondragstart = (e) => {
        const sourceId = card.dataset.sourceId;
        const sourceText = card.dataset.sourceText;
        e.dataTransfer.setData('text/plain', sourceId);
        try {
          e.dataTransfer.setData('application/json', JSON.stringify({ id: sourceId, text: sourceText }));
        } catch (_) {}
        e.dataTransfer.effectAllowed = 'copyMove';
        card.classList.add('dragging');
      };

      card.ondragend = () => {
        card.classList.remove('dragging');
      };

      // Click / Tap to select source
      card.onclick = () => {
        const sourceId = card.dataset.sourceId;
        if (activeSelectedSource === sourceId) {
          activeSelectedSource = null;
          card.classList.remove('selected-source');
        } else {
          area.querySelectorAll('.ms-drag-card').forEach(c => c.classList.remove('selected-source'));
          activeSelectedSource = sourceId;
          card.classList.add('selected-source');
        }
      };
    });

    area.querySelectorAll('.ms-drag-dropzone').forEach(dz => {
      dz.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        dz.classList.add('drag-over');
      };

      dz.ondragleave = () => {
        dz.classList.remove('drag-over');
      };

      dz.ondrop = (e) => {
        e.preventDefault();
        dz.classList.remove('drag-over');
        const sourceId = e.dataTransfer.getData('text/plain');
        if (!sourceId) return;

        const targetId = dz.dataset.targetId;
        const map = (typeof q.saved_answer === 'object' && q.saved_answer !== null && !Array.isArray(q.saved_answer)) ? { ...q.saved_answer } : {};
        map[targetId] = sourceId;
        q.saved_answer = map;
        triggerAutosave(q.id, q.saved_answer, q.is_flagged);
        renderPalette();
        renderQuestion(activeQuestionIndex);
      };

      // Click to place active selection
      dz.onclick = (e) => {
        if (e.target.classList.contains('btn-clear-dz')) return;
        if (activeSelectedSource) {
          const targetId = dz.dataset.targetId;
          const map = (typeof q.saved_answer === 'object' && q.saved_answer !== null && !Array.isArray(q.saved_answer)) ? { ...q.saved_answer } : {};
          map[targetId] = activeSelectedSource;
          q.saved_answer = map;
          activeSelectedSource = null;
          triggerAutosave(q.id, q.saved_answer, q.is_flagged);
          renderPalette();
          renderQuestion(activeQuestionIndex);
        }
      };
    });

    // Clear dropzone button
    area.querySelectorAll('.btn-clear-dz').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const targetId = btn.dataset.targetId;
        const map = (typeof q.saved_answer === 'object' && q.saved_answer !== null && !Array.isArray(q.saved_answer)) ? { ...q.saved_answer } : {};
        delete map[targetId];
        q.saved_answer = map;
        triggerAutosave(q.id, q.saved_answer, q.is_flagged);
        renderPalette();
        renderQuestion(activeQuestionIndex);
      };
    });

    // Ordering buttons
    area.querySelectorAll('.btn-order-up').forEach(btn => {
      btn.onclick = () => {
        const pos = parseInt(btn.dataset.pos, 10);
        const seq = Array.isArray(q.saved_answer) && q.saved_answer.length ? [...q.saved_answer] : (q.answer_options || []).map(st => st.id);
        if (pos > 0) {
          const temp = seq[pos];
          seq[pos] = seq[pos - 1];
          seq[pos - 1] = temp;
          q.saved_answer = seq;
          triggerAutosave(q.id, q.saved_answer, q.is_flagged);
          renderPalette();
          renderQuestion(activeQuestionIndex);
        }
      };
    });

    area.querySelectorAll('.btn-order-down').forEach(btn => {
      btn.onclick = () => {
        const pos = parseInt(btn.dataset.pos, 10);
        const seq = Array.isArray(q.saved_answer) && q.saved_answer.length ? [...q.saved_answer] : (q.answer_options || []).map(st => st.id);
        if (pos < seq.length - 1) {
          const temp = seq[pos];
          seq[pos] = seq[pos + 1];
          seq[pos + 1] = temp;
          q.saved_answer = seq;
          triggerAutosave(q.id, q.saved_answer, q.is_flagged);
          renderPalette();
          renderQuestion(activeQuestionIndex);
        }
      };
    });

    // Fill in the blank
    const fillInput = area.querySelector('#input-fill-blank');
    if (fillInput) {
      fillInput.oninput = () => {
        q.saved_answer = fillInput.value;
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(() => {
          triggerAutosave(q.id, q.saved_answer, q.is_flagged);
          renderPalette();
        }, 500);
      };
    }

    // Hot area
    area.querySelectorAll('.btn-hot-region').forEach(btn => {
      btn.onclick = () => {
        q.saved_answer = btn.dataset.id;
        triggerAutosave(q.id, q.saved_answer, q.is_flagged);
        renderPalette();
        renderQuestion(activeQuestionIndex);
      };
    });

    // Hotspot statement table
    area.querySelectorAll('.hotspot-radio').forEach(r => {
      r.onchange = () => {
        const map = (typeof q.saved_answer === 'object' && q.saved_answer !== null && !Array.isArray(q.saved_answer)) ? { ...q.saved_answer } : {};
        map[r.dataset.stmt] = r.value;
        q.saved_answer = map;
        triggerAutosave(q.id, q.saved_answer, q.is_flagged);
        renderPalette();
      };
    });
  }

  function triggerAutosave(questionId, savedAnswer, isFlagged) {
    hideRequiredQuestionWarning();
    const q = currentAttempt.questions.find(item => item.id === questionId);
    if (!q) return;
    const secName = q.section_name || 'Section 1';
    const unlockedList = currentAttempt.unlocked_sections || ['Section 1'];
    const completedList = currentAttempt.completed_sections || [];
    if (!unlockedList.includes(secName) || completedList.includes(secName) || q.is_locked) {
      console.warn(`[Autosave Blocked] Question ${questionId} is in locked/completed section '${secName}'.`);
      return;
    }

    const badge = viewContainer.querySelector('#autosave-badge');
    if (badge) {
      badge.innerHTML = '<span style="color:var(--text-muted)">Saving...</span>';
    }

    api.post(`/student/attempts/${currentAttempt.id}/autosave`, {
      question_id: questionId,
      saved_answer: savedAnswer,
      is_flagged: isFlagged
    }).then(() => {
      if (badge) {
        badge.innerHTML = `
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          <span>Saved</span>
        `;
      }
    }).catch(err => {
      if (badge) {
        badge.innerHTML = `<span style="color:var(--danger)">Save failed: ${err.message}</span>`;
      }
    });
  }

  
  function openSectionSubmitModal(sectionName) {
    const secName = (sectionName || 'Section 1').trim();
    const sections = getDistinctSections();
    const targetSec = sections.find(s => s.name === secName) || sections[0];

    const modalTitle = container.querySelector('#sec-submit-title');
    const modalBody = container.querySelector('#sec-submit-body');
    const confirmBtn = container.querySelector('#btn-confirm-sec-submit');

    modalTitle.textContent = `Submit ${escapeHtml(targetSec.name)} for Review`;

    const unansweredIndices = targetSec.indices.filter(idx => !isQuestionAnswered(currentAttempt.questions[idx]));
    const unansweredCount = unansweredIndices.length;

    modalBody.innerHTML = `
      <div style="padding:0.25rem 0;">
        <div style="text-align:center; margin-bottom:1.25rem;">
          <div style="font-size:2.25rem; font-weight:800; color:${unansweredCount > 0 ? 'var(--danger)' : 'var(--brand-lime)'}; margin-bottom:0.25rem;">
            ${targetSec.answered} / ${targetSec.total}
          </div>
          <div style="font-size:0.95rem; font-weight:700; color:var(--text-main);">
            Questions Answered in ${escapeHtml(targetSec.name)}
          </div>
        </div>

        ${unansweredCount > 0 ? `
          <div class="card" style="background:rgba(220,38,38,0.08); border:1px solid var(--danger); color:var(--danger); padding:0.85rem 1rem; margin-bottom:1rem; font-weight:700;">
            ⚠️ You have ${unansweredCount} unanswered question(s) in this section! All questions are mandatory. You must complete every question before this section can be submitted.
            <div style="margin-top:0.65rem;">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-jump-unanswered" style="font-weight:700;">
                👉 Go to First Unanswered Question (${unansweredIndices[0] + 1})
              </button>
            </div>
          </div>
        ` : `
          <div class="card" style="background:var(--success-bg); border-color:var(--success-border); color:var(--success); padding:0.75rem 1rem; margin-bottom:1rem; font-weight:600;">
            &#x2714; All questions in this section have been answered.
          </div>
        `}

        <div class="card" style="background:var(--surface-subtle); border:1px solid var(--border); padding:0.85rem 1rem; font-size:0.85rem; color:var(--text-muted); line-height:1.45;">
          <strong style="color:var(--text-main); display:block; margin-bottom:0.35rem;">What happens next?</strong>
          <ul style="padding-left:1.15rem; margin:0; display:flex; flex-direction:column; gap:0.35rem;">
            <li>Your score and percentage for <strong>${escapeHtml(targetSec.name)}</strong> will be calculated immediately.</li>
            <li>Your answers will be sealed, and correct answers &amp; explanations will be revealed for the group review.</li>
            <li><strong>The timer is paused</strong> during your section review and instructor discussion, preserving your remaining exam time!</li>
            <li>Your score is sent to your instructor's cohort dashboard for the review discussion.</li>
            <li>The next section will be unlocked by your instructor once the discussion is concluded.</li>
          </ul>
        </div>
      </div>
    `;

    secSubmitModal.showModal();

    container.querySelector('#btn-close-sec-submit').onclick = () => secSubmitModal.close();
    container.querySelector('#btn-cancel-sec-submit').onclick = () => secSubmitModal.close();

    if (unansweredCount > 0) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.cursor = 'not-allowed';
      confirmBtn.textContent = `⚠️ Answer All Questions to Submit (${targetSec.answered}/${targetSec.total})`;
      const jumpBtn = modalBody.querySelector('#btn-jump-unanswered');
      if (jumpBtn) {
        jumpBtn.onclick = () => {
          secSubmitModal.close();
          activeQuestionIndex = unansweredIndices[0];
          renderQuestion(activeQuestionIndex);
          renderPalette();
          showRequiredQuestionWarning(`Please answer Question ${unansweredIndices[0] + 1} before proceeding.`);
        };
      }
    } else {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor = 'pointer';
      confirmBtn.textContent = `✔ Confirm & Submit ${targetSec.name} for Review`;
    }

    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Submitting section...';
      try {
        let updatedRes;
        try {
          updatedRes = await api.submitSection(currentAttempt.id, targetSec.name);
        } catch (initialErr) {
          if (initialErr.message && (initialErr.message.includes('Attempt not found') || initialErr.message.includes('HTTP error 400') || initialErr.message.includes('HTTP error 404'))) {
            // Give serverless instance a brief moment to sync and retry once
            await new Promise(r => setTimeout(r, 1000));
            updatedRes = await api.submitSection(currentAttempt.id, targetSec.name);
          } else {
            throw initialErr;
          }
        }
        secSubmitModal.close();
        currentAttempt = updatedRes.attempt_state || updatedRes;

        // If the entire attempt is now marked or awaiting review, show final results
        if (currentAttempt.status !== 'in_progress') {
          renderResultsScreen();
          return;
        }

        // Immediately take them to Question 1 of this section in Review Mode and show Section Results
        showSectionResultsAndReview(targetSec.name);
      } catch (err) {
        alert('Failed to submit section: ' + err.message);
        confirmBtn.disabled = false;
        confirmBtn.textContent = `✔ Confirm & Submit ${targetSec.name} for Review`;
      }
    };
  }

  function showSectionResultsAndReview(sectionName) {
    const distinctSecs = getDistinctSections();
    const sec = distinctSecs.find(s => s.name === sectionName) || distinctSecs[0];
    const targetSecMeta = (currentAttempt.sections || []).find(s => s.name === sectionName) || {};
    const secQuestions = (sec.indices || []).map(idx => currentAttempt.questions[idx]).filter(Boolean);
    const correctCount = secQuestions.filter(q => q.is_correct).length;
    const totalSecQ = secQuestions.length;
    const secScore = targetSecMeta.score ?? correctCount;
    const secMax = targetSecMeta.max_score ?? totalSecQ;
    const secPct = targetSecMeta.percentage ?? (secMax > 0 ? Math.round((secScore / secMax) * 100) : 0);
    const isPassed = targetSecMeta.is_passed ?? (secPct >= (currentAttempt.pass_mark_percentage || 70));

    // Identify next section if any
    const submittedIndex = distinctSecs.findIndex(s => s.name === sectionName);
    const nextSec = distinctSecs[submittedIndex + 1];

    // Take them directly to Question 1 of this section in Review Mode!
    activeQuestionIndex = (sec.indices && sec.indices[0]) || 0;
    renderLiveExamInterface();

    // Populate and show the Section Results Modal
    const resultsModal = container.querySelector('#modal-section-results');
    const titleEl = container.querySelector('#sec-results-title');
    const bodyEl = container.querySelector('#sec-results-body');
    const reviewBtn = container.querySelector('#btn-modal-review-questions');
    const nextSecBtn = container.querySelector('#btn-modal-go-next-sec');

    if (titleEl) titleEl.innerHTML = `&#x2714; ${escapeHtml(sectionName)} Results`;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="text-align:center; padding:0.5rem 0 1rem 0;">
          <div style="font-size:2.8rem; margin-bottom:0.25rem;">&#x1F389;</div>
          <span class="badge ${isPassed ? 'badge-success' : 'badge-danger'}" style="font-size:0.85rem; padding:0.35rem 0.85rem; font-weight:800; margin-bottom:0.75rem;">
            ${escapeHtml(sectionName)} &bull; ${isPassed ? 'PASSED' : 'NEEDS REVIEW'}
          </span>
          <h2 style="font-size:1.5rem; font-weight:800; margin-bottom:0.5rem;">
            Section Score: ${secScore} / ${secMax} (${secPct}%)
          </h2>
          <div style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.3rem 0.75rem; border-radius:var(--radius-full); background:rgba(234,179,8,0.15); border:1px solid #eab308; color:#eab308; font-size:0.8rem; font-weight:700; margin-bottom:0.75rem;">
            &#x23F8; Exam Timer is Paused for Review &amp; Discussion
          </div>
          <p class="form-hint" style="font-size:0.92rem; margin-bottom:1.25rem;">
            ${correctCount} of ${totalSecQ} questions correct &bull; Pass Mark: ${currentAttempt.pass_mark_percentage || 70}%
          </p>

          <div class="card" style="background:var(--surface-subtle); border:1px solid var(--border); padding:0.9rem 1rem; text-align:left; font-size:0.875rem; line-height:1.5;">
            <div style="font-weight:700; color:var(--text-main); margin-bottom:0.35rem;">
              &#x1F50D; Next Step: Question-by-Question Review
            </div>
            <div style="color:var(--text-muted);">
              You are now in <strong>Review Mode</strong>. Click <strong>Review Questions</strong> to step through each question in ${escapeHtml(sectionName)} to inspect which answers were correct (green) or wrong (red), read explanations, and prepare for the instructor discussion.
            </div>
            ${nextSec ? `
              <div style="margin-top:0.6rem; font-size:0.825rem; color:var(--text-muted); border-top:1px dashed var(--border); padding-top:0.5rem;">
                When ready or once your instructor unlocks it, click <strong>Go to ${escapeHtml(nextSec.name)}</strong> to proceed.
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (nextSec) {
      nextSecBtn.style.display = 'inline-flex';
      nextSecBtn.innerHTML = `Go to ${escapeHtml(nextSec.name)} &rarr;`;
      nextSecBtn.onclick = () => {
        resultsModal.close();
        handleGoToNextSection(nextSec.name);
      };
    } else {
      nextSecBtn.style.display = 'inline-flex';
      nextSecBtn.innerHTML = 'View Final Results &rarr;';
      nextSecBtn.onclick = () => {
        resultsModal.close();
        renderResultsScreen();
      };
    }

    reviewBtn.onclick = () => {
      resultsModal.close();
    };

    container.querySelector('#btn-close-sec-results').onclick = () => {
      resultsModal.close();
    };

    resultsModal.showModal();
  }

  function renderSectionWaitingCard(submittedSecName, nextSecName) {
    if (sectionUnlockPoller) clearInterval(sectionUnlockPoller);

    const targetSecMeta = (currentAttempt.sections || []).find(s => s.name === submittedSecName) || {};
    const secScore = targetSecMeta.score ?? 0;
    const secMax = targetSecMeta.max_score ?? 0;
    const secPct = targetSecMeta.percentage ?? 0;
    const isPassed = targetSecMeta.is_passed ?? (secPct >= (currentAttempt.pass_mark_percentage || 70));

    viewContainer.innerHTML = `
      <!-- Assessment Top Banner -->
      <div class="card" style="padding:0.75rem 1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem;">
        <div style="display:flex; align-items:center; gap:0.85rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-save-exit-waiting">
            &larr; Save &amp; Exit
          </button>
          <div>
            <div style="font-weight:700; font-size:1.1rem; color:var(--text-main);">${escapeHtml(currentAttempt.assessment_name)}</div>
            <div style="font-size:0.8125rem; color:var(--text-muted);">${escapeHtml(currentAttempt.course_name)} &bull; Attempt #${currentAttempt.attempt_number}</div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
          <div class="timer-badge" id="exam-timer">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span id="timer-display">--:--:--</span>
          </div>
        </div>
      </div>

      <!-- Sub-Assessment Section Progression Stepper -->
      <div class="card" id="section-stepper-bar" style="padding:0.9rem 1.25rem; margin-bottom:1.25rem; background:var(--surface);"></div>

      <!-- Center Discussion & Waiting Card -->
      <div class="card" style="max-width:760px; margin:1.5rem auto; padding:2rem; text-align:center;">
        <div style="font-size:2.8rem; margin-bottom:0.5rem;">&#x1F389;</div>
        <span class="badge ${isPassed ? 'badge-success' : 'badge-danger'}" style="font-size:0.85rem; padding:0.35rem 0.85rem; margin-bottom:0.75rem;">
          ${escapeHtml(submittedSecName)} &bull; ${isPassed ? 'PASSED' : 'NEEDS HELP'}
        </span>
        <h2 style="font-size:1.6rem; font-weight:800; margin-bottom:0.35rem;">
          ${escapeHtml(submittedSecName)} Completed &amp; Submitted!
        </h2>
        <p class="form-hint" style="font-size:0.95rem; margin-bottom:1.5rem;">
          Your answers for <strong>${escapeHtml(submittedSecName)}</strong> have been submitted and registered with your instructor.
        </p>

        <div class="stats-grid" style="grid-template-columns:repeat(3, 1fr); max-width:540px; margin:0 auto 1.75rem auto;">
          <div class="stat-card">
            <span class="stat-label">Section Score</span>
            <span class="stat-value" style="font-size:1.5rem;">${secScore} / ${secMax}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Percentage</span>
            <span class="stat-value" style="font-size:1.5rem; color:${isPassed ? 'var(--success)' : 'var(--danger)'};">${secPct}%</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Pass Mark</span>
            <span class="stat-value" style="font-size:1.5rem;">${currentAttempt.pass_mark_percentage || 70}%</span>
          </div>
        </div>

        <!-- Instructor Review & Lock Box -->
        <div class="card" id="waiting-lock-box" style="background:var(--surface-subtle); border:1px solid var(--border); border-left:4px solid var(--warning); padding:1.25rem; text-align:left; margin-bottom:1.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-size:1.25rem;">&#x1F4AC;</span>
              <h4 style="font-weight:800; margin:0; font-size:1.05rem;">Instructor Discussion in Progress</h4>
            </div>
            <span class="badge badge-warning" id="badge-lock-indicator">&#x1F512; ${escapeHtml(nextSecName)} Locked</span>
          </div>
          <p style="font-size:0.9rem; color:var(--text-main); margin-bottom:0.75rem; line-height:1.5;">
            Your instructor is conducting the group discussion for <strong>${escapeHtml(submittedSecName)}</strong>. Please participate in the review to discuss any questions or misconceptions. Once concluded, the instructor will unlock <strong>${escapeHtml(nextSecName)}</strong> for the cohort.
          </p>
          <div id="unlock-polling-indicator" style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; font-weight:600; color:var(--text-muted);">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--warning); animation:pulse 1.5s infinite;"></span>
            <span>Checking cohort unlock status automatically every 4 seconds...</span>
          </div>
        </div>

        <div style="display:flex; justify-content:center; gap:1rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-lg" id="btn-review-submitted-sec">
            &#x1F441;&#xFE0F; Review ${escapeHtml(submittedSecName)} Questions &amp; Explanations
          </button>
          <button type="button" class="btn btn-primary btn-lg" id="btn-proceed-unlocked-sec" style="display:none; font-weight:800; background:var(--brand-lime); color:#000;">
            &#x1F513; Begin ${escapeHtml(nextSecName)} &rarr;
          </button>
        </div>
      </div>
    `;

    startAuthoritativeTimer();
    renderSectionStepper();

    viewContainer.querySelector('#btn-save-exit-waiting').onclick = () => {
      if (timerInterval) clearInterval(timerInterval);
      if (sectionUnlockPoller) clearInterval(sectionUnlockPoller);
      if (onExit) onExit();
    };

    viewContainer.querySelector('#btn-review-submitted-sec').onclick = () => {
      if (sectionUnlockPoller) clearInterval(sectionUnlockPoller);
      const distinctSecs = getDistinctSections();
      const sec = distinctSecs.find(s => s.name === submittedSecName);
      activeQuestionIndex = (sec && sec.indices[0]) || 0;
      renderLiveExamInterface();
    };

    const beginBtn = viewContainer.querySelector('#btn-proceed-unlocked-sec');
    beginBtn.onclick = async () => {
      if (sectionUnlockPoller) clearInterval(sectionUnlockPoller);
      currentAttempt = await api.get(`/student/attempts/${currentAttempt.id}`);
      const distinctSecs = getDistinctSections();
      const sec = distinctSecs.find(s => s.name === nextSecName);
      activeQuestionIndex = (sec && sec.indices[0]) || 0;
      renderLiveExamInterface();
    };

    // Start unlock polling
    sectionUnlockPoller = setInterval(async () => {
      try {
        const status = await api.getAttemptUnlockStatus(currentAttempt.id);
        const unlockedList = status.unlocked_sections || ['Section 1'];
        if (unlockedList.includes(nextSecName)) {
          clearInterval(sectionUnlockPoller);
          sectionUnlockPoller = null;
          currentAttempt.unlocked_sections = unlockedList;
          (currentAttempt.questions || []).forEach(q => {
            if (unlockedList.includes(q.section_name || 'Section 1')) {
              q.is_locked = false;
            }
          });

          const lockBox = viewContainer.querySelector('#waiting-lock-box');
          const badgeLock = viewContainer.querySelector('#badge-lock-indicator');
          const pollingIndicator = viewContainer.querySelector('#unlock-polling-indicator');

          if (lockBox) lockBox.style.borderLeftColor = 'var(--brand-lime)';
          if (badgeLock) {
            badgeLock.className = 'badge badge-success';
            badgeLock.innerHTML = `&#x1F513; ${escapeHtml(nextSecName)} Unlocked!`;
          }
          if (pollingIndicator) {
            pollingIndicator.style.color = 'var(--success)';
            pollingIndicator.innerHTML = `&#x2714; <strong>${escapeHtml(nextSecName)} has been unlocked by your instructor.</strong> You may now proceed.`;
          }
          if (beginBtn) {
            beginBtn.style.display = 'inline-flex';
          }
        }
      } catch (e) {
        // Silently continue polling
      }
    }, 4000);
  }

  // Open End / Final Submission Review Confirmation (Section 25)
  function openConfirmModal() {
    const total = currentAttempt.questions.length;
    const answered = currentAttempt.questions.filter(q => q.saved_answer !== null && q.saved_answer !== undefined && q.saved_answer !== '' && (typeof q.saved_answer !== 'object' || Object.keys(q.saved_answer).length > 0)).length;
    const unanswered = total - answered;
    const flagged = currentAttempt.questions.filter(q => q.is_flagged).length;

    const body = container.querySelector('#confirm-submit-body');
    body.innerHTML = `
      <div style="text-align:center; padding:1rem 0;">
        <div style="font-size:2.25rem; font-weight:800; color:var(--primary); margin-bottom:0.5rem;">
          ${answered} / ${total}
        </div>
        <p style="font-size:1.05rem; font-weight:600; color:var(--text-main); margin-bottom:1rem;">
          You have answered ${answered} of ${total} questions.
        </p>

        ${unanswered > 0 ? `
          <div class="card" style="background:var(--warning-bg); border-color:var(--warning-border); color:var(--warning); padding:0.75rem; margin-bottom:1rem; font-weight:600;">
            ${unanswered} question(s) remain unanswered!
          </div>
        ` : `
          <div class="card" style="background:var(--success-bg); border-color:var(--success-border); color:var(--success); padding:0.75rem; margin-bottom:1rem; font-weight:600;">
            All questions have been answered.
          </div>
        `}

        ${flagged > 0 ? `
          <p class="form-hint">${flagged} question(s) are currently flagged for review.</p>
        ` : ''}

        <p class="form-hint" style="margin-top:1rem;">
          Choose <strong>End &amp; View Results</strong> to grade your attempt now, or <strong>End &amp; Try Again</strong> to finish this attempt and immediately restart from Question 1.
        </p>
      </div>
    `;

    confirmModal.showModal();

    container.querySelector('#btn-close-confirm').onclick = () => confirmModal.close();
    container.querySelector('#btn-return-to-exam').onclick = () => confirmModal.close();

    // End & Try Again (Grades current attempt and immediately starts a new attempt)
    const endAndRetryBtn = container.querySelector('#btn-end-and-retry');
    if (endAndRetryBtn) {
      endAndRetryBtn.onclick = async () => {
        confirmModal.close();
        clearInterval(timerInterval);
        try {
          currentAttempt = await api.post(`/student/attempts/${currentAttempt.id}/restart`, {
            assessment_id: currentAttempt.assessment_id,
            class_id: currentAttempt.class_id,
            submit_existing: true
          });
          activeQuestionIndex = 0;
          renderLiveExamInterface();
        } catch (err) {
          alert('Unable to restart assessment: ' + err.message);
        }
      };
    }

    // End & View Results
    container.querySelector('#btn-final-submit').onclick = async () => {
      confirmModal.close();
      const submitBtn = viewContainer.querySelector('#btn-review-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      clearInterval(timerInterval);
      try {
        currentAttempt = await api.post(`/student/attempts/${currentAttempt.id}/submit`);
        renderResultsScreen();
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // Open Restart Assessment Modal
  function openRestartModal() {
    restartModal.showModal();

    container.querySelector('#btn-close-restart').onclick = () => restartModal.close();
    container.querySelector('#btn-cancel-restart').onclick = () => restartModal.close();

    // Option 1: Reset & Start Fresh (discard unfinished in-progress attempt)
    container.querySelector('#btn-confirm-reset-fresh').onclick = async () => {
      restartModal.close();
      clearInterval(timerInterval);
      try {
        currentAttempt = await api.post(`/student/attempts/${currentAttempt.id}/restart`, {
          assessment_id: currentAttempt.assessment_id,
          class_id: currentAttempt.class_id,
          submit_existing: false
        });
        activeQuestionIndex = 0;
        renderLiveExamInterface();
      } catch (err) {
        alert('Failed to restart assessment: ' + err.message);
      }
    };

    // Option 2: End Current Attempt & Start New Attempt
    container.querySelector('#btn-confirm-submit-restart').onclick = async () => {
      restartModal.close();
      clearInterval(timerInterval);
      try {
        currentAttempt = await api.post(`/student/attempts/${currentAttempt.id}/restart`, {
          assessment_id: currentAttempt.assessment_id,
          class_id: currentAttempt.class_id,
          submit_existing: true
        });
        activeQuestionIndex = 0;
        renderLiveExamInterface();
      } catch (err) {
        alert('Failed to restart assessment: ' + err.message);
      }
    };
  }

  async function handleAutoSubmit() {
    try {
      currentAttempt = await api.post(`/student/attempts/${currentAttempt.id}/submit`);
      renderResultsScreen();
    } catch (err) {
      initPlayer();
    }
  }

  // Results & Feedback Screen (Section 27)
  function renderResultsScreen() {
    if (timerInterval) clearInterval(timerInterval);

    const isPassed = currentAttempt.is_passed;
    const badgeClass = isPassed ? 'badge-success' : 'badge-danger';
    const statusText = isPassed ? 'PASSED' : 'NOT PASSED';

    viewContainer.innerHTML = `
      <div class="card" style="max-width:900px; margin:2rem auto; padding:2rem;">
        <div style="text-align:center; padding-bottom:1.5rem; border-bottom:1px solid var(--border); margin-bottom:1.5rem;">
          <span class="badge ${badgeClass}" style="font-size:1rem; padding:0.4rem 1rem; margin-bottom:0.75rem;">
            ${statusText}
          </span>
          <h1 style="font-size:1.75rem; font-weight:800; margin-bottom:0.25rem;">${escapeHtml(currentAttempt.assessment_name)}</h1>
          <p class="form-hint">${escapeHtml(currentAttempt.course_name)} &bull; ${escapeHtml(currentAttempt.class_name)} &bull; Attempt #${currentAttempt.attempt_number || 1}</p>

          <div class="stats-grid" style="grid-template-columns:repeat(3, 1fr); margin-top:1.5rem; max-width:600px; margin-left:auto; margin-right:auto;">
            <div class="stat-card">
              <span class="stat-label">Your Score</span>
              <span class="stat-value" style="font-size:1.5rem;">${currentAttempt.score} / ${currentAttempt.max_score}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Percentage</span>
              <span class="stat-value" style="font-size:1.5rem; color:${isPassed ? 'var(--success)' : 'var(--danger)'};">${currentAttempt.percentage}%</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Pass Mark</span>
              <span class="stat-value" style="font-size:1.5rem;">${currentAttempt.pass_mark_percentage || 70}%</span>
            </div>
          </div>

          <!-- Top Quick Action Bar for Try Again / Return to Portal -->
          <div style="margin-top:1.5rem; display:flex; justify-content:center; gap:0.85rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary" id="btn-results-exit-top">
              &larr; Return to Student Portal
            </button>
            <button type="button" class="btn btn-primary" id="btn-results-retake-top" style="font-weight:700;">
              &#x21bb; Try Again / Restart Assessment &rarr;
            </button>
          </div>
        </div>

        <!-- Sub-Assessment Section Breakdown -->
        ${Array.isArray(currentAttempt.sections) && currentAttempt.sections.length > 0 ? `
          <div style="margin-bottom:2rem;">
            <h3 style="font-size:1.15rem; font-weight:800; margin-bottom:0.35rem;">Sub-Assessment Section Performance</h3>
            <p class="form-hint" style="margin-bottom:0.9rem;">Shows how you performed in each section. Sections below the pass mark are highlighted for review and shared with your instructor.</p>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:1rem;">
              ${currentAttempt.sections.map((sec, sIdx) => {
                const secNeedsHelp = sec.needs_help;
                const secPct = sec.percentage !== null && sec.percentage !== undefined ? sec.percentage : 0;
                return `
                  <div class="card" style="margin:0; padding:1.1rem; border-left:4px solid ${secNeedsHelp ? 'var(--danger)' : 'var(--brand-lime)'};">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                      <span style="font-weight:800; font-family:var(--font-heading); font-size:0.95rem;">${sIdx + 1}. ${escapeHtml(sec.name)}</span>
                      <span class="badge ${secNeedsHelp ? 'badge-danger' : 'badge-success'}" style="font-size:0.7rem;">
                        ${secNeedsHelp ? '&#x26A0; NEEDS HELP' : '&#x2714; PASSED'}
                      </span>
                    </div>
                    <div style="font-size:1.5rem; font-weight:900; font-family:var(--font-heading); color:${secNeedsHelp ? 'var(--danger)' : 'var(--text-main)'};">
                      ${secPct}%
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">
                      Score: ${sec.score ?? 0} / ${sec.max_score ?? 0} pts &bull; ${sec.total_questions} Question(s)
                    </div>
                    <div style="height:6px; background:var(--surface-subtle); border-radius:var(--radius-full); overflow:hidden;">
                      <div style="height:100%; width:${secPct}%; background:${secNeedsHelp ? 'var(--danger)' : 'var(--brand-lime)'};"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Question Review Breakdown -->
        <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:1rem;">Question Review</h3>

        <div style="display:flex; flex-direction:column; gap:1.25rem;">
          ${currentAttempt.questions.map((q, idx) => {
            const hasCorrect = q.correct_answer !== undefined;
            const isCorrect = q.is_correct;
            const qBadge = isCorrect ? 'badge-success' : 'badge-danger';

            return `
              <div class="card" style="margin:0; padding:1.25rem; border-left:4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-weight:700;">Question ${idx + 1}</span>
                    <span class="badge badge-primary" style="font-size:0.7rem;">${escapeHtml(q.section_name || 'Section 1')}</span>
                  </div>
                  <div>
                    <span class="badge ${qBadge}">${isCorrect ? 'CORRECT' : 'INCORRECT'}</span>
                    <span class="badge badge-neutral">${q.awarded_points || 0} / ${q.max_points || 1} pt(s)</span>
                  </div>
                </div>

                ${q.question_description ? `
                  <div class="question-description-box" style="margin-bottom:0.75rem; font-size:0.875rem;">
                    <strong>Scenario Context:</strong>
                    <div>${escapeHtml(q.question_description)}</div>
                  </div>
                ` : ''}

                <div style="font-weight:600; margin-bottom:0.75rem;">
                  ${escapeHtml(q.question_text)}
                </div>

                <div style="font-size:0.875rem; margin-bottom:0.5rem;">
                  <strong>Your Answer:</strong> <code>${escapeHtml(formatAnswerDisplay(q.saved_answer, q))}</code>
                </div>

                ${hasCorrect ? `
                  <div style="font-size:0.875rem; margin-bottom:0.5rem; color:var(--success);">
                    <strong>Correct Answer:</strong> <code>${escapeHtml(formatAnswerDisplay(q.correct_answer, q))}</code>
                  </div>
                ` : ''}

                ${q.answer_explanation ? `
                  <div style="margin-top:0.75rem; padding:0.75rem; background:var(--surface-subtle); border-radius:var(--radius-md); font-size:0.875rem;">
                    <strong>Explanation:</strong> ${escapeHtml(q.answer_explanation)}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top:2rem; display:flex; justify-content:center; gap:1rem; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-lg" id="btn-results-exit">
            &larr; Return to Student Portal
          </button>
          <button type="button" class="btn btn-primary btn-lg" id="btn-results-retake" style="font-weight:700;">
            &#x21bb; Try Again / Restart Assessment &rarr;
          </button>
        </div>
      </div>
    `;

    viewContainer.querySelector('#btn-results-exit').onclick = () => onExit && onExit();
    viewContainer.querySelector('#btn-results-exit-top').onclick = () => onExit && onExit();

    async function handleStartFreshRetake(btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = 'Starting fresh attempt...';
      try {
        currentAttempt = await api.post('/student/attempts/start', {
          assessment_id: currentAttempt.assessment_id,
          class_id: currentAttempt.class_id,
          force_new: true
        });
        activeQuestionIndex = 0;
        renderLiveExamInterface();
      } catch (err) {
        alert('Unable to retake: ' + err.message);
        btnEl.disabled = false;
        btnEl.innerHTML = '&#x21bb; Try Again / Restart Assessment &rarr;';
      }
    }

    const retakeBtn = viewContainer.querySelector('#btn-results-retake');
    const retakeBtnTop = viewContainer.querySelector('#btn-results-retake-top');
    if (retakeBtn) retakeBtn.onclick = () => handleStartFreshRetake(retakeBtn);
    if (retakeBtnTop) retakeBtnTop.onclick = () => handleStartFreshRetake(retakeBtnTop);
  }

  function formatAnswerDisplay(val, q) {
    if (val === null || val === undefined || val === '') return 'None';

    let idToText = {};
    if (q && q.answer_options) {
      let opts = q.answer_options;
      if (typeof opts === 'string') {
        try { opts = JSON.parse(opts); } catch (_) {}
      }
      if (opts && typeof opts === 'object') {
        const sources = Array.isArray(opts.sources) ? opts.sources : [];
        const targets = Array.isArray(opts.targets) ? opts.targets : [];
        for (const s of sources) {
          if (s && s.id && s.text) idToText[String(s.id)] = String(s.text);
        }
        for (const t of targets) {
          if (t && t.id && t.text) idToText[String(t.id)] = String(t.text);
        }
      }
    }

    if (typeof val === 'object') {
      if (Array.isArray(val)) {
        return val.map(item => {
          if (typeof item === 'object' && item !== null) {
            const l = item.left || item.target || item.source;
            const r = item.right || item.source || item.target;
            return `${idToText[l] || l} \u2192 ${idToText[r] || r}`;
          }
          return idToText[item] || item;
        }).join(', ');
      }
      return Object.entries(val).map(([k, v]) => `${idToText[k] || k} \u2192 ${idToText[v] || v}`).join(' | ');
    }
    return String(idToText[val] || val);
  }

  function parseUtc(str) {
    if (!str) return new Date();
    const s = String(str).trim();
    if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
    return new Date(s.replace(' ', 'T') + 'Z');
  }

  initPlayer();
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
