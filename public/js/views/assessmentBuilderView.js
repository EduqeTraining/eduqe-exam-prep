// Visual Assessment Builder View (Sections 12, 17, 18)

import { api } from '../api.js';
import { renderQuestionEditor } from './questionEditorView.js';

export function renderAssessmentBuilder(container, { assessmentId = null, onSaved = null } = {}) {
  let isEditing = Boolean(assessmentId);
  let assessmentData = null;

  // Default 3 sections on assessment creation
  let currentSections = ['Section 1', 'Section 2', 'Section 3'];
  let currentItems = [];
  let activeTargetSection = 'Section 1';

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">${isEditing ? 'Visual Assessment Builder' : 'Create Assessment'}</h2>
          <p class="form-hint">Assemble assessments into sub-assessment sections, assign classes, reorder questions, and configure time windows.</p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-builder">Back to Assessments</button>
        </div>
      </div>

      <form id="assessment-form">
        <!-- Settings Grid -->
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
          <div>
            <div class="form-group">
              <label class="form-label" for="a-name">Assessment Name <span style="color:var(--danger)">*</span></label>
              <input type="text" id="a-name" class="form-control" placeholder="e.g. AZ-104 Practice Certification Exam" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="a-course">Course <span style="color:var(--danger)">*</span></label>
              <select id="a-course" class="form-control" required></select>
            </div>
            <div class="form-group">
              <label class="form-label" for="a-desc">Description</label>
              <textarea id="a-desc" class="form-control" placeholder="Brief description of the assessment..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="a-instructions">Instructions for Students</label>
              <textarea id="a-instructions" class="form-control" placeholder="Instructions shown before starting (e.g. complete each section in order, passing requirements)..."></textarea>
            </div>
          </div>

          <div class="card" style="background:var(--surface-subtle); border-color:var(--border);">
            <h4 style="font-size:0.95rem; margin-bottom:1rem; color:var(--primary);">Assessment Timing &amp; Controls</h4>

            <div class="form-group">
              <label class="form-label" for="a-duration">Attempt Duration (Minutes)</label>
              <input type="number" id="a-duration" class="form-control" value="60" min="5" max="360" required>
              <p class="form-hint">Time allowed once an attempt starts.</p>
            </div>

            <div class="form-group">
              <label class="form-label" for="a-pass-mark">Pass Mark (%)</label>
              <input type="number" id="a-pass-mark" class="form-control" value="70" min="1" max="100" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="a-max-attempts">Maximum Attempts</label>
              <input type="number" id="a-max-attempts" class="form-control" value="0" min="0" max="100">
              <span class="form-hint">Set to 0 for unlimited attempts (default).</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="a-available-from">Availability Window Opens</label>
              <input type="datetime-local" id="a-available-from" class="form-control">
            </div>

            <div class="form-group">
              <label class="form-label" for="a-available-to">Availability Window Closes</label>
              <input type="datetime-local" id="a-available-to" class="form-control">
            </div>

            <div class="form-group">
              <label class="form-label" for="a-result-vis">Result Visibility</label>
              <select id="a-result-vis" class="form-control">
                <option value="immediate" selected>Immediately after submission</option>
                <option value="after_window_closes">After availability window closes</option>
                <option value="manual_release">Manual release by administrator</option>
                <option value="hidden">Hidden from students</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="a-status">Publication Status</label>
              <select id="a-status" class="form-control">
                <option value="draft">Draft</option>
                <option value="published" selected>Published</option>
                <option value="unpublished">Unpublished</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Assigned Classes -->
        <fieldset class="card" style="margin-bottom:1.5rem;">
          <legend style="font-weight:700; font-size:0.95rem; padding:0 0.5rem; color:var(--primary);">Assigned Classes</legend>
          <p class="form-hint" style="margin-bottom:0.75rem;">Check the classes that have access to take this assessment:</p>
          <div id="classes-checkboxes" style="display:flex; flex-wrap:wrap; gap:1.5rem;">
            <!-- Populated dynamically -->
          </div>
        </fieldset>

        <!-- Sub-Assessment Sections & Questions Builder -->
        <div class="card" style="margin-bottom:1.5rem;">
          <div class="card-header" style="border-bottom:1px solid var(--border); padding-bottom:1rem; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem;">
            <div>
              <div style="display:flex; align-items:center; gap:0.6rem;">
                <h3 style="font-size:1.15rem; font-weight:800; margin:0;">Sub-Assessment Sections &amp; Questions</h3>
                <span class="badge badge-primary" id="builder-sections-badge">3 Sections</span>
              </div>
              <p class="form-hint" id="builder-summary" style="margin-top:0.25rem; margin-bottom:0;">
                3 sections configured &bull; 0 questions total. Students complete one section before moving to the next, and section results are tracked on the Instructor Portal.
              </p>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-secondary" id="btn-add-section" title="Add another sub-assessment section">
                + Add Section
              </button>
              <button type="button" class="btn btn-secondary" id="btn-add-all-course-questions" title="Add all questions from this course's Question Bank across sections">
                + Add All Course Questions
              </button>
              <button type="button" class="btn btn-primary" id="btn-add-question-modal">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                Add Question
              </button>
            </div>
          </div>

          <div id="builder-items-list" style="display:flex; flex-direction:column; gap:1.25rem;">
            <!-- Section division cards & their questions rendered here -->
          </div>
        </div>

        <!-- Save Button -->
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div id="save-assessment-status"></div>
          <button type="submit" class="btn btn-primary btn-lg">${isEditing ? 'Save Assessment Changes' : 'Create Assessment'}</button>
        </div>
      </form>
    </div>

    <!-- ADD QUESTION MODAL -->
    <dialog id="modal-add-options">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;">Add Question to Section</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-add-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom:1.15rem; padding:0.85rem; background:var(--surface-subtle); border-radius:var(--radius-md); border:1px solid var(--border);">
          <label class="form-label" for="modal-target-section" style="margin-bottom:0.35rem;">Target Sub-Assessment Section:</label>
          <select id="modal-target-section" class="form-control" style="font-weight:700;"></select>
          <p class="form-hint" style="margin-top:0.3rem; margin-bottom:0;">Questions added below will be placed inside this section.</p>
        </div>

        <div style="display:grid; grid-template-columns: 1fr; gap:0.75rem;">
          <button type="button" class="btn btn-secondary" id="opt-create-inline" style="justify-content:flex-start; padding:1rem; text-align:left;">
            <div>
              <div style="font-weight:700; color:var(--primary); font-size:1rem;">1. Create New Question</div>
              <div style="font-size:0.8125rem; color:var(--text-muted);">Open question editor, save into Question Bank, and add directly into the selected section.</div>
            </div>
          </button>

          <button type="button" class="btn btn-secondary" id="opt-select-bank" style="justify-content:flex-start; padding:1rem; text-align:left;">
            <div>
              <div style="font-weight:700; color:var(--primary); font-size:1rem;">2. Select from Question Bank</div>
              <div style="font-size:0.8125rem; color:var(--text-muted);">Choose existing questions from the course or global question bank for this section.</div>
            </div>
          </button>

          <button type="button" class="btn btn-secondary" id="opt-select-pool" style="justify-content:flex-start; padding:1rem; text-align:left;">
            <div>
              <div style="font-weight:700; color:var(--primary); font-size:1rem;">3. Add Random Questions from Pool</div>
              <div style="font-size:0.8125rem; color:var(--text-muted);">Configure randomized question selection from a question pool into this section.</div>
            </div>
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-dismiss-add-modal">Cancel</button>
      </div>
    </dialog>

    <!-- Modal: Select From Bank -->
    <dialog id="modal-bank-picker" style="max-width:820px;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;" id="bank-picker-title">Select Questions from Bank</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-bank-picker">&times;</button>
      </div>
      <div class="modal-body">
        <div style="max-height:55vh; overflow-y:auto;" id="bank-picker-list"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-dismiss-bank-picker">Close</button>
      </div>
    </dialog>

    <!-- Modal: Select Pool -->
    <dialog id="modal-pool-picker">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;">Select Question Pool</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-pool-picker">&times;</button>
      </div>
      <div class="modal-body" id="pool-picker-list"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-dismiss-pool-picker">Cancel</button>
      </div>
    </dialog>

    <!-- Inline Question Creator Drawer/Modal -->
    <dialog id="modal-inline-creator" style="max-width:900px; width:95vw;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;" id="inline-creator-title">Create Question (Saved to Question Bank &amp; Section)</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-inline-creator">&times;</button>
      </div>
      <div class="modal-body" id="inline-creator-container"></div>
    </dialog>
  `;

  const courseSelect = container.querySelector('#a-course');
  const classesCheckboxes = container.querySelector('#classes-checkboxes');
  const itemsContainer = container.querySelector('#builder-items-list');
  const summaryEl = container.querySelector('#builder-summary');
  const sectionsBadgeEl = container.querySelector('#builder-sections-badge');
  const modalTargetSectionSelect = container.querySelector('#modal-target-section');

  function syncModalSectionSelect() {
    if (!modalTargetSectionSelect) return;
    if (!currentSections.includes(activeTargetSection)) {
      activeTargetSection = currentSections[0] || 'Section 1';
    }
    modalTargetSectionSelect.innerHTML = currentSections.map(sec => `
      <option value="${escapeHtml(sec)}" ${sec === activeTargetSection ? 'selected' : ''}>${escapeHtml(sec)}</option>
    `).join('');
  }

  if (modalTargetSectionSelect) {
    modalTargetSectionSelect.onchange = () => {
      activeTargetSection = modalTargetSectionSelect.value;
    };
  }

  // Populate courses
  api.get('/courses').then(courses => {
    courseSelect.innerHTML = '<option value="">-- Select Course --</option>' +
      courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`).join('');

    if (isEditing && assessmentData) {
      courseSelect.value = assessmentData.course_id;
      loadClassesForCourse(assessmentData.course_id, assessmentData.assigned_classes);
    }
  });

  courseSelect.onchange = () => {
    loadClassesForCourse(courseSelect.value);
  };

  async function loadClassesForCourse(courseId, preAssigned = []) {
    if (!courseId) {
      classesCheckboxes.innerHTML = '<p class="form-hint">Select a course to view available classes.</p>';
      return;
    }
    const classes = await api.get(`/classes?course_id=${courseId}`);
    if (classes.length === 0) {
      classesCheckboxes.innerHTML = '<p class="form-hint">No classes created under this course yet.</p>';
      return;
    }

    const assignedIds = preAssigned.map(c => c.id || c.class_id);
    classesCheckboxes.innerHTML = classes.map(cls => `
      <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
        <input type="checkbox" class="cb-class" value="${cls.id}" ${assignedIds.includes(cls.id) ? 'checked' : ''} style="width:1.1rem; height:1.1rem; accent-color:var(--primary);">
        <span>${escapeHtml(cls.name)}</span>
      </label>
    `).join('');
  }

  function normalizeItemSections() {
    if (currentSections.length === 0) {
      currentSections = ['Section 1', 'Section 2', 'Section 3'];
    }
    for (const item of currentItems) {
      let sName = (item.section_name || '').trim();
      if (!sName || (sName === 'General' && !currentSections.includes('General'))) {
        item.section_name = currentSections[0];
      } else if (!currentSections.includes(sName)) {
        currentSections.push(sName);
      }
    }
  }

  function renderBuilderItems() {
    normalizeItemSections();
    syncModalSectionSelect();

    const totalQuestions = currentItems.reduce((sum, item) => {
      if (item.is_pool) {
        return sum + (parseInt(item.pool_random_count, 10) || 5);
      }
      return sum + 1;
    }, 0);

    if (sectionsBadgeEl) {
      sectionsBadgeEl.textContent = `${currentSections.length} Section${currentSections.length === 1 ? '' : 's'}`;
    }
    summaryEl.innerHTML = `<strong>${currentSections.length} sub-assessment section(s)</strong> &bull; <strong>${totalQuestions} question(s)</strong> configured. Students complete one section before moving to the next.`;

    itemsContainer.innerHTML = currentSections.map((secName, secIdx) => {
      const secItems = currentItems
        .map((item, globalIdx) => ({ item, globalIdx }))
        .filter(entry => entry.item.section_name === secName);

      const secQCount = secItems.reduce((sum, { item }) => sum + (item.is_pool ? (parseInt(item.pool_random_count, 10) || 5) : 1), 0);
      const secPts = secItems.reduce((sum, { item }) => sum + (item.is_pool ? (parseInt(item.pool_random_count, 10) || 5) : (item.question?.points || 1)), 0);

      return `
        <div class="card" style="margin-bottom:0; padding:1.15rem 1.25rem; border:1.5px solid var(--border-strong); border-left:5px solid var(--brand-lime); background:var(--surface);">
          <!-- Section Division Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; padding-bottom:0.85rem; margin-bottom:0.85rem; border-bottom:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:0.65rem; flex:1; min-width:240px;">
              <span class="badge badge-primary" style="font-weight:800; font-size:0.75rem;">
                DIVISION ${secIdx + 1}
              </span>
              <input
                type="text"
                class="form-control input-section-rename"
                data-sec-idx="${secIdx}"
                value="${escapeHtml(secName)}"
                placeholder="Section Name (e.g. Section ${secIdx + 1})"
                style="max-width:320px; font-weight:800; font-family:var(--font-heading); padding:0.4rem 0.7rem;"
                title="Edit Section Name"
              />
              <span class="badge badge-neutral">${secQCount} Question${secQCount === 1 ? '' : 's'} &bull; ${secPts} pt(s)</span>
            </div>

            <div style="display:flex; align-items:center; gap:0.5rem;">
              <button type="button" class="btn btn-primary btn-sm btn-add-q-to-sec" data-sec="${escapeHtml(secName)}">
                + Add Question to ${escapeHtml(secName)}
              </button>
              ${currentSections.length > 1 ? `
                <button type="button" class="btn btn-secondary btn-sm btn-remove-sec" data-sec-idx="${secIdx}" title="Remove this section" style="color:var(--danger);">
                  &times; Remove Section
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Questions inside this Section -->
          ${secItems.length === 0 ? `
            <div style="text-align:center; padding:1.35rem; background:var(--surface-subtle); border-radius:var(--radius-md); border:1.5px dashed var(--border);">
              <span style="color:var(--text-muted); font-size:0.875rem; font-weight:600;">No questions in <strong>${escapeHtml(secName)}</strong> yet.</span>
              <button type="button" class="btn btn-secondary btn-sm btn-add-q-to-sec" data-sec="${escapeHtml(secName)}" style="margin-left:0.75rem;">
                + Add Question
              </button>
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              ${secItems.map(({ item, globalIdx }, localIdx) => {
                const sectionSelectHtml = `
                  <select class="form-control select-item-section" data-idx="${globalIdx}" style="width:auto; min-width:135px; padding:0.25rem 0.5rem; font-size:0.78rem; font-weight:600;" title="Move question to another section">
                    ${currentSections.map(s => `<option value="${escapeHtml(s)}" ${s === item.section_name ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                  </select>
                `;

                if (item.is_pool) {
                  return `
                    <div class="card" style="margin-bottom:0; padding:0.65rem 0.9rem; display:flex; align-items:center; justify-content:space-between; background:var(--accent-light); border-color:var(--accent); gap:0.75rem; flex-wrap:wrap;">
                      <div style="display:flex; align-items:center; gap:0.65rem; flex:1; min-width:200px;">
                        <span class="badge badge-primary">RANDOM POOL</span>
                        <strong style="color:var(--text-main);">${escapeHtml(item.pool_name || 'Question Pool')}</strong>
                        <span class="badge badge-neutral">Picks ${item.pool_random_count || 5} questions</span>
                      </div>
                      <div style="display:flex; align-items:center; gap:0.4rem;">
                        ${sectionSelectHtml}
                        <button type="button" class="btn btn-secondary btn-sm btn-item-up" data-idx="${globalIdx}" ${localIdx === 0 ? 'disabled' : ''}>&uarr;</button>
                        <button type="button" class="btn btn-secondary btn-sm btn-item-down" data-idx="${globalIdx}" ${localIdx === secItems.length - 1 ? 'disabled' : ''}>&darr;</button>
                        <button type="button" class="btn btn-secondary btn-sm btn-item-del" data-idx="${globalIdx}" title="Remove from section">&times;</button>
                      </div>
                    </div>
                  `;
                }

                const q = item.question || item;
                return `
                  <div class="card" style="margin-bottom:0; padding:0.65rem 0.9rem; display:flex; align-items:center; justify-content:space-between; gap:0.75rem; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:0.65rem; min-width:0; flex:1;">
                      <span class="badge badge-neutral" style="font-weight:700;">Q${localIdx + 1}</span>
                      <span class="badge badge-primary">${escapeHtml((q.question_type || '').toUpperCase().replace(/_/g, ' '))}</span>
                      <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; color:var(--text-main);">
                        ${escapeHtml(q.question_text)}
                      </div>
                      <span class="badge badge-neutral" style="flex-shrink:0;">${q.points || 1} pt(s)</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                      ${sectionSelectHtml}
                      <button type="button" class="btn btn-secondary btn-sm btn-item-up" data-idx="${globalIdx}" ${localIdx === 0 ? 'disabled' : ''}>&uarr;</button>
                      <button type="button" class="btn btn-secondary btn-sm btn-item-down" data-idx="${globalIdx}" ${localIdx === secItems.length - 1 ? 'disabled' : ''}>&darr;</button>
                      <button type="button" class="btn btn-secondary btn-sm btn-item-del" data-idx="${globalIdx}" title="Remove question">&times;</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `;
    }).join('');

    // Section rename handlers
    itemsContainer.querySelectorAll('.input-section-rename').forEach(inp => {
      inp.onchange = () => {
        const secIdx = parseInt(inp.dataset.secIdx, 10);
        const oldName = currentSections[secIdx];
        const newName = inp.value.trim() || `Section ${secIdx + 1}`;
        if (newName === oldName) return;
        if (currentSections.some((s, i) => i !== secIdx && s.toLowerCase() === newName.toLowerCase())) {
          alert(`A section named "${newName}" already exists.`);
          inp.value = oldName;
          return;
        }
        currentSections[secIdx] = newName;
        currentItems.forEach(it => {
          if (it.section_name === oldName) it.section_name = newName;
        });
        if (activeTargetSection === oldName) activeTargetSection = newName;
        renderBuilderItems();
      };
    });

    // Add Question to specific section button
    itemsContainer.querySelectorAll('.btn-add-q-to-sec').forEach(btn => {
      btn.onclick = () => {
        activeTargetSection = btn.dataset.sec || currentSections[0] || 'Section 1';
        syncModalSectionSelect();
        container.querySelector('#modal-add-options').showModal();
      };
    });

    // Remove Section button
    itemsContainer.querySelectorAll('.btn-remove-sec').forEach(btn => {
      btn.onclick = () => {
        if (currentSections.length <= 1) return;
        const secIdx = parseInt(btn.dataset.secIdx, 10);
        const removedSec = currentSections[secIdx];
        const fallbackSec = currentSections.find((_, i) => i !== secIdx) || 'Section 1';
        currentSections.splice(secIdx, 1);
        currentItems.forEach(it => {
          if (it.section_name === removedSec) {
            it.section_name = fallbackSec;
          }
        });
        if (activeTargetSection === removedSec) activeTargetSection = fallbackSec;
        renderBuilderItems();
      };
    });

    // Move item between sections
    itemsContainer.querySelectorAll('.select-item-section').forEach(sel => {
      sel.onchange = () => {
        const idx = parseInt(sel.dataset.idx, 10);
        if (currentItems[idx]) {
          currentItems[idx].section_name = sel.value;
          renderBuilderItems();
        }
      };
    });

    // Reorder up within section
    itemsContainer.querySelectorAll('.btn-item-up').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const secName = currentItems[idx]?.section_name;
        for (let prev = idx - 1; prev >= 0; prev--) {
          if (currentItems[prev].section_name === secName) {
            const temp = currentItems[idx];
            currentItems[idx] = currentItems[prev];
            currentItems[prev] = temp;
            renderBuilderItems();
            break;
          }
        }
      };
    });

    // Reorder down within section
    itemsContainer.querySelectorAll('.btn-item-down').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const secName = currentItems[idx]?.section_name;
        for (let next = idx + 1; next < currentItems.length; next++) {
          if (currentItems[next].section_name === secName) {
            const temp = currentItems[idx];
            currentItems[idx] = currentItems[next];
            currentItems[next] = temp;
            renderBuilderItems();
            break;
          }
        }
      };
    });

    // Delete item
    itemsContainer.querySelectorAll('.btn-item-del').forEach(btn => {
      btn.onclick = async () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const removed = currentItems[idx];
        currentItems.splice(idx, 1);
        renderBuilderItems();
        if (isEditing && removed?.assessment_question_id) {
          try {
            await api.delete(`/assessments/${assessmentId}/questions/${removed.assessment_question_id}`);
          } catch (e) {
            // Synced on Save
          }
        }
      };
    });
  }

  // Add Section button
  container.querySelector('#btn-add-section').onclick = () => {
    let nextNum = currentSections.length + 1;
    let candidate = `Section ${nextNum}`;
    while (currentSections.some(s => s.toLowerCase() === candidate.toLowerCase())) {
      nextNum++;
      candidate = `Section ${nextNum}`;
    }
    currentSections.push(candidate);
    activeTargetSection = candidate;
    renderBuilderItems();
  };

  // Load existing assessment if editing
  if (isEditing) {
    api.get(`/assessments/${assessmentId}`).then(a => {
      assessmentData = a;
      container.querySelector('#a-name').value = a.name || '';
      container.querySelector('#a-desc').value = a.description || '';
      container.querySelector('#a-instructions').value = a.instructions || '';
      container.querySelector('#a-duration').value = a.duration_minutes || 60;
      container.querySelector('#a-pass-mark').value = a.pass_mark_percentage || 70;
      container.querySelector('#a-max-attempts').value = (a.max_attempts !== null && a.max_attempts !== undefined) ? a.max_attempts : 0;
      container.querySelector('#a-result-vis').value = a.result_visibility || 'immediate';
      container.querySelector('#a-status').value = a.status || 'draft';

      if (a.available_from) container.querySelector('#a-available-from').value = a.available_from.substring(0, 16);
      if (a.available_to) container.querySelector('#a-available-to').value = a.available_to.substring(0, 16);

      currentSections = (Array.isArray(a.section_names) && a.section_names.length > 0)
        ? [...a.section_names]
        : ['Section 1', 'Section 2', 'Section 3'];
      activeTargetSection = currentSections[0] || 'Section 1';
      currentItems = a.items || [];
      renderBuilderItems();
    });
  } else {
    renderBuilderItems();
  }

  async function addQuestionItem(q, targetSec = null) {
    const secName = targetSec || activeTargetSection || currentSections[0] || 'Section 1';
    const existingItem = currentItems.find(item => !item.is_pool && (item.question_id === q.id || item.question?.id === q.id));
    if (existingItem) {
      existingItem.section_name = secName;
      return;
    }

    const newItem = {
      question_id: q.id,
      question: q,
      section_name: secName,
      is_pool: false
    };

    if (isEditing && assessmentId) {
      try {
        const res = await api.post(`/assessments/${assessmentId}/questions`, {
          question_id: q.id,
          section_name: secName
        });
        if (res && res.id) {
          newItem.assessment_question_id = res.id;
        }
      } catch (e) {
        // Will also be synced on Save
      }
    }

    currentItems.push(newItem);
  }

  // Add All Course Questions Button (distributes across the configured sections)
  container.querySelector('#btn-add-all-course-questions').onclick = async () => {
    const courseId = courseSelect.value || null;
    if (!courseId) {
      alert('Please select a Course first.');
      return;
    }
    const questions = await api.get(`/questions?course_id=${courseId}`);
    if (!questions || questions.length === 0) {
      alert('No questions found in the Question Bank for this course.');
      return;
    }

    let addedCount = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const exists = currentItems.some(item => !item.is_pool && (item.question_id === q.id || item.question?.id === q.id));
      if (!exists) {
        const secIndex = Math.min(
          currentSections.length - 1,
          Math.floor((i / Math.max(1, questions.length)) * currentSections.length)
        );
        const assignedSec = currentSections[secIndex] || currentSections[0] || 'Section 1';
        await addQuestionItem(q, assignedSec);
        addedCount++;
      }
    }
    renderBuilderItems();
    if (addedCount === 0) {
      alert(`All ${questions.length} question(s) for this course are already added to this assessment.`);
    }
  };

  // Add Question Modal Controls
  const addModal = container.querySelector('#modal-add-options');
  container.querySelector('#btn-add-question-modal').onclick = () => {
    syncModalSectionSelect();
    addModal.showModal();
  };
  container.querySelector('#btn-close-add-modal').onclick = () => addModal.close();
  container.querySelector('#btn-dismiss-add-modal').onclick = () => addModal.close();

  // Option 1: Create New Question Inline (Rule 7 & 12)
  const inlineCreatorModal = container.querySelector('#modal-inline-creator');
  container.querySelector('#opt-create-inline').onclick = () => {
    const chosenSection = modalTargetSectionSelect?.value || activeTargetSection || currentSections[0] || 'Section 1';
    activeTargetSection = chosenSection;
    addModal.close();

    const titleEl = container.querySelector('#inline-creator-title');
    if (titleEl) titleEl.textContent = `Create Question for ${chosenSection}`;

    const inlineContainer = container.querySelector('#inline-creator-container');
    const courseId = courseSelect.value || null;

    renderQuestionEditor(inlineContainer, {
      defaultCourseId: courseId,
      onSaved: async (created) => {
        inlineCreatorModal.close();
        if (created) {
          await addQuestionItem(created, chosenSection);
          renderBuilderItems();
        }
      }
    });
    inlineCreatorModal.showModal();
  };
  container.querySelector('#btn-close-inline-creator').onclick = () => inlineCreatorModal.close();

  // Option 2: Select from Question Bank
  const bankPickerModal = container.querySelector('#modal-bank-picker');
  container.querySelector('#opt-select-bank').onclick = async () => {
    const chosenSection = modalTargetSectionSelect?.value || activeTargetSection || currentSections[0] || 'Section 1';
    activeTargetSection = chosenSection;
    addModal.close();

    const bankTitle = container.querySelector('#bank-picker-title');
    if (bankTitle) bankTitle.textContent = `Select Questions for ${chosenSection}`;

    const courseId = courseSelect.value || null;
    const questions = await api.get(`/questions${courseId ? `?course_id=${courseId}` : ''}`);
    const list = container.querySelector('#bank-picker-list');

    if (questions.length === 0) {
      list.innerHTML = `<p class="form-hint" style="padding:1rem; text-align:center;">No questions found in the Question Bank${courseId ? ' for this course' : ''}.</p>`;
      bankPickerModal.showModal();
      return;
    }

    const existingIds = new Set(currentItems.filter(i => !i.is_pool).map(i => i.question_id || i.question?.id));

    list.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; padding-bottom:0.5rem; border-bottom:1px solid var(--border);">
        <span style="font-size:0.85rem; color:var(--text-muted);">Adding to: <strong style="color:var(--text-main);">${escapeHtml(chosenSection)}</strong> (${questions.length} question(s) available)</span>
        <button type="button" class="btn btn-primary btn-sm" id="btn-add-all-in-picker">+ Add All to ${escapeHtml(chosenSection)}</button>
      </div>
      ${questions.map(q => {
        const isAlreadyAdded = existingIds.has(q.id);
        return `
          <div class="card" style="margin-bottom:0.5rem; padding:0.75rem; display:flex; align-items:center; justify-content:space-between;">
            <div style="min-width:0; flex:1; margin-right:0.75rem;">
              <span class="badge badge-primary" style="font-size:0.7rem;">${escapeHtml(q.question_type.toUpperCase())}</span>
              <span style="font-weight:600; margin-left:0.5rem;">${escapeHtml(q.question_text)}</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm btn-pick-q" data-id="${q.id}" ${isAlreadyAdded ? 'disabled' : ''}>
              ${isAlreadyAdded ? 'Added' : `+ Add to ${escapeHtml(chosenSection)}`}
            </button>
          </div>
        `;
      }).join('')}
    `;

    const addAllPickerBtn = list.querySelector('#btn-add-all-in-picker');
    if (addAllPickerBtn) {
      addAllPickerBtn.onclick = async () => {
        addAllPickerBtn.disabled = true;
        addAllPickerBtn.textContent = 'Adding...';
        for (const q of questions) {
          await addQuestionItem(q, chosenSection);
        }
        list.querySelectorAll('.btn-pick-q').forEach(btn => {
          btn.disabled = true;
          btn.textContent = 'Added';
        });
        addAllPickerBtn.textContent = 'All Added';
        renderBuilderItems();
      };
    }

    list.querySelectorAll('.btn-pick-q').forEach(btn => {
      btn.onclick = async () => {
        const qId = btn.dataset.id;
        const q = questions.find(item => item.id === qId);
        btn.disabled = true;
        btn.textContent = 'Added';
        await addQuestionItem(q, chosenSection);
        renderBuilderItems();
      };
    });

    bankPickerModal.showModal();
  };
  container.querySelector('#btn-close-bank-picker').onclick = () => bankPickerModal.close();
  container.querySelector('#btn-dismiss-bank-picker').onclick = () => bankPickerModal.close();

  // Option 3: Add Pool
  const poolPickerModal = container.querySelector('#modal-pool-picker');
  container.querySelector('#opt-select-pool').onclick = async () => {
    const chosenSection = modalTargetSectionSelect?.value || activeTargetSection || currentSections[0] || 'Section 1';
    activeTargetSection = chosenSection;
    addModal.close();

    const pools = await api.get('/pools');
    const list = container.querySelector('#pool-picker-list');

    if (pools.length === 0) {
      list.innerHTML = '<p class="form-hint">No Question Pools exist yet. Create a Question Pool in the Question Bank first.</p>';
    } else {
      list.innerHTML = pools.map(p => `
        <div class="card" style="margin-bottom:0.5rem; padding:0.75rem; display:flex; align-items:center; justify-content:space-between;">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            <p class="form-hint" style="margin:0;">Picks ${p.random_count || 5} questions at random &bull; Target: <strong>${escapeHtml(chosenSection)}</strong></p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm btn-pick-pool" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-count="${p.random_count}">+ Add Pool to ${escapeHtml(chosenSection)}</button>
        </div>
      `).join('');

      list.querySelectorAll('.btn-pick-pool').forEach(btn => {
        btn.onclick = async () => {
          const newPoolItem = {
            is_pool: true,
            pool_id: btn.dataset.id,
            pool_name: btn.dataset.name,
            pool_random_count: parseInt(btn.dataset.count || '5', 10),
            section_name: chosenSection
          };
          if (isEditing && assessmentId) {
            try {
              const res = await api.post(`/assessments/${assessmentId}/pools`, {
                pool_id: btn.dataset.id,
                section_name: chosenSection
              });
              if (res && res.id) newPoolItem.assessment_question_id = res.id;
            } catch (e) {
              // Will also be synced on Save
            }
          }
          currentItems.push(newPoolItem);
          poolPickerModal.close();
          renderBuilderItems();
        };
      });
    }

    poolPickerModal.showModal();
  };
  container.querySelector('#btn-close-pool-picker').onclick = () => poolPickerModal.close();
  container.querySelector('#btn-dismiss-pool-picker').onclick = () => poolPickerModal.close();

  container.querySelector('#btn-cancel-builder').onclick = () => {
    if (onSaved) onSaved(null);
  };

  // Submit assessment form
  container.querySelector('#assessment-form').onsubmit = async (e) => {
    e.preventDefault();
    const saveStatus = container.querySelector('#save-assessment-status');

    try {
      saveStatus.innerHTML = '<span style="color:var(--text-muted)">Saving assessment...</span>';

      const selectedClasses = [];
      container.querySelectorAll('.cb-class:checked').forEach(cb => {
        selectedClasses.push(cb.value);
      });

      // Order currentItems by section order before saving
      const orderedItems = [];
      for (const secName of currentSections) {
        for (const item of currentItems) {
          if (item.section_name === secName) {
            orderedItems.push(item);
          }
        }
      }

      const payload = {
        course_id: courseSelect.value,
        name: container.querySelector('#a-name').value.trim(),
        description: container.querySelector('#a-desc').value.trim(),
        instructions: container.querySelector('#a-instructions').value.trim(),
        duration_minutes: parseInt(container.querySelector('#a-duration').value, 10),
        pass_mark_percentage: parseFloat(container.querySelector('#a-pass-mark').value),
        max_attempts: Math.max(0, parseInt(container.querySelector('#a-max-attempts').value, 10) || 0),
        result_visibility: container.querySelector('#a-result-vis').value,
        status: container.querySelector('#a-status').value,
        available_from: container.querySelector('#a-available-from').value ? new Date(container.querySelector('#a-available-from').value).toISOString() : null,
        available_to: container.querySelector('#a-available-to').value ? new Date(container.querySelector('#a-available-to').value).toISOString() : null,
        sections: currentSections,
        class_ids: selectedClasses,
        items: orderedItems
      };

      let savedAssessment = null;
      if (isEditing) {
        savedAssessment = await api.put(`/assessments/${assessmentId}`, payload);
      } else {
        savedAssessment = await api.post('/assessments', payload);
      }

      saveStatus.innerHTML = '<span style="color:var(--success); font-weight:600;">Assessment saved successfully!</span>';
      setTimeout(() => {
        if (onSaved) onSaved(savedAssessment);
      }, 400);
    } catch (err) {
      saveStatus.innerHTML = `<span style="color:var(--danger); font-weight:600;">Error: ${err.message}</span>`;
    }
  };
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
