// Question Editor View - Full 10-Step Workflow

import { api } from '../api.js';

export function renderQuestionEditor(container, { questionId = null, defaultCourseId = null, onSaved = null } = {}) {
  let isEditing = Boolean(questionId);
  let currentQuestion = null;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">${isEditing ? 'Edit / Version Question' : 'Create Question'}</h2>
          <p class="form-hint">Follow the 10-step question editor workflow to define questions and answer keys.</p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn-secondary" id="btn-preview-question">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            Preview as Student
          </button>
          <button type="button" class="btn btn-secondary" id="btn-cancel-question">Cancel</button>
        </div>
      </div>

      <form id="question-form">
        <!-- Step 1: Course & Classification -->
        <fieldset class="card" style="margin-bottom:1rem; border-color:var(--border);">
          <legend style="font-weight:700; font-size:0.95rem; padding:0 0.5rem; color:var(--primary);">Step 1: Classification & Context</legend>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="q-course">Course</label>
              <select id="q-course" class="form-control"></select>
            </div>
            <div class="form-group">
              <label class="form-label" for="q-topic">Topic / Domain</label>
              <input type="text" id="q-topic" class="form-control" placeholder="e.g. Identity & Access Management">
            </div>
            <div class="form-group">
              <label class="form-label" for="q-objective">Learning Objective</label>
              <input type="text" id="q-objective" class="form-control" placeholder="e.g. Configure Azure RBAC permissions">
            </div>
            <div class="form-group">
              <label class="form-label" for="q-difficulty">Difficulty Level</label>
              <select id="q-difficulty" class="form-control">
                <option value="easy">Easy</option>
                <option value="medium" selected>Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="q-tags">Tags (comma-separated)</label>
              <input type="text" id="q-tags" class="form-control" placeholder="Azure, RBAC, Governance">
            </div>
          </div>
        </fieldset>

        <!-- Step 2: Select Question Type -->
        <fieldset class="card" style="margin-bottom:1rem; border-color:var(--border);">
          <legend style="font-weight:700; font-size:0.95rem; padding:0 0.5rem; color:var(--primary);">Step 2: Question Type</legend>
          <div class="form-group">
            <label class="form-label" for="q-type">Select Question Interaction Type</label>
            <select id="q-type" class="form-control" style="font-weight:600;">
              <option value="yes_no">Yes or No</option>
              <option value="true_false">True or False</option>
              <option value="single_choice" selected>Multiple Choice: Single Answer</option>
              <option value="multiple_response">Multiple Choice: Multiple Answers (Multi-select)</option>
              <option value="matching">Drag and Drop: Matching Pairs</option>
              <option value="ordering">Drag and Drop: Ordering / Sequencing</option>
              <option value="categorisation">Drag and Drop: Categorisation</option>
              <option value="dropdown">Dropdown Selection (Blanks)</option>
              <option value="fill_blank">Fill in the Blank</option>
              <option value="scenario">Scenario Question</option>
              <option value="case_study">Case Study Question</option>
              <option value="hot_area">Hot Area / Visual Image Selection</option>
              <option value="hotspot">Hotspot (Answer Area Statements Table)</option>
            </select>
            <p class="form-hint" id="q-type-hint">Single choice: Student picks one correct answer from a list.</p>
          </div>
        </fieldset>

        <!-- Step 3: Enter the Question -->
        <fieldset class="card" style="margin-bottom:1rem; border-color:var(--border);">
          <legend style="font-weight:700; font-size:0.95rem; padding:0 0.5rem; color:var(--primary);">Step 3: Question Text</legend>
          <div class="form-group">
            <label class="form-label" for="q-text">QUESTION <span style="color:var(--danger)">*</span></label>
            <textarea id="q-text" class="form-control" style="min-height:90px;" placeholder="Enter the exact question the student must answer..." required></textarea>
            <p class="form-hint">Supports formatting, code snippets, lists, and technical terminology.</p>
          </div>
        </fieldset>

        <!-- Step 4: Add the Question Description -->
        <fieldset class="card" style="margin-bottom:1rem; border-color:var(--border);">
          <legend style="font-weight:700; font-size:0.95rem; padding:0 0.5rem; color:var(--primary);">Step 4: Question Description (Optional Scenario & Context)</legend>
          <div class="form-group">
            <label class="form-label" for="q-desc">QUESTION DESCRIPTION</label>
            <textarea id="q-desc" class="form-control" style="min-height:110px;" placeholder="Enter background information, technical scenario, architecture context, tables, or instructions. Appears BEFORE the answer area."></textarea>
            <p class="form-hint">Note: Question and Question Description are strictly maintained as independent fields.</p>
          </div>
        </fieldset>

        <!-- Step 5 & 6: Create Answer Options & Mark Correct Answer -->
        <fieldset class="card" style="margin-bottom:1rem; border-color:var(--border);">
          <legend style="font-weight:700; font-size:0.95rem; padding:0 0.5rem; color:var(--primary);">Step 5 & 6: Answer Options & Correct Key</legend>
          <div id="dynamic-answer-editor">
            <!-- Dynamic answer editor renders here according to selected question type -->
          </div>
        </fieldset>

        <!-- Step 7: Answer Explanation -->
        <fieldset class="card" style="margin-bottom:1rem; border-color:var(--border);">
          <legend style="font-weight:700; font-size:0.95rem; padding:0 0.5rem; color:var(--primary);">Step 7: Answer Explanation</legend>
          <div class="form-group">
            <label class="form-label" for="q-explanation">ANSWER EXPLANATION</label>
            <textarea id="q-explanation" class="form-control" style="min-height:90px;" placeholder="Explain why the answer is correct and why incorrect choices do not apply..."></textarea>
          </div>
          <div class="form-group" style="max-width:320px;">
            <label class="form-label" for="q-explanation-vis">Explanation Visibility</label>
            <select id="q-explanation-vis" class="form-control">
              <option value="after_submission" selected>After Submitting the Assessment</option>
              <option value="immediate">Immediately After Answering</option>
              <option value="after_window_closes">After Assessment Window Closes</option>
              <option value="manual_release">After Administrator Releases Results</option>
              <option value="never">Never Display Explanations</option>
            </select>
          </div>
        </fieldset>

        <!-- Step 8: Configure Question Settings -->
        <fieldset class="card" style="margin-bottom:1rem; border-color:var(--border);">
          <legend style="font-weight:700; font-size:0.95rem; padding:0 0.5rem; color:var(--primary);">Step 8: Scoring & Status Settings</legend>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="q-points">Points</label>
              <input type="number" id="q-points" class="form-control" value="1" min="0.5" step="0.5" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="q-status">Status</label>
              <select id="q-status" class="form-control">
                <option value="draft">Draft</option>
                <option value="ready_for_review">Ready for Review</option>
                <option value="approved">Approved</option>
                <option value="published" selected>Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="form-group" style="display:flex; flex-direction:column; justify-content:center;">
              <label style="display:flex; align-items:center; gap:0.5rem; font-weight:600; cursor:pointer;">
                <input type="checkbox" id="q-partial" style="width:1.1rem; height:1.1rem; accent-color:var(--primary);">
                Enable Partial Credit
              </label>
            </div>
            <div class="form-group" style="display:flex; flex-direction:column; justify-content:center;">
              <label style="display:flex; align-items:center; gap:0.5rem; font-weight:600; cursor:pointer;">
                <input type="checkbox" id="q-manual" style="width:1.1rem; height:1.1rem; accent-color:var(--primary);">
                Requires Manual Review
              </label>
            </div>
          </div>

          ${isEditing ? `
            <div class="card" style="background:var(--warning-bg); border-color:var(--warning-border); margin-top:1rem;">
              <h4 style="color:var(--warning); margin-bottom:0.35rem;">Controlled Versioning & Errata Protection</h4>
              <p style="font-size:0.8125rem; color:var(--text-main); margin-bottom:0.75rem;">
                This question may have been used in student attempts. Choose how this change should be handled:
              </p>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                <div class="form-group">
                  <label class="form-label" for="q-version-mode">Version Control Mode</label>
                  <select id="q-version-mode" class="form-control">
                    <option value="future_only" selected>Apply update to future attempts only (Preserve historical attempts)</option>
                    <option value="new_version">Create new Question Version (v+1)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="q-change-reason">Reason for Change / Errata Note</label>
                  <input type="text" id="q-change-reason" class="form-control" placeholder="e.g. Corrected typo in option B">
                </div>
              </div>
            </div>
          ` : ''}
        </fieldset>

        <!-- Step 10: Save Actions -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:1.5rem;">
          <div style="font-size:0.875rem; color:var(--text-muted);" id="q-save-status"></div>
          <div style="display:flex; gap:0.75rem;">
            <button type="submit" class="btn btn-secondary" data-action="draft">Save as Draft</button>
            <button type="submit" class="btn btn-primary" data-action="publish">${isEditing ? 'Save Changes' : 'Save Question'}</button>
          </div>
        </div>
      </form>
    </div>

    <!-- Student Preview Modal -->
    <dialog id="modal-preview">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;">Student View Preview</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-preview">&times;</button>
      </div>
      <div class="modal-body" id="preview-content"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-dismiss-preview">Close Preview</button>
      </div>
    </dialog>
  `;

  // Populate courses dropdown
  api.get('/courses').then(courses => {
    const select = container.querySelector('#q-course');
    select.innerHTML = '<option value="">-- No Specific Course (Global Bank) --</option>' +
      courses.map(c => `<option value="${c.id}" ${c.id === defaultCourseId ? 'selected' : ''}>${c.name} (${c.code})</option>`).join('');
  });

  const typeSelect = container.querySelector('#q-type');
  const dynamicEditor = container.querySelector('#dynamic-answer-editor');

  function renderAnswerEditor(type, initialOptions = null, initialCorrect = null) {
    if (type === 'yes_no') {
      const correct = initialCorrect || 'Yes';
      dynamicEditor.innerHTML = `
        <p class="form-hint">Automatically provides Yes and No. Select the correct answer below:</p>
        <div style="display:flex; gap:2rem; margin-top:0.75rem;">
          <label style="display:flex; align-items:center; gap:0.5rem; font-weight:600; cursor:pointer;">
            <input type="radio" name="ans-yes-no" value="Yes" ${correct === 'Yes' ? 'checked' : ''} style="width:1.2rem; height:1.2rem; accent-color:var(--primary);">
            Yes
          </label>
          <label style="display:flex; align-items:center; gap:0.5rem; font-weight:600; cursor:pointer;">
            <input type="radio" name="ans-yes-no" value="No" ${correct === 'No' ? 'checked' : ''} style="width:1.2rem; height:1.2rem; accent-color:var(--primary);">
            No
          </label>
        </div>
      `;
    } else if (type === 'true_false') {
      const correct = initialCorrect || 'True';
      dynamicEditor.innerHTML = `
        <p class="form-hint">Automatically provides True and False. Select the correct answer below:</p>
        <div style="display:flex; gap:2rem; margin-top:0.75rem;">
          <label style="display:flex; align-items:center; gap:0.5rem; font-weight:600; cursor:pointer;">
            <input type="radio" name="ans-tf" value="True" ${correct === 'True' ? 'checked' : ''} style="width:1.2rem; height:1.2rem; accent-color:var(--primary);">
            True
          </label>
          <label style="display:flex; align-items:center; gap:0.5rem; font-weight:600; cursor:pointer;">
            <input type="radio" name="ans-tf" value="False" ${correct === 'False' ? 'checked' : ''} style="width:1.2rem; height:1.2rem; accent-color:var(--primary);">
            False
          </label>
        </div>
      `;
    } else if (type === 'single_choice' || type === 'scenario' || type === 'case_study') {
      const options = initialOptions || [
        { id: 'opt_1', text: 'Option A' },
        { id: 'opt_2', text: 'Option B' },
        { id: 'opt_3', text: 'Option C' },
        { id: 'opt_4', text: 'Option D' }
      ];
      const correct = initialCorrect || options[0].id;

      dynamicEditor.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <p class="form-hint" style="margin:0;">Add options and mark the single correct radio button:</p>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-add-choice">+ Add Option</button>
        </div>
        <div id="choices-list" style="display:flex; flex-direction:column; gap:0.75rem;">
          ${options.map((opt, i) => `
            <div class="choice-row" style="display:flex; align-items:center; gap:0.75rem;">
              <input type="radio" name="correct_single" value="${opt.id}" ${opt.id === correct ? 'checked' : ''} title="Mark as correct" style="width:1.25rem; height:1.25rem; accent-color:var(--primary);">
              <input type="text" class="form-control choice-text" data-id="${opt.id}" value="${opt.text}" placeholder="Option text" required style="flex:1;">
              <button type="button" class="btn btn-secondary btn-sm btn-del-choice" title="Remove">&times;</button>
            </div>
          `).join('')}
        </div>
      `;

      dynamicEditor.querySelector('#btn-add-choice').onclick = () => {
        const id = 'opt_' + Date.now();
        const row = document.createElement('div');
        row.className = 'choice-row';
        row.style.cssText = 'display:flex; align-items:center; gap:0.75rem;';
        row.innerHTML = `
          <input type="radio" name="correct_single" value="${id}" style="width:1.25rem; height:1.25rem; accent-color:var(--primary);">
          <input type="text" class="form-control choice-text" data-id="${id}" placeholder="New Option" required style="flex:1;">
          <button type="button" class="btn btn-secondary btn-sm btn-del-choice" title="Remove">&times;</button>
        `;
        row.querySelector('.btn-del-choice').onclick = () => row.remove();
        dynamicEditor.querySelector('#choices-list').appendChild(row);
      };

      dynamicEditor.querySelectorAll('.btn-del-choice').forEach(btn => {
        btn.onclick = (e) => e.target.closest('.choice-row').remove();
      });
    } else if (type === 'multiple_response') {
      const options = initialOptions || [
        { id: 'opt_1', text: 'Option A' },
        { id: 'opt_2', text: 'Option B' },
        { id: 'opt_3', text: 'Option C' },
        { id: 'opt_4', text: 'Option D' }
      ];
      const correctArr = Array.isArray(initialCorrect) ? initialCorrect : ['opt_1', 'opt_2'];

      dynamicEditor.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <p class="form-hint" style="margin:0;">Select multiple checkboxes for the correct answers. Specify selection limits:</p>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-add-multi-choice">+ Add Option</button>
        </div>
        <div style="margin-bottom:0.75rem; max-width:240px;">
          <label class="form-label" for="q-required-count">Required Selection Count</label>
          <input type="number" id="q-required-count" class="form-control" value="${correctArr.length}" min="1">
        </div>
        <div id="multi-choices-list" style="display:flex; flex-direction:column; gap:0.75rem;">
          ${options.map((opt) => `
            <div class="multi-choice-row" style="display:flex; align-items:center; gap:0.75rem;">
              <input type="checkbox" class="correct-multi-cb" value="${opt.id}" ${correctArr.includes(opt.id) ? 'checked' : ''} style="width:1.25rem; height:1.25rem; accent-color:var(--primary);">
              <input type="text" class="form-control multi-choice-text" data-id="${opt.id}" value="${opt.text}" placeholder="Option text" required style="flex:1;">
              <button type="button" class="btn btn-secondary btn-sm btn-del-multi" title="Remove">&times;</button>
            </div>
          `).join('')}
        </div>
      `;

      dynamicEditor.querySelector('#btn-add-multi-choice').onclick = () => {
        const id = 'opt_' + Date.now();
        const row = document.createElement('div');
        row.className = 'multi-choice-row';
        row.style.cssText = 'display:flex; align-items:center; gap:0.75rem;';
        row.innerHTML = `
          <input type="checkbox" class="correct-multi-cb" value="${id}" style="width:1.25rem; height:1.25rem; accent-color:var(--primary);">
          <input type="text" class="form-control multi-choice-text" data-id="${id}" placeholder="New Option" required style="flex:1;">
          <button type="button" class="btn btn-secondary btn-sm btn-del-multi" title="Remove">&times;</button>
        `;
        row.querySelector('.btn-del-multi').onclick = () => row.remove();
        dynamicEditor.querySelector('#multi-choices-list').appendChild(row);
      };

      dynamicEditor.querySelectorAll('.btn-del-multi').forEach(btn => {
        btn.onclick = (e) => e.target.closest('.multi-choice-row').remove();
      });
    } else if (type === 'matching') {
      // Parse initial sources and targets
      let sourceTitle = 'Storage service';
      let targetTitle = 'Answer Area';
      let sources = [];
      let targets = [];

      if (initialOptions && typeof initialOptions === 'object' && !Array.isArray(initialOptions) && (initialOptions.sources || initialOptions.targets)) {
        sourceTitle = initialOptions.source_title || 'Storage service';
        targetTitle = initialOptions.target_title || 'Answer Area';
        sources = Array.isArray(initialOptions.sources) ? initialOptions.sources : [];
        targets = Array.isArray(initialOptions.targets) ? initialOptions.targets : [];
      } else if (Array.isArray(initialOptions) && initialOptions.length > 0) {
        // Migrate legacy pairs
        sources = initialOptions.map((p, idx) => ({ id: 'src_' + (idx + 1), text: p.left || '' }));
        targets = initialOptions.map((p, idx) => ({ id: 'tgt_' + (idx + 1), text: p.right || '', correct_source_id: 'src_' + (idx + 1) }));
      } else {
        // Default to Microsoft demo azure storage matching from screenshot
        sources = [
          { id: 'src_1', text: 'Azure Blob storage' },
          { id: 'src_2', text: 'Azure Disk storage' },
          { id: 'src_3', text: 'Azure Files' },
          { id: 'src_4', text: 'Azure Queue Storage' }
        ];
        targets = [
          { id: 'tgt_1', text: 'Used for reliable messaging between applications', correct_source_id: 'src_4' },
          { id: 'tgt_2', text: 'Can be accessed as a network share from a Windows device', correct_source_id: 'src_3' },
          { id: 'tgt_3', text: 'Can be configured to use the Archive access tier', correct_source_id: 'src_1' }
        ];
      }

      // If initialCorrect provided as object { tgt_id: src_id }
      if (initialCorrect && typeof initialCorrect === 'object' && !Array.isArray(initialCorrect)) {
        targets.forEach(t => {
          if (initialCorrect[t.id]) {
            t.correct_source_id = initialCorrect[t.id];
          } else if (initialCorrect[t.text]) {
            const matchedSrc = sources.find(s => s.text === initialCorrect[t.text]);
            if (matchedSrc) t.correct_source_id = matchedSrc.id;
          }
        });
      }

      dynamicEditor.innerHTML = `
        <div style="background:var(--surface-subtle); border:1px solid var(--border); border-left:4px solid var(--accent, #0098db); padding:0.85rem 1rem; border-radius:var(--radius-sm); margin-bottom:1.25rem;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.25rem;">
            <strong style="color:var(--accent, #0098db); font-size:0.875rem; letter-spacing:0.5px;">MICROSOFT EXAM FORMAT: DRAG DROP MATCHING</strong>
            <span class="badge badge-primary">2-Column Layout</span>
          </div>
          <p class="form-hint" style="margin:0; font-size:0.85rem; line-height:1.45;">
            Configure the draggable source items pool on the left (including optional distractors) and the target descriptions in the Answer Area on the right. For each target, select which source item is the correct answer.
          </p>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
          <!-- Left Column: Source Items Pool -->
          <div class="card" style="margin:0; padding:1.25rem; border-top:3px solid var(--accent, #0098db);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <div>
                <strong style="font-size:0.95rem;">Left Column: Source Items Pool</strong>
                <div class="form-hint" style="margin:0.15rem 0 0 0; font-size:0.8rem;">Draggable items (can include distractors)</div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-source">+ Add Item</button>
            </div>

            <div class="form-group" style="margin-bottom:1rem;">
              <label class="form-label" style="font-size:0.8rem; font-weight:700;">Column Title</label>
              <input type="text" class="form-control" id="matching-source-title" value="${escapeHtml(sourceTitle)}" placeholder="e.g. Storage service, Options, or Services" required>
            </div>

            <div id="sources-list" style="display:flex; flex-direction:column; gap:0.65rem;">
              ${sources.map((s, idx) => `
                <div class="source-item-row" data-id="${s.id || ('src_' + (idx + 1))}" style="display:flex; align-items:center; gap:0.5rem; background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--accent, #00a4ef); padding:0.5rem 0.65rem; border-radius:4px;">
                  <span style="color:var(--accent, #00a4ef); font-weight:700; font-size:0.8rem; min-width:20px;">#${idx + 1}</span>
                  <input type="text" class="form-control source-item-text" value="${escapeHtml(s.text || '')}" placeholder="Source item text..." required style="flex:1; padding:0.4rem 0.6rem; font-size:0.9rem;">
                  <button type="button" class="btn btn-secondary btn-sm btn-del-source" title="Remove item" style="padding:0.25rem 0.5rem; color:var(--danger);">&times;</button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Right Column: Answer Area Targets -->
          <div class="card" style="margin:0; padding:1.25rem; border-top:3px solid var(--brand-lime, #62b017);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <div>
                <strong style="font-size:0.95rem;">Right Column: Answer Area</strong>
                <div class="form-hint" style="margin:0.15rem 0 0 0; font-size:0.8rem;">Target descriptions &amp; correct matches</div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-target">+ Add Target</button>
            </div>

            <div class="form-group" style="margin-bottom:1rem;">
              <label class="form-label" style="font-size:0.8rem; font-weight:700;">Answer Area Title</label>
              <input type="text" class="form-control" id="matching-target-title" value="${escapeHtml(targetTitle)}" placeholder="e.g. Answer Area" required>
            </div>

            <div id="targets-list" style="display:flex; flex-direction:column; gap:0.75rem;">
              ${targets.map((t, idx) => `
                <div class="target-item-row" data-id="${t.id || ('tgt_' + (idx + 1))}" style="background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--brand-lime, #62b017); padding:0.65rem; border-radius:4px; display:flex; flex-direction:column; gap:0.5rem;">
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-weight:700; font-size:0.825rem; color:var(--text-muted);">Slot #${idx + 1} Target Description</span>
                    <button type="button" class="btn btn-secondary btn-sm btn-del-target" title="Remove target" style="padding:0.15rem 0.45rem; color:var(--danger);">&times;</button>
                  </div>
                  <textarea class="form-control target-item-text" rows="2" placeholder="Description in Answer Area (e.g. Used for reliable messaging...)" required style="font-size:0.875rem; resize:vertical;">${escapeHtml(t.text || '')}</textarea>
                  <div style="display:flex; align-items:center; gap:0.5rem; background:rgba(0,164,239,0.06); padding:0.4rem 0.6rem; border-radius:4px;">
                    <span style="font-size:0.8rem; font-weight:700; color:var(--text-main); white-space:nowrap;">Correct Match:</span>
                    <select class="form-control target-correct-select" data-selected="${t.correct_source_id || ''}" style="flex:1; padding:0.35rem 0.5rem; font-size:0.85rem; font-weight:600;">
                      <option value="">-- Choose correct source item --</option>
                    </select>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      function getSources() {
        const list = [];
        dynamicEditor.querySelectorAll('.source-item-row').forEach((r, idx) => {
          const id = r.dataset.id || ('src_' + (idx + 1));
          const text = r.querySelector('.source-item-text').value.trim();
          list.push({ id, text });
        });
        return list;
      }

      function updateCorrectSelects() {
        const currentSources = getSources();
        dynamicEditor.querySelectorAll('.target-item-row').forEach(tr => {
          const select = tr.querySelector('.target-correct-select');
          const currentVal = select.value || select.dataset.selected || '';
          select.innerHTML = '<option value="">-- Choose correct source item --</option>' +
            currentSources.map(s => {
              const label = s.text ? s.text : `(Item #${s.id})`;
              const isSel = currentVal === s.id ? 'selected' : '';
              return `<option value="${s.id}" ${isSel}>${escapeHtml(label)}</option>`;
            }).join('');
          select.dataset.selected = select.value;
        });
      }

      // Initial populate of selects
      updateCorrectSelects();

      // Listen for changes in source text to update selects
      dynamicEditor.querySelector('#sources-list').addEventListener('input', (e) => {
        if (e.target.classList.contains('source-item-text')) {
          updateCorrectSelects();
        }
      });

      // Add Source Item
      dynamicEditor.querySelector('#btn-add-source').onclick = () => {
        const list = dynamicEditor.querySelector('#sources-list');
        const count = list.children.length + 1;
        const newId = 'src_' + Date.now();
        const row = document.createElement('div');
        row.className = 'source-item-row';
        row.dataset.id = newId;
        row.style.cssText = 'display:flex; align-items:center; gap:0.5rem; background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--accent, #00a4ef); padding:0.5rem 0.65rem; border-radius:4px;';
        row.innerHTML = `
          <span style="color:var(--accent, #00a4ef); font-weight:700; font-size:0.8rem; min-width:20px;">#${count}</span>
          <input type="text" class="form-control source-item-text" value="" placeholder="Source item text..." required style="flex:1; padding:0.4rem 0.6rem; font-size:0.9rem;">
          <button type="button" class="btn btn-secondary btn-sm btn-del-source" title="Remove item" style="padding:0.25rem 0.5rem; color:var(--danger);">&times;</button>
        `;
        row.querySelector('.btn-del-source').onclick = () => {
          if (list.children.length <= 1) {
            alert('A matching question requires at least one source item.');
            return;
          }
          row.remove();
          updateCorrectSelects();
        };
        list.appendChild(row);
        updateCorrectSelects();
        row.querySelector('.source-item-text').focus();
      };

      // Add Target Slot
      dynamicEditor.querySelector('#btn-add-target').onclick = () => {
        const list = dynamicEditor.querySelector('#targets-list');
        const count = list.children.length + 1;
        const newId = 'tgt_' + Date.now();
        const row = document.createElement('div');
        row.className = 'target-item-row';
        row.dataset.id = newId;
        row.style.cssText = 'background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--brand-lime, #62b017); padding:0.65rem; border-radius:4px; display:flex; flex-direction:column; gap:0.5rem;';
        row.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <span style="font-weight:700; font-size:0.825rem; color:var(--text-muted);">Slot #${count} Target Description</span>
            <button type="button" class="btn btn-secondary btn-sm btn-del-target" title="Remove target" style="padding:0.15rem 0.45rem; color:var(--danger);">&times;</button>
          </div>
          <textarea class="form-control target-item-text" rows="2" placeholder="Description in Answer Area (e.g. Used for reliable messaging...)" required style="font-size:0.875rem; resize:vertical;"></textarea>
          <div style="display:flex; align-items:center; gap:0.5rem; background:rgba(0,164,239,0.06); padding:0.4rem 0.6rem; border-radius:4px;">
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-main); white-space:nowrap;">Correct Match:</span>
            <select class="form-control target-correct-select" style="flex:1; padding:0.35rem 0.5rem; font-size:0.85rem; font-weight:600;">
              <option value="">-- Choose correct source item --</option>
            </select>
          </div>
        `;
        row.querySelector('.btn-del-target').onclick = () => {
          if (list.children.length <= 1) {
            alert('A matching question requires at least one target description.');
            return;
          }
          row.remove();
        };
        list.appendChild(row);
        updateCorrectSelects();
        row.querySelector('.target-item-text').focus();
      };

      // Delete handlers for existing rows
      dynamicEditor.querySelectorAll('.btn-del-source').forEach(btn => {
        btn.onclick = (e) => {
          const list = dynamicEditor.querySelector('#sources-list');
          if (list.children.length <= 1) {
            alert('A matching question requires at least one source item.');
            return;
          }
          e.target.closest('.source-item-row').remove();
          updateCorrectSelects();
        };
      });

      dynamicEditor.querySelectorAll('.btn-del-target').forEach(btn => {
        btn.onclick = (e) => {
          const list = dynamicEditor.querySelector('#targets-list');
          if (list.children.length <= 1) {
            alert('A matching question requires at least one target description.');
            return;
          }
          e.target.closest('.target-item-row').remove();
        };
      });
    } else if (type === 'ordering') {
      const steps = Array.isArray(initialOptions) && initialOptions.length ? initialOptions : [
        { id: 's1', text: 'Step 1: First action' },
        { id: 's2', text: 'Step 2: Second action' },
        { id: 's3', text: 'Step 3: Third action' }
      ];

      dynamicEditor.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <p class="form-hint" style="margin:0;">List the items in their CORRECT chronological sequence. Order will be randomised for students:</p>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-add-step">+ Add Ordering Item</button>
        </div>
        <div id="steps-list" style="display:flex; flex-direction:column; gap:0.75rem;">
          ${steps.map((st, i) => `
            <div class="step-row" style="display:flex; align-items:center; gap:0.75rem;">
              <span class="step-badge" style="font-weight:700; background:var(--surface-subtle); padding:0.4rem 0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border);">${i + 1}</span>
              <input type="text" class="form-control step-text" data-id="${st.id || ('s_' + i)}" value="${st.text || ''}" placeholder="Step description" required style="flex:1;">
              <button type="button" class="btn btn-secondary btn-sm btn-del-step" title="Remove">&times;</button>
            </div>
          `).join('')}
        </div>
      `;

      dynamicEditor.querySelector('#btn-add-step').onclick = () => {
        const list = dynamicEditor.querySelector('#steps-list');
        const count = list.children.length + 1;
        const row = document.createElement('div');
        row.className = 'step-row';
        row.style.cssText = 'display:flex; align-items:center; gap:0.75rem;';
        row.innerHTML = `
          <span class="step-badge" style="font-weight:700; background:var(--surface-subtle); padding:0.4rem 0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border);">${count}</span>
          <input type="text" class="form-control step-text" data-id="s_${Date.now()}" placeholder="New step description" required style="flex:1;">
          <button type="button" class="btn btn-secondary btn-sm btn-del-step" title="Remove">&times;</button>
        `;
        row.querySelector('.btn-del-step').onclick = () => {
          row.remove();
          list.querySelectorAll('.step-badge').forEach((b, idx) => b.textContent = idx + 1);
        };
        list.appendChild(row);
      };

      dynamicEditor.querySelectorAll('.btn-del-step').forEach(btn => {
        btn.onclick = (e) => {
          e.target.closest('.step-row').remove();
          dynamicEditor.querySelectorAll('.step-badge').forEach((b, idx) => b.textContent = idx + 1);
        };
      });
    } else if (type === 'fill_blank') {
      const correctVal = typeof initialCorrect === 'string' ? initialCorrect : (Array.isArray(initialCorrect) ? initialCorrect.join('|') : '');
      dynamicEditor.innerHTML = `
        <div class="form-group">
          <label class="form-label" for="fb-accepted">Accepted Answer(s) (separate multiple accepted answers with |)</label>
          <input type="text" id="fb-accepted" class="form-control" value="${correctVal}" placeholder="e.g. az group create | az group create -n" required>
          <p class="form-hint">Separate variations with the pipe symbol (|).</p>
        </div>
        <div style="display:flex; gap:1.5rem; margin-top:0.75rem;">
          <label style="display:flex; align-items:center; gap:0.5rem; font-weight:600; cursor:pointer;">
            <input type="checkbox" id="fb-case" style="width:1.1rem; height:1.1rem; accent-color:var(--primary);">
            Case-sensitive matching
          </label>
          <label style="display:flex; align-items:center; gap:0.5rem; font-weight:600; cursor:pointer;">
            <input type="checkbox" id="fb-spaces" checked style="width:1.1rem; height:1.1rem; accent-color:var(--primary);">
            Ignore extra spaces
          </label>
        </div>
      `;
    } else if (type === 'hot_area') {
      const regions = Array.isArray(initialOptions) && initialOptions.length ? initialOptions : [
        { id: 'area_1', label: 'Region 1: Gateway Subnet' },
        { id: 'area_2', label: 'Region 2: Firewall Subnet' }
      ];
      const correct = initialCorrect || 'area_1';

      dynamicEditor.innerHTML = `
        <div class="form-group">
          <label class="form-label">Defined Selectable Regions & Correct Area</label>
          <div id="regions-list" style="display:flex; flex-direction:column; gap:0.75rem;">
            ${regions.map(r => `
              <div class="region-row" style="display:flex; align-items:center; gap:0.75rem;">
                <input type="radio" name="hot_correct" value="${r.id}" ${r.id === correct ? 'checked' : ''} title="Mark as correct region" style="width:1.25rem; height:1.25rem; accent-color:var(--primary);">
                <input type="text" class="form-control region-id" value="${r.id}" placeholder="Area ID" style="max-width:140px;" required>
                <input type="text" class="form-control region-label" value="${r.label}" placeholder="Region label / alternative text" required style="flex:1;">
                <button type="button" class="btn btn-secondary btn-sm btn-del-reg">&times;</button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-add-reg" style="margin-top:0.75rem;">+ Add Region</button>
        </div>
      `;

      dynamicEditor.querySelector('#btn-add-reg').onclick = () => {
        const id = 'area_' + Date.now();
        const row = document.createElement('div');
        row.className = 'region-row';
        row.style.cssText = 'display:flex; align-items:center; gap:0.75rem;';
        row.innerHTML = `
          <input type="radio" name="hot_correct" value="${id}" style="width:1.25rem; height:1.25rem; accent-color:var(--primary);">
          <input type="text" class="form-control region-id" value="${id}" placeholder="Area ID" style="max-width:140px;" required>
          <input type="text" class="form-control region-label" placeholder="Region label" required style="flex:1;">
          <button type="button" class="btn btn-secondary btn-sm btn-del-reg">&times;</button>
        `;
        row.querySelector('.btn-del-reg').onclick = () => row.remove();
        dynamicEditor.querySelector('#regions-list').appendChild(row);
      };

      dynamicEditor.querySelectorAll('.btn-del-reg').forEach(b => {
        b.onclick = (e) => e.target.closest('.region-row').remove();
      });
    } else if (type === 'hotspot') {
      const defaultStatements = [
        { id: 'stmt_1', statement: 'To achieve a hybrid cloud model, a company must always migrate from a private cloud model.', correct: 'No' },
        { id: 'stmt_2', statement: 'A company can extend the capacity of its internal network by using the public cloud.', correct: 'Yes' },
        { id: 'stmt_3', statement: 'In a public cloud model, only guest users at your company can access the resources in the cloud.', correct: 'No' }
      ];

      let statements = [];
      if (Array.isArray(initialOptions) && initialOptions.length) {
        statements = initialOptions.map((st, i) => {
          const sId = st.id || ('stmt_' + (i + 1));
          const sText = st.statement || st.text || (typeof st === 'string' ? st : '');
          let sCorrect = 'No';
          if (initialCorrect && typeof initialCorrect === 'object') {
            sCorrect = initialCorrect[sId] || initialCorrect[sText] || 'No';
          }
          return { id: sId, statement: sText, correct: sCorrect };
        });
      } else {
        statements = defaultStatements;
      }

      // Default partial credit to true and points to statement count
      const partialCb = container.querySelector('#q-partial');
      if (partialCb && !isEditing) partialCb.checked = true;
      const pointsInput = container.querySelector('#q-points');
      if (pointsInput && !isEditing) pointsInput.value = statements.length;

      // Prefill question text and description if currently blank
      const qTextInput = container.querySelector('#q-text');
      if (qTextInput && !qTextInput.value.trim()) {
        qTextInput.value = 'For each of the following statements, select Yes if the statement is true. Otherwise, select No.';
      }
      const qDescInput = container.querySelector('#q-desc');
      if (qDescInput && !qDescInput.value.trim()) {
        qDescInput.value = 'NOTE: Each correct selection is worth one point.\nHot Area:\nAnswer Area';
      }

      dynamicEditor.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <p class="form-hint" style="margin:0;">
              Hotspot Answer Area: List the statements and select the correct answer (<strong>Yes</strong> or <strong>No</strong>) for each.
            </p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-add-hotspot-stmt">+ Add Statement</button>
        </div>

        <div style="border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; background:var(--surface);">
          <div style="padding:0.75rem 1rem; background:var(--surface-subtle); border-bottom:1px solid var(--border); font-weight:800; display:flex; justify-content:space-between; align-items:center;">
            <span style="flex:1;">Statements</span>
            <div style="display:flex; gap:2.5rem; margin-right:3rem; font-weight:800;">
              <span style="width:2rem; text-align:center;">Yes</span>
              <span style="width:2rem; text-align:center;">No</span>
            </div>
          </div>
          <div id="hotspot-statements-list" style="display:flex; flex-direction:column;">
            ${statements.map((st, i) => `
              <div class="hotspot-stmt-row" style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; border-bottom:1px solid var(--border);">
                <span class="badge badge-neutral" style="font-weight:700;">${i + 1}</span>
                <input type="text" class="form-control hotspot-stmt-text" data-id="${escapeHtml(st.id)}" value="${escapeHtml(st.statement)}" placeholder="Enter statement text..." required style="flex:1;">
                <div style="display:flex; gap:2.5rem; align-items:center; margin:0 1rem;">
                  <label style="display:flex; align-items:center; justify-content:center; width:2rem; cursor:pointer;" title="Mark Yes as correct">
                    <input type="radio" name="hot_correct_${escapeHtml(st.id)}" value="Yes" ${String(st.correct).toLowerCase() === 'yes' ? 'checked' : ''} style="width:1.25rem; height:1.25rem; accent-color:var(--brand-magenta); cursor:pointer;">
                  </label>
                  <label style="display:flex; align-items:center; justify-content:center; width:2rem; cursor:pointer;" title="Mark No as correct">
                    <input type="radio" name="hot_correct_${escapeHtml(st.id)}" value="No" ${String(st.correct).toLowerCase() !== 'yes' ? 'checked' : ''} style="width:1.25rem; height:1.25rem; accent-color:var(--brand-magenta); cursor:pointer;">
                  </label>
                </div>
                <button type="button" class="btn btn-secondary btn-sm btn-del-hotspot-stmt" title="Delete statement">&times;</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      function updateHotspotRowIndices() {
        const rows = dynamicEditor.querySelectorAll('.hotspot-stmt-row');
        rows.forEach((r, idx) => {
          const badge = r.querySelector('.badge');
          if (badge) badge.textContent = idx + 1;
        });
        const pInput = container.querySelector('#q-points');
        if (pInput && !isEditing) pInput.value = rows.length || 1;
      }

      dynamicEditor.querySelectorAll('.btn-del-hotspot-stmt').forEach(btn => {
        btn.onclick = (e) => {
          const rows = dynamicEditor.querySelectorAll('.hotspot-stmt-row');
          if (rows.length <= 1) {
            alert('A Hotspot question requires at least one statement.');
            return;
          }
          e.target.closest('.hotspot-stmt-row').remove();
          updateHotspotRowIndices();
        };
      });

      dynamicEditor.querySelector('#btn-add-hotspot-stmt').onclick = () => {
        const list = dynamicEditor.querySelector('#hotspot-statements-list');
        const count = list.children.length + 1;
        const sId = 'stmt_' + Date.now();
        const row = document.createElement('div');
        row.className = 'hotspot-stmt-row';
        row.style.cssText = 'display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; border-bottom:1px solid var(--border);';
        row.innerHTML = `
          <span class="badge badge-neutral" style="font-weight:700;">${count}</span>
          <input type="text" class="form-control hotspot-stmt-text" data-id="${sId}" value="" placeholder="Enter statement text..." required style="flex:1;">
          <div style="display:flex; gap:2.5rem; align-items:center; margin:0 1rem;">
            <label style="display:flex; align-items:center; justify-content:center; width:2rem; cursor:pointer;" title="Mark Yes as correct">
              <input type="radio" name="hot_correct_${sId}" value="Yes" style="width:1.25rem; height:1.25rem; accent-color:var(--brand-magenta); cursor:pointer;">
            </label>
            <label style="display:flex; align-items:center; justify-content:center; width:2rem; cursor:pointer;" title="Mark No as correct">
              <input type="radio" name="hot_correct_${sId}" value="No" checked style="width:1.25rem; height:1.25rem; accent-color:var(--brand-magenta); cursor:pointer;">
            </label>
          </div>
          <button type="button" class="btn btn-secondary btn-sm btn-del-hotspot-stmt" title="Delete statement">&times;</button>
        `;
        row.querySelector('.btn-del-hotspot-stmt').onclick = () => {
          const allRows = dynamicEditor.querySelectorAll('.hotspot-stmt-row');
          if (allRows.length <= 1) {
            alert('A Hotspot question requires at least one statement.');
            return;
          }
          row.remove();
          updateHotspotRowIndices();
        };
        list.appendChild(row);
        updateHotspotRowIndices();
        row.querySelector('.hotspot-stmt-text').focus();
      };
    } else {
      // Fallback for categorisation & dropdown
      dynamicEditor.innerHTML = `
        <div class="form-group">
          <label class="form-label" for="q-custom-options">Options / Configuration (JSON)</label>
          <textarea id="q-custom-options" class="form-control" style="font-family:var(--font-mono); font-size:0.8125rem;">${JSON.stringify(initialOptions || [], null, 2)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="q-custom-correct">Correct Answer Key (JSON or string)</label>
          <textarea id="q-custom-correct" class="form-control" style="font-family:var(--font-mono); font-size:0.8125rem;">${JSON.stringify(initialCorrect || '', null, 2)}</textarea>
        </div>
      `;
    }
  }

  // Type change listener
  typeSelect.onchange = () => {
    renderAnswerEditor(typeSelect.value);
  };

  // If editing, load question data
  if (isEditing) {
    api.get(`/questions/${questionId}`).then(q => {
      currentQuestion = q;
      container.querySelector('#q-course').value = q.course_id || '';
      container.querySelector('#q-topic').value = q.topic || '';
      container.querySelector('#q-objective').value = q.learning_objective || '';
      container.querySelector('#q-difficulty').value = q.difficulty || 'medium';
      container.querySelector('#q-tags').value = Array.isArray(q.tags) ? q.tags.join(', ') : (q.tags || '');
      typeSelect.value = q.question_type;
      container.querySelector('#q-text').value = q.question_text || '';
      container.querySelector('#q-desc').value = q.question_description || '';
      container.querySelector('#q-explanation').value = q.answer_explanation || '';
      container.querySelector('#q-explanation-vis').value = q.explanation_visibility || 'after_submission';
      container.querySelector('#q-points').value = q.points || 1;
      container.querySelector('#q-status').value = q.status || 'draft';
      container.querySelector('#q-partial').checked = Boolean(q.partial_credit);
      container.querySelector('#q-manual').checked = Boolean(q.requires_manual_review);

      renderAnswerEditor(q.question_type, q.answer_options, q.correct_answer);
    });
  } else {
    renderAnswerEditor('single_choice');
  }

  // Collect formData
  function collectFormData() {
    const type = typeSelect.value;
    const text = container.querySelector('#q-text').value.trim();
    const desc = container.querySelector('#q-desc').value.trim();
    const topic = container.querySelector('#q-topic').value.trim();
    const objective = container.querySelector('#q-objective').value.trim();
    const difficulty = container.querySelector('#q-difficulty').value;
    const courseId = container.querySelector('#q-course').value || null;
    const explanation = container.querySelector('#q-explanation').value.trim();
    const explanationVis = container.querySelector('#q-explanation-vis').value;
    const points = parseFloat(container.querySelector('#q-points').value || '1');
    const status = container.querySelector('#q-status').value;
    const partial = container.querySelector('#q-partial').checked;
    const manual = container.querySelector('#q-manual').checked;

    const tagsRaw = container.querySelector('#q-tags').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    let options = [];
    let correct = null;
    let requiredCount = null;

    if (type === 'yes_no') {
      options = ['Yes', 'No'];
      const checked = dynamicEditor.querySelector('input[name="ans-yes-no"]:checked');
      correct = checked ? checked.value : 'Yes';
    } else if (type === 'true_false') {
      options = ['True', 'False'];
      const checked = dynamicEditor.querySelector('input[name="ans-tf"]:checked');
      correct = checked ? checked.value : 'True';
    } else if (type === 'single_choice' || type === 'scenario' || type === 'case_study') {
      const rows = dynamicEditor.querySelectorAll('.choice-row');
      rows.forEach(r => {
        const input = r.querySelector('.choice-text');
        const id = input.dataset.id;
        const txt = input.value.trim();
        if (txt) options.push({ id, text: txt });
      });
      const checked = dynamicEditor.querySelector('input[name="correct_single"]:checked');
      correct = checked ? checked.value : (options[0]?.id || '');
    } else if (type === 'multiple_response') {
      const rows = dynamicEditor.querySelectorAll('.multi-choice-row');
      correct = [];
      rows.forEach(r => {
        const input = r.querySelector('.multi-choice-text');
        const id = input.dataset.id;
        const txt = input.value.trim();
        const isChecked = r.querySelector('.correct-multi-cb').checked;
        if (txt) {
          options.push({ id, text: txt });
          if (isChecked) correct.push(id);
        }
      });
      const countInput = dynamicEditor.querySelector('#q-required-count');
      requiredCount = countInput ? parseInt(countInput.value, 10) : correct.length;
    } else if (type === 'matching') {
      const sourceTitle = dynamicEditor.querySelector('#matching-source-title')?.value.trim() || 'Storage service';
      const targetTitle = dynamicEditor.querySelector('#matching-target-title')?.value.trim() || 'Answer Area';

      const sources = [];
      dynamicEditor.querySelectorAll('.source-item-row').forEach((r, idx) => {
        const id = r.dataset.id || ('src_' + (idx + 1));
        const txt = r.querySelector('.source-item-text').value.trim();
        if (txt) sources.push({ id, text: txt });
      });

      const targets = [];
      correct = {};
      const pairs = [];

      dynamicEditor.querySelectorAll('.target-item-row').forEach((r, idx) => {
        const id = r.dataset.id || ('tgt_' + (idx + 1));
        const txt = r.querySelector('.target-item-text').value.trim();
        const sel = r.querySelector('.target-correct-select');
        const correctSrcId = sel ? sel.value : '';

        if (txt) {
          targets.push({ id, text: txt, correct_source_id: correctSrcId });
          if (correctSrcId) {
            correct[id] = correctSrcId;
            const srcObj = sources.find(s => s.id === correctSrcId);
            if (srcObj) {
              pairs.push({ left: srcObj.text, right: txt });
            }
          }
        }
      });

      // Legacy fallback
      if (sources.length === 0 && targets.length === 0) {
        const rows = dynamicEditor.querySelectorAll('.pair-row');
        rows.forEach(r => {
          const l = r.querySelector('.pair-left')?.value.trim();
          const rt = r.querySelector('.pair-right')?.value.trim();
          if (l && rt) pairs.push({ left: l, right: rt });
        });
        options = pairs;
        correct = pairs;
      } else {
        options = {
          source_title: sourceTitle,
          target_title: targetTitle,
          sources,
          targets,
          pairs
        };
      }
    } else if (type === 'ordering') {
      const rows = dynamicEditor.querySelectorAll('.step-row');
      correct = [];
      rows.forEach((r, i) => {
        const input = r.querySelector('.step-text');
        const id = input.dataset.id || ('s_' + i);
        const txt = input.value.trim();
        if (txt) {
          options.push({ id, text: txt });
          correct.push(id);
        }
      });
    } else if (type === 'fill_blank') {
      const accepted = dynamicEditor.querySelector('#fb-accepted').value.trim();
      correct = accepted;
      options = {
        case_sensitive: dynamicEditor.querySelector('#fb-case').checked,
        ignore_spaces: dynamicEditor.querySelector('#fb-spaces').checked,
        ignore_punctuation: true
      };
    } else if (type === 'hot_area') {
      const rows = dynamicEditor.querySelectorAll('.region-row');
      rows.forEach(r => {
        const id = r.querySelector('.region-id').value.trim();
        const lbl = r.querySelector('.region-label').value.trim();
        if (id && lbl) options.push({ id, label: lbl });
      });
      const checked = dynamicEditor.querySelector('input[name="hot_correct"]:checked');
      correct = checked ? checked.value : (options[0]?.id || '');
    } else if (type === 'hotspot') {
      const rows = dynamicEditor.querySelectorAll('.hotspot-stmt-row');
      correct = {};
      options = [];
      rows.forEach((r, i) => {
        const input = r.querySelector('.hotspot-stmt-text');
        const id = input.dataset.id || ('stmt_' + (i + 1));
        const txt = input.value.trim();
        const checkedRadio = r.querySelector(`input[name="hot_correct_${id}"]:checked`);
        const correctVal = checkedRadio ? checkedRadio.value : 'No';
        if (txt) {
          options.push({
            id,
            statement: txt,
            options: ['Yes', 'No']
          });
          correct[id] = correctVal;
        }
      });
    } else {
      try { options = JSON.parse(dynamicEditor.querySelector('#q-custom-options').value); } catch (e) { options = []; }
      try { correct = JSON.parse(dynamicEditor.querySelector('#q-custom-correct').value); } catch (e) { correct = ''; }
    }

    return {
      course_id: courseId,
      topic,
      learning_objective: objective,
      difficulty,
      tags,
      question_type: type,
      question_text: text,
      question_description: desc,
      answer_options: options,
      correct_answer: correct,
      answer_explanation: explanation,
      explanation_visibility: explanationVis,
      points,
      status,
      partial_credit: partial,
      requires_manual_review: manual,
      required_selection_count: requiredCount
    };
  }

  // Preview Question
  const previewModal = container.querySelector('#modal-preview');
  container.querySelector('#btn-preview-question').onclick = () => {
    const data = collectFormData();
    const content = container.querySelector('#preview-content');

    content.innerHTML = `
      <div style="margin-bottom:1rem;">
        <span class="badge badge-primary">${data.question_type.toUpperCase().replace('_', ' ')}</span>
        <span class="badge badge-neutral">${data.points} point(s)</span>
        <span class="badge badge-warning">${data.difficulty.toUpperCase()}</span>
      </div>

      ${data.question_description ? `
        <div class="question-description-box">
          <h4>Scenario Context</h4>
          <div style="white-space:pre-wrap;">${escapeHtml(data.question_description)}</div>
        </div>
      ` : ''}

      <div style="font-weight:700; font-size:1.1rem; margin-bottom:1rem;">
        ${escapeHtml(data.question_text)}
      </div>

      <div class="options-grid">
        ${renderStudentPreviewOptions(data)}
      </div>

      <div style="margin-top:1.5rem; padding:0.75rem; background:var(--surface-subtle); border-radius:var(--radius-md); font-size:0.8125rem;">
        <strong>Correct Answer Key:</strong> <code>${escapeHtml(JSON.stringify(data.correct_answer))}</code><br>
        <strong>Explanation:</strong> ${escapeHtml(data.answer_explanation || 'None provided.')}
      </div>
    `;

    previewModal.showModal();
  };

  container.querySelector('#btn-close-preview').onclick = () => previewModal.close();
  container.querySelector('#btn-dismiss-preview').onclick = () => previewModal.close();
  container.querySelector('#btn-cancel-question').onclick = () => {
    if (onSaved) onSaved(null);
  };

  // Submit Handler
  container.querySelector('#question-form').onsubmit = async (e) => {
    e.preventDefault();
    const saveStatus = container.querySelector('#q-save-status');
    const submitBtn = e.submitter;
    const action = submitBtn.dataset.action;

    try {
      const data = collectFormData();
      if (action === 'draft') {
        data.status = 'draft';
      }

      saveStatus.innerHTML = '<span style="color:var(--text-muted)">Saving question...</span>';

      let result = null;
      if (isEditing) {
        const versionMode = container.querySelector('#q-version-mode')?.value || 'future_only';
        const changeReason = container.querySelector('#q-change-reason')?.value || 'Admin update';
        result = await api.put(`/questions/${questionId}`, {
          data,
          version_mode: versionMode,
          change_reason: changeReason
        });
      } else {
        result = await api.post('/questions', data);
      }

      saveStatus.innerHTML = '<span style="color:var(--success); font-weight:600;">Question saved successfully!</span>';
      setTimeout(() => {
        if (onSaved) onSaved(result);
      }, 700);
    } catch (err) {
      saveStatus.innerHTML = `<span style="color:var(--danger); font-weight:600;">Error: ${err.message}</span>`;
    }
  };
}

function renderStudentPreviewOptions(data) {
  const type = data.question_type;
  if (type === 'yes_no' || type === 'true_false') {
    return (data.answer_options || []).map(opt => `
      <label class="option-card">
        <input type="radio" name="preview_ans">
        <span>${escapeHtml(opt)}</span>
      </label>
    `).join('');
  }

  if (type === 'single_choice' || type === 'scenario' || type === 'case_study') {
    return (data.answer_options || []).map(opt => `
      <label class="option-card">
        <input type="radio" name="preview_ans">
        <span>${escapeHtml(opt.text)}</span>
      </label>
    `).join('');
  }

  if (type === 'multiple_response') {
    return (data.answer_options || []).map(opt => `
      <label class="option-card">
        <input type="checkbox" name="preview_ans">
        <span>${escapeHtml(opt.text)}</span>
      </label>
    `).join('');
  }

  if (type === 'matching') {
    const opts = data.answer_options || {};
    let sourceTitle = opts.source_title || 'Storage service';
    let targetTitle = opts.target_title || 'Answer Area';
    let sources = [];
    let targets = [];

    if (Array.isArray(opts.sources) && opts.sources.length) {
      sources = opts.sources;
      targets = opts.targets || [];
    } else if (Array.isArray(opts)) {
      sources = opts.map((p, i) => ({ id: 'src_' + i, text: p.left }));
      targets = opts.map((p, i) => ({ id: 'tgt_' + i, text: p.right }));
    }

    return `
      <div class="ms-drag-container">
        <div class="ms-drag-header-badge">DRAG DROP</div>
        <p style="font-size:0.9rem; color:var(--text-main); margin:0.35rem 0 0.5rem 0; line-height:1.45;">
          To answer, drag the appropriate item from the column on the left to its description on the right. Each item may be used once, more than once, or not at all.
        </p>
        <p style="font-size:0.8rem; color:var(--text-muted); font-style:italic; margin-bottom:1rem;">
          NOTE: Each correct match is worth points.
        </p>

        <div class="ms-drag-board">
          <!-- Left Column -->
          <div>
            <div class="ms-drag-column-title">${escapeHtml(sourceTitle)}</div>
            ${sources.map(s => `
              <div class="ms-drag-card">
                <span>${escapeHtml(s.text)}</span>
                <span style="color:#00a4ef; font-size:0.8rem;">&#x283f;</span>
              </div>
            `).join('')}
          </div>

          <!-- Divider -->
          <div class="ms-drag-divider"></div>

          <!-- Right Column (Answer Area) -->
          <div>
            <div class="ms-drag-column-title">${escapeHtml(targetTitle)}</div>
            ${targets.map(t => `
              <div class="ms-drag-target-row">
                <div class="ms-drag-dropzone">
                  <span class="dz-placeholder">Drop here</span>
                </div>
                <div class="ms-drag-target-text">${escapeHtml(t.text)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  if (type === 'ordering') {
    return `
      <p class="form-hint">Ordering Steps:</p>
      ${(data.answer_options || []).map((st, i) => `
        <div class="card" style="margin-bottom:0.5rem; padding:0.5rem; display:flex; gap:0.5rem;">
          <span class="badge badge-neutral">${i + 1}</span>
          <span>${escapeHtml(st.text)}</span>
        </div>
      `).join('')}
    `;
  }

  if (type === 'fill_blank') {
    return `
      <input type="text" class="form-control" placeholder="Type your answer here..." style="max-width:360px;">
    `;
  }

  if (type === 'hot_area') {
    return `
      <div style="border:1px dashed var(--border); padding:1rem; border-radius:var(--radius-md); background:var(--surface-subtle);">
        <p style="font-weight:600; margin-bottom:0.5rem;">Selectable Diagram Regions:</p>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
          ${(data.answer_options || []).map(r => `
            <button type="button" class="btn btn-secondary">${escapeHtml(r.label)}</button>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (type === 'hotspot') {
    const statements = Array.isArray(data.answer_options) ? data.answer_options : [];
    return `
      <div style="border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; background:var(--surface); margin-top:0.75rem;">
        <div style="padding:0.75rem 1rem; background:var(--surface-subtle); border-bottom:1px solid var(--border); font-weight:800; font-family:var(--font-heading); display:flex; justify-content:space-between; align-items:center;">
          <span>Hot Area: Answer Area</span>
          <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">Select Yes or No for each statement</span>
        </div>
        <div class="table-container" style="border:none; margin:0;">
          <table class="table" style="margin:0;">
            <thead>
              <tr style="background:var(--surface-subtle);">
                <th style="width:70%; font-weight:700;">Statements</th>
                <th style="width:15%; text-align:center; font-weight:700;">Yes</th>
                <th style="width:15%; text-align:center; font-weight:700;">No</th>
              </tr>
            </thead>
            <tbody>
              ${statements.map(st => `
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:0.85rem 1rem; line-height:1.45;">${escapeHtml(st.statement || st.text || st)}</td>
                  <td style="text-align:center; vertical-align:middle;"><input type="radio" disabled style="width:1.25rem; height:1.25rem;"></td>
                  <td style="text-align:center; vertical-align:middle;"><input type="radio" disabled style="width:1.25rem; height:1.25rem;"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return `<div class="form-hint">Interactive preview configured for ${type}</div>`;
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
