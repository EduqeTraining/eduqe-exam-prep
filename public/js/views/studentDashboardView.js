// Student Dashboard View (Section 2, 6, 22)

import { api } from '../api.js';

export async function renderStudentDashboard(container, router) {
  container.innerHTML = `<div style="text-align:center; padding:3rem;">Loading your learning dashboard...</div>`;

  try {
    const data = await api.get('/student/dashboard');
    const { student, courses, available_assessments, completed_assessments } = data;
    const past_attempts = data.past_attempts || data.recent_results || [];

    container.innerHTML = `
      <div class="student-dashboard" style="display:flex; flex-direction:column; gap:2rem;">
        
        <!-- Welcome Banner (eduqe.co.za Hero Style) -->
        <div class="card banner-welcome" style="padding:1.85rem 2rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
            <div>
              <div class="eduqe-kicker">&#x1F393; EDUQE EXAM PREPARATION &bull; STUDENT LEARNING PORTAL</div>
              <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.35rem; flex-wrap:wrap;">
                <h1 style="font-size:1.85rem; font-weight:900;">Welcome back, <span style="color:var(--brand-lime);">${escapeHtml(student.first_name)}</span>!</h1>
                <span class="badge ${student.account_status === 'active' ? 'badge-primary' : 'badge-danger'}">
                  ${escapeHtml(student.account_status.toUpperCase())}
                </span>
              </div>
              <p class="form-hint" style="font-size:0.95rem; margin-bottom:0;">
                Signed in as <strong>@${escapeHtml(student.username)}</strong>
                ${student.student_number ? ` &bull; Student No: <strong>${escapeHtml(student.student_number)}</strong>` : ''}
                &bull; <strong>${courses?.length || 0}</strong> active course enrolment(s)
              </p>
            </div>
            <div>
              <button type="button" class="btn btn-primary btn-sm" id="btn-refresh-dashboard">
                &#x21bb; Refresh Dashboard
              </button>
            </div>
          </div>
        </div>

        <!-- Course Access Code Redemption (Section 6) -->
        <div class="card" style="border-left:4px solid var(--primary); padding:1.5rem;">
          <div style="max-width:800px;">
            <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:0.35rem; display:flex; align-items:center; gap:0.5rem;">
              <span>&#x1F511;</span> Enter Course Code or Access Code
            </h3>
            <p class="form-hint" style="margin-bottom:1rem; font-size:0.875rem;">
              Have a course code shared with you by your instructor (e.g. <code>az-900</code>, <code>AZ104-CENTURION-01</code>)? Enter it below to immediately unlock your course and view available practice questions.
            </p>
            <form id="form-redeem-code" style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-start;">
              <div style="flex:1; min-width:240px;">
                <input 
                  type="text" 
                  id="redeem-code-input" 
                  class="form-control" 
                  placeholder="e.g. az-900 or AZ104-CENTURION-01" 
                  style="text-transform:uppercase; font-family:var(--font-mono); font-weight:700; letter-spacing:0.05em;" 
                  required
                />
              </div>
              <button type="submit" class="btn btn-primary" id="btn-redeem-submit">
                Unlock Questions &rarr;
              </button>
            </form>
            <div id="redeem-alert-container" style="margin-top:0.75rem;"></div>
          </div>
        </div>

        <!-- Available Assessments & Practice Questions (Section 22) -->
        <section>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div>
              <h2 style="font-size:1.25rem; font-weight:700;">Available Assessments & Questions</h2>
              <p class="form-hint" style="font-size:0.85rem;">Ready to be attempted. Timers and attempt counters begin upon launch.</p>
            </div>
            <span class="badge badge-info">${available_assessments?.length || 0} Assessments Available</span>
          </div>

          ${(!available_assessments || available_assessments.length === 0) ? `
            <div class="card" style="text-align:center; padding:2.5rem; color:var(--text-muted);">
              <div style="font-size:2rem; margin-bottom:0.5rem;">&#x1F4DD;</div>
              <p style="font-weight:600; margin-bottom:0.25rem;">No active assessments available right now.</p>
              <p class="form-hint" style="font-size:0.85rem;">Enter a course code above (e.g. <code>az-900</code>) to unlock your questions.</p>
            </div>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:1.25rem;">
              ${available_assessments.map(a => {
                const hasInProgress = Boolean(a.in_progress_attempt_id);
                const qList = a.available_questions || [];
                const qCount = a.question_count || qList.length;
                const attemptsTaken = a.attempts_taken || 0;
                const maxAttempts = a.max_attempts ? Number(a.max_attempts) : 0;
                const isUnlimited = a.is_unlimited || maxAttempts <= 0;
                const canRetake = isUnlimited || (a.can_retake !== false && attemptsTaken < maxAttempts);

                const statusBadge = hasInProgress
                  ? '<span class="badge badge-warning">Attempt in Progress</span>'
                  : (attemptsTaken > 0
                    ? `<span class="badge badge-info">Completed (${attemptsTaken} Attempt${attemptsTaken === 1 ? '' : 's'}) &bull; Unlimited Retakes</span>`
                    : '<span class="badge badge-primary">Available &bull; Unlimited Retakes</span>');

                return `
                  <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; height:100%; border-top: 3px solid ${hasInProgress ? 'var(--warning)' : (attemptsTaken > 0 ? 'var(--success)' : 'var(--primary)')};">
                    <div>
                      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                        ${statusBadge}
                        <span class="badge badge-success" style="font-weight:700;">
                          ${qCount} Question${qCount === 1 ? '' : 's'} Ready
                        </span>
                      </div>

                      <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:0.35rem;">${escapeHtml(a.name)}</h3>
                      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem; line-height:1.4;">
                        ${escapeHtml(a.description || 'Comprehensive exam preparation assessment.')}
                      </p>

                      <div style="font-size:0.8rem; color:var(--text-muted); display:flex; flex-direction:column; gap:0.25rem; margin-bottom:0.75rem; padding:0.6rem; background:var(--surface-subtle); border-radius:var(--radius-sm);">
                        <div><strong>Course:</strong> ${escapeHtml(a.course_name)}</div>
                        <div><strong>Class:</strong> ${escapeHtml(a.class_name)}</div>
                        <div style="display:flex; justify-content:space-between; margin-top:0.25rem;">
                          <span>&#x23F1; <strong>${a.duration_minutes} min</strong></span>
                          <span>&#x2705; Pass: <strong>${a.pass_mark_percentage}%</strong></span>
                          <span>&#x1F504; Attempts: <strong>${isUnlimited ? 'Unlimited' : `${attemptsTaken}/${maxAttempts}`}</strong></span>
                        </div>
                      </div>

                      <!-- Available Questions Drawer / Preview -->
                      ${qList.length > 0 ? `
                        <div style="margin-bottom:1rem;">
                          <button type="button" class="btn btn-secondary btn-sm" style="width:100%; font-size:0.8rem; display:flex; justify-content:space-between; align-items:center;" data-action="toggle-q-list" data-target="qbox-${a.id}">
                            <span>&#x1F4CB; View Available Questions (${qList.length})</span>
                            <span class="chevron" id="icon-qbox-${a.id}">&#x25BE;</span>
                          </button>
                          
                          <div id="qbox-${a.id}" style="display:none; margin-top:0.5rem; max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.5rem; background:var(--surface-subtle); flex-direction:column; gap:0.4rem;">
                            ${qList.map((q, idx) => `
                              <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; background:var(--surface); border:1px solid var(--border); padding:0.4rem 0.6rem; border-radius:var(--radius-sm); font-size:0.8rem;">
                                <div style="display:flex; align-items:center; gap:0.4rem; min-width:0; overflow:hidden;">
                                  <span style="font-weight:700; color:var(--text-muted); flex-shrink:0;">#${idx + 1}</span>
                                  <span class="badge badge-secondary" style="font-size:0.68rem; padding:0.1rem 0.35rem; text-transform:capitalize; flex-shrink:0;">
                                    ${escapeHtml(q.question_type.replace(/_/g, ' '))}
                                  </span>
                                  <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(q.question_text)}">
                                    ${escapeHtml(q.question_text)}
                                  </span>
                                </div>
                                <span class="badge badge-info" style="font-size:0.68rem; flex-shrink:0; text-transform:capitalize;">
                                  ${escapeHtml(q.difficulty || 'medium')}
                                </span>
                              </div>
                            `).join('')}
                          </div>
                        </div>
                      ` : ''}

                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                      ${hasInProgress ? `
                        <button type="button" class="btn btn-warning" style="width:100%; font-weight:700;" data-action="resume" data-attempt-id="${a.in_progress_attempt_id}">
                          &#x25B6; Resume In-Progress Assessment &rarr;
                        </button>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                          <button type="button" class="btn btn-secondary btn-sm" style="font-weight:700;" data-action="restart-attempt" data-attempt-id="${a.in_progress_attempt_id}" data-assessment-id="${a.id}" data-class-id="${a.class_id}">
                            &#x21bb; Restart / Try Again
                          </button>
                          <button type="button" class="btn btn-secondary btn-sm" style="font-weight:700; color:var(--danger); border-color:rgba(220,38,38,0.35);" data-action="end-attempt" data-attempt-id="${a.in_progress_attempt_id}">
                            &#x23F9; End Assessment
                          </button>
                        </div>
                      ` : canRetake ? `
                        <button type="button" class="btn btn-primary" style="width:100%; font-weight:700;" data-action="${attemptsTaken > 0 ? 'restart-assessment' : 'start'}" data-assessment-id="${a.id}" data-class-id="${a.class_id}">
                          ${attemptsTaken > 0 ? `&#x21bb; Try Again / Restart Assessment (Attempt #${attemptsTaken + 1}) &rarr;` : `Start Exam / Practice Questions (${qCount} Qs) &rarr;`}
                        </button>
                      ` : `
                        <button type="button" class="btn btn-secondary" style="width:100%; font-weight:700;" disabled title="Maximum attempts reached for this assessment.">
                          Maximum Attempts Reached (${attemptsTaken}/${maxAttempts})
                        </button>
                      `}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </section>

        <!-- My Enrolled Courses & Classes (Sections 5, 7) -->
        <section>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div>
              <h2 style="font-size:1.25rem; font-weight:700;">My Enrolled Courses & Classes</h2>
              <p class="form-hint" style="font-size:0.85rem;">Active courses and class assignments unlocked via course codes or admin enrolment.</p>
            </div>
            <span class="badge badge-secondary">${courses?.filter(c => c.enrollment_status === 'active')?.length || 0} Active Enrolment(s)</span>
          </div>

          ${(!courses || courses.length === 0) ? `
            <div class="card" style="text-align:center; padding:2rem; color:var(--text-muted);">
              You are not currently enrolled in any courses. Enter your course access code above to get started.
            </div>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:1rem;">
              ${courses.map(c => {
                const isExpired = c.enrollment_status === 'expired';
                return `
                  <div class="card" style="${isExpired ? 'opacity:0.8; border-color:var(--danger);' : ''}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                      <span class="badge ${isExpired ? 'badge-danger' : 'badge-success'}">
                        ${isExpired ? 'Access Expired' : 'Active Enrolment'}
                      </span>
                      <span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(c.subject || 'Certification Track')}</span>
                    </div>
                    <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:0.25rem;">${escapeHtml(c.course_name)}</h3>
                    <div style="font-size:0.85rem; color:var(--primary); font-weight:600; margin-bottom:0.5rem;">
                      Class: ${escapeHtml(c.class_name)}
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted); display:flex; flex-direction:column; gap:0.2rem; border-top:1px solid var(--border); padding-top:0.5rem;">
                      ${isExpired ? `
                        <div style="color:var(--danger); font-weight:600;">
                          &#x26A0; Access expired. Questions and previous results purged per platform rule.
                        </div>
                      ` : `
                        <div>Questions: <strong>${c.available_questions ? c.available_questions.length : 0} Available</strong></div>
                        <div>Enrolled: ${new Date(c.enrolled_at).toLocaleDateString()}</div>
                        <div>Access: ${c.access_expires_at ? `Until ${new Date(c.access_expires_at).toLocaleDateString()}` : 'Unlimited access'}</div>
                      `}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </section>

        <!-- Completed Assessments & Recent Results (Section 26, 27) -->
        <section>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div>
              <h2 style="font-size:1.25rem; font-weight:700;">Past Attempts & Results</h2>
              <p class="form-hint" style="font-size:0.85rem;">Review your completed scores, time spent, question feedback, and retake assessments to improve your score.</p>
            </div>
            <span class="badge badge-secondary">${past_attempts?.length || 0} Attempt${(past_attempts?.length === 1) ? '' : 's'} Logged</span>
          </div>

          ${(!past_attempts || past_attempts.length === 0) ? `
            <div class="card" style="text-align:center; padding:2rem; color:var(--text-muted);">
              No past assessment attempts found. Complete an assessment to see your scores, time spent, and detailed feedback here.
            </div>
          ` : `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Attempt</th>
                    <th>Assessment & Class</th>
                    <th>Date Attempted</th>
                    <th>Time Spent</th>
                    <th>Questions</th>
                    <th>Score</th>
                    <th>Outcome</th>
                    <th style="text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${past_attempts.map(r => {
                    const isInProgress = r.status === 'in_progress';
                    const isPassed = r.is_passed === 1 || r.is_passed === true;
                    const durationSec = r.time_spent_seconds || 0;
                    const mins = Math.floor(durationSec / 60);
                    const secs = durationSec % 60;
                    const timeSpentStr = isInProgress ? 'In Progress' : (durationSec > 0 ? `${mins}m ${secs}s` : '< 1m');

                    return `
                      <tr>
                        <td>
                          <span class="badge badge-neutral" style="font-weight:700;">
                            Attempt #${r.attempt_number || 1}
                          </span>
                        </td>
                        <td>
                          <strong>${escapeHtml(r.assessment_name || 'Assessment')}</strong>
                          <div style="font-size:0.75rem; color:var(--text-muted);">
                            ${escapeHtml(r.course_name ? `${r.course_name} • ` : '')}${escapeHtml(r.class_name || 'Enrolled Class')}
                          </div>
                        </td>
                        <td>
                          ${new Date(r.started_at).toLocaleDateString()} 
                          <span style="font-size:0.8rem; color:var(--text-muted);">${new Date(r.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td>
                          ${isInProgress ? `<span class="badge badge-warning" style="font-size:0.75rem;">Active</span>` : timeSpentStr}
                        </td>
                        <td>${r.questions_answered || 0} / ${r.total_questions || '-'}</td>
                        <td>
                          ${isInProgress ? `<span class="badge badge-warning" style="font-size:0.75rem;">Pending</span>` : `
                            <strong>${r.percentage !== null && r.percentage !== undefined ? `${Math.round(r.percentage)}%` : '-'}</strong>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${r.score || 0} / ${r.max_score || 0} pts</div>
                          `}
                        </td>
                        <td>
                          ${isInProgress ? `
                            <span class="badge badge-warning">IN PROGRESS</span>
                          ` : `
                            <span class="badge ${isPassed ? 'badge-success' : 'badge-danger'}">
                              ${isPassed ? 'PASSED' : 'NEEDS PRACTICE'}
                            </span>
                          `}
                        </td>
                        <td style="text-align:right;">
                          ${isInProgress ? `
                            <div style="display:flex; justify-content:flex-end; gap:0.4rem; flex-wrap:wrap;">
                              <button type="button" class="btn btn-warning btn-sm" data-action="resume" data-attempt-id="${r.attempt_id}" title="Continue where you left off">
                                &#x25B6; Resume
                              </button>
                              <button type="button" class="btn btn-secondary btn-sm" data-action="restart-attempt" data-attempt-id="${r.attempt_id}" data-assessment-id="${r.assessment_id}" data-class-id="${r.class_id || ''}" title="Restart this assessment from Question 1">
                                &#x21bb; Restart
                              </button>
                              <button type="button" class="btn btn-secondary btn-sm" style="color:var(--danger); border-color:rgba(220,38,38,0.35);" data-action="end-attempt" data-attempt-id="${r.attempt_id}" title="End and grade this assessment attempt">
                                &#x23F9; End
                              </button>
                            </div>
                          ` : `
                            <div style="display:flex; justify-content:flex-end; gap:0.4rem; flex-wrap:wrap;">
                              <button type="button" class="btn btn-secondary btn-sm" data-action="review" data-attempt-id="${r.attempt_id}" title="Review submitted answers and explanations">
                                &#x1F4CB; Review Answers
                              </button>
                              <button type="button" class="btn btn-primary btn-sm" data-action="restart-assessment" data-assessment-id="${r.assessment_id}" data-class-id="${r.class_id || ''}" title="Try again / restart this assessment">
                                &#x21bb; Try Again
                              </button>
                            </div>
                          `}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </section>

      </div>
    `;

    // Event Handlers

    // Refresh Dashboard
    container.querySelector('#btn-refresh-dashboard').onclick = () => {
      renderStudentDashboard(container, router);
    };

    // Toggle question list drawers
    container.querySelectorAll('[data-action="toggle-q-list"]').forEach(btn => {
      btn.onclick = () => {
        const targetId = btn.getAttribute('data-target');
        const box = container.querySelector(`#${targetId}`);
        const icon = container.querySelector(`#icon-${targetId}`);
        if (!box) return;
        const isOpen = box.style.display === 'flex';
        box.style.display = isOpen ? 'none' : 'flex';
        if (icon) icon.innerHTML = isOpen ? '&#x25BE;' : '&#x25B4;';
      };
    });

    // Redeem Code Form
    const redeemForm = container.querySelector('#form-redeem-code');
    const redeemInput = container.querySelector('#redeem-code-input');
    const alertBox = container.querySelector('#redeem-alert-container');

    redeemForm.onsubmit = async (e) => {
      e.preventDefault();
      const code = redeemInput.value.trim().toUpperCase();
      if (!code) return;

      const submitBtn = container.querySelector('#btn-redeem-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying Code...';
      alertBox.innerHTML = '';

      try {
        const res = await api.post('/student/redeem-code', { code });
        const qCount = res.question_count || (res.questions ? res.questions.length : 0);

        alertBox.innerHTML = `
          <div class="card" style="margin-top:0.75rem; border:2px solid var(--success-border); background:var(--success-bg); padding:1.25rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:0.75rem;">
              <div>
                <div style="color:var(--success); font-weight:800; font-size:1.15rem; display:flex; align-items:center; gap:0.5rem;">
                  <span>&#x2705;</span> Course Access Unlocked: ${escapeHtml(res.course?.name || code)}
                </div>
                <p style="font-size:0.9rem; color:var(--text-main); margin-top:0.25rem; margin-bottom:0;">
                  Class: <strong>${escapeHtml(res.class?.name || 'General')}</strong> &bull; 
                  <strong style="color:var(--primary);">${qCount} question${qCount === 1 ? '' : 's'} ready to practice</strong>.
                </p>
              </div>

              ${res.assessment ? `
                <button type="button" class="btn btn-primary" id="btn-quick-launch-redeemed" style="font-weight:700;">
                  Start Practice Questions Now (${qCount} Qs) &rarr;
                </button>
              ` : ''}
            </div>

            ${res.questions && res.questions.length > 0 ? `
              <div style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid var(--success-border);">
                <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">
                  Available Questions in this Course:
                </div>
                <div style="display:flex; flex-direction:column; gap:0.35rem; max-height:160px; overflow-y:auto;">
                  ${res.questions.map((q, idx) => `
                    <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface); border:1px solid var(--border); padding:0.4rem 0.6rem; border-radius:var(--radius-sm); font-size:0.85rem;">
                      <div style="display:flex; align-items:center; gap:0.5rem; overflow:hidden;">
                        <span style="font-weight:700; color:var(--text-muted);">#${idx + 1}</span>
                        <span class="badge badge-secondary" style="font-size:0.7rem; padding:0.1rem 0.35rem; text-transform:capitalize;">
                          ${escapeHtml(q.question_type.replace(/_/g, ' '))}
                        </span>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(q.question_text)}</span>
                      </div>
                      <span class="badge badge-info" style="font-size:0.7rem; text-transform:capitalize;">${escapeHtml(q.difficulty)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `;

        redeemInput.value = '';

        // If quick launch button clicked
        const quickBtn = alertBox.querySelector('#btn-quick-launch-redeemed');
        if (quickBtn && res.assessment) {
          quickBtn.onclick = () => {
            if (router && router.navigate) {
              router.navigate(`exam/${res.assessment.id}?class=${res.class.id}`);
            }
          };
        }

        // Re-render dashboard lists after short delay
        setTimeout(() => {
          // If the quick launch was not clicked, refresh the bottom cards
          const scrollPos = window.scrollY;
          renderStudentDashboard(container, router).then(() => {
            window.scrollTo(0, scrollPos);
          });
        }, 3000);

      } catch (err) {
        alertBox.innerHTML = `
          <div class="alert alert-danger" style="padding:0.75rem 1rem; border-radius:var(--radius-sm); background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#b91c1c; font-size:0.9rem;">
            <strong>&#x26A0; Access Denied:</strong> ${escapeHtml(err.message)}
          </div>
        `;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Unlock Questions →';
      }
    };

    // Assessment action buttons
    container.querySelectorAll('[data-action="start"]').forEach(btn => {
      btn.onclick = () => {
        const assessmentId = btn.getAttribute('data-assessment-id');
        const classId = btn.getAttribute('data-class-id');
        if (router && router.navigate) {
          router.navigate(classId ? `exam/${assessmentId}?class=${classId}` : `exam/${assessmentId}`);
        }
      };
    });

    container.querySelectorAll('[data-action="restart-assessment"]').forEach(btn => {
      btn.onclick = () => {
        const assessmentId = btn.getAttribute('data-assessment-id');
        const classId = btn.getAttribute('data-class-id');
        if (router && router.navigate) {
          const qs = classId ? `?class=${classId}&restart=1` : `?restart=1`;
          router.navigate(`exam/${assessmentId}${qs}`);
        }
      };
    });

    container.querySelectorAll('[data-action="restart-attempt"]').forEach(btn => {
      btn.onclick = async () => {
        const attemptId = btn.getAttribute('data-attempt-id');
        const assessmentId = btn.getAttribute('data-assessment-id');
        const classId = btn.getAttribute('data-class-id');
        btn.disabled = true;
        btn.textContent = 'Restarting...';
        try {
          const freshAttempt = await api.post(`/student/attempts/${attemptId}/restart`, {
            assessment_id: assessmentId || null,
            class_id: classId || null,
            submit_existing: false
          });
          if (router && router.navigate) {
            router.navigate(`exam-attempt/${freshAttempt.id}`);
          }
        } catch (err) {
          alert('Failed to restart assessment: ' + err.message);
          btn.disabled = false;
          btn.innerHTML = '&#x21bb; Restart / Try Again';
        }
      };
    });

    container.querySelectorAll('[data-action="end-attempt"]').forEach(btn => {
      btn.onclick = async () => {
        const attemptId = btn.getAttribute('data-attempt-id');
        btn.disabled = true;
        btn.textContent = 'Ending...';
        try {
          await api.post(`/student/attempts/${attemptId}/end`);
          if (router && router.navigate) {
            router.navigate(`exam-attempt/${attemptId}`);
          } else {
            renderStudentDashboard(container, router);
          }
        } catch (err) {
          alert('Failed to end assessment: ' + err.message);
          btn.disabled = false;
          btn.innerHTML = '&#x23F9; End Assessment';
        }
      };
    });

    container.querySelectorAll('[data-action="resume"]').forEach(btn => {
      btn.onclick = () => {
        const attemptId = btn.getAttribute('data-attempt-id');
        if (router && router.navigate) {
          router.navigate(`exam-attempt/${attemptId}`);
        }
      };
    });

    container.querySelectorAll('[data-action="review"]').forEach(btn => {
      btn.onclick = () => {
        const attemptId = btn.getAttribute('data-attempt-id');
        if (router && router.navigate) {
          router.navigate(`exam-attempt/${attemptId}`);
        }
      };
    });

  } catch (err) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:3rem;">
        <h3 style="color:var(--danger); margin-bottom:1rem;">Failed to Load Student Dashboard</h3>
        <p style="margin-bottom:1.5rem;">${escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-primary" id="btn-retry-student">Retry</button>
      </div>
    `;
    container.querySelector('#btn-retry-student').onclick = () => renderStudentDashboard(container, router);
  }
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
