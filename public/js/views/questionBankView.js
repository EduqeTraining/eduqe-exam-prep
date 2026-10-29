// Dedicated Question Bank View (Section 9, 11) - with Multi-Select and Bulk Delete

import { api } from '../api.js';
import { renderQuestionEditor } from './questionEditorView.js';

export function renderQuestionBank(container) {
  let selectedQuestionIds = new Set();
  container.classList.add('qb-expanded-view');

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
      <div>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <h1 style="font-size:1.85rem; font-weight:800; margin:0;">Question Bank</h1>
          <span class="badge badge-primary" id="qb-total-count-badge" style="font-size:0.85rem; padding:0.35rem 0.75rem;">Loading questions...</span>
        </div>
        <p class="form-hint" style="margin-top:0.35rem; font-size:0.875rem;">Central repository for all exam preparation questions, multi-select bulk operations, and versioned answer keys.</p>
      </div>
      <div style="display:flex; gap:0.65rem; flex-wrap:wrap;">
        <button type="button" class="btn btn-primary" id="btn-create-question" style="font-weight:700; display:flex; align-items:center; gap:0.4rem;">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Create Question
        </button>
        <button type="button" class="btn btn-secondary" id="btn-import-questions">Import Questions</button>
        <button type="button" class="btn btn-secondary" id="btn-view-pools">Question Pools</button>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="card" style="padding:1.15rem 1.25rem; margin-bottom:1.35rem; border-radius:var(--radius-md);">
      <div style="display:grid; grid-template-columns: minmax(260px, 2.5fr) minmax(140px, 1.2fr) minmax(140px, 1.2fr) minmax(120px, 1fr) minmax(120px, 1fr); gap:0.85rem;">
        <input type="text" id="filter-search" class="form-control" placeholder="Search questions, scenarios, topics...">
        <select id="filter-course" class="form-control">
          <option value="">All Courses</option>
        </select>
        <select id="filter-type" class="form-control">
          <option value="">All Question Types</option>
          <option value="yes_no">Yes / No</option>
          <option value="true_false">True / False</option>
          <option value="single_choice">Single Choice</option>
          <option value="multiple_response">Multiple Response</option>
          <option value="matching">Matching (Drag &amp; Drop)</option>
          <option value="ordering">Ordering</option>
          <option value="categorisation">Categorisation</option>
          <option value="dropdown">Dropdown</option>
          <option value="fill_blank">Fill in Blank</option>
          <option value="scenario">Scenario</option>
          <option value="hot_area">Hot Area</option>
          <option value="hotspot">Hotspot</option>
        </select>
        <select id="filter-difficulty" class="form-control">
          <option value="">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select id="filter-status" class="form-control">
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="ready_for_review">Ready for Review</option>
          <option value="approved">Approved</option>
          <option value="archived">Archived</option>
        </select>
      </div>
    </div>

    <!-- Multi-Select Bulk Actions Bar (Shown when 1 or more questions selected) -->
    <div id="qb-bulk-bar" style="display:none; align-items:center; justify-content:space-between; padding:0.85rem 1.25rem; background:rgba(239,68,68,0.06); border:1.5px solid rgba(239,68,68,0.3); border-radius:var(--radius-md); margin-bottom:1.25rem; box-shadow:var(--shadow-sm); flex-wrap:wrap; gap:1rem;">
      <div style="display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span style="font-size:1.25rem;">&#x1F5D1;&#xFE0F;</span>
          <strong style="color:var(--text-main); font-size:0.95rem;">
            <span id="qb-selected-count">0</span> question(s) selected
          </strong>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-qb-deselect-all">Deselect All</button>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button type="button" class="btn btn-danger" id="btn-qb-bulk-delete" style="font-weight:700; display:flex; align-items:center; gap:0.4rem;">
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Delete Selected (<span id="qb-delete-count-num">0</span>)
        </button>
      </div>
    </div>

    <!-- Questions Table Card -->
    <div class="qb-table-card" id="qb-table-wrapper">
      <div class="qb-table-container">
        <table class="table qb-table">
          <thead>
            <tr>
              <th class="qb-col-check">
                <input type="checkbox" id="qb-select-all" title="Select All Visible Questions" style="width:1.2rem; height:1.2rem; cursor:pointer; accent-color:var(--brand-lime, #62b017);">
              </th>
              <th class="qb-col-question">Question &amp; Context</th>
              <th class="qb-col-type">Type</th>
              <th class="qb-col-course">Course / Topic</th>
              <th class="qb-col-difficulty">Difficulty</th>
              <th class="qb-col-status">Status</th>
              <th class="qb-col-version">Version</th>
              <th class="qb-col-used">Used In</th>
              <th class="qb-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody id="questions-tbody">
            <tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted); font-size:0.95rem;">Loading Question Bank...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Quick Preview Modal -->
    <dialog id="bank-preview-modal">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;">Question Details & Student Preview</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-bank-preview">&times;</button>
      </div>
      <div class="modal-body" id="bank-preview-body"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-dismiss-bank-preview">Close</button>
      </div>
    </dialog>

    <!-- Import Modal -->
    <dialog id="bank-import-modal">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;">Import Questions Template</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-bank-import">&times;</button>
      </div>
      <div class="modal-body">
        <p class="form-hint" style="margin-bottom:1rem;">
          Paste JSON formatted questions array or CSV data. All imported questions will begin in <strong>Draft</strong> status.
        </p>
        <div class="form-group">
          <label class="form-label" for="import-course-id">Target Course</label>
          <select id="import-course-id" class="form-control"></select>
        </div>
        <div class="form-group">
          <label class="form-label" for="import-json-data">Questions Data (JSON)</label>
          <textarea id="import-json-data" class="form-control" style="font-family:var(--font-mono); min-height:140px;" placeholder='[ { "question_type": "single_choice", "question": "...", "options": [...], "correct": "..." } ]'></textarea>
        </div>
        <div id="import-status"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-dismiss-bank-import">Cancel</button>
        <button type="button" class="btn btn-primary" id="btn-submit-import">Import Valid Questions</button>
      </div>
    </dialog>
  `;

  // Load courses for filter
  api.get('/courses').then(courses => {
    const courseFilter = container.querySelector('#filter-course');
    const importCourse = container.querySelector('#import-course-id');
    const options = courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`).join('');
    courseFilter.innerHTML += options;
    importCourse.innerHTML = '<option value="">-- Global / No Course --</option>' + options;
  });

  const tbody = container.querySelector('#questions-tbody');

  function updateBulkBar() {
    const count = selectedQuestionIds.size;
    const bulkBar = container.querySelector('#qb-bulk-bar');
    const countEl = container.querySelector('#qb-selected-count');
    const deleteNumEl = container.querySelector('#qb-delete-count-num');
    const selectAllCb = container.querySelector('#qb-select-all');

    if (bulkBar) {
      bulkBar.style.display = count > 0 ? 'flex' : 'none';
    }
    if (countEl) countEl.textContent = count;
    if (deleteNumEl) deleteNumEl.textContent = count;

    const allRowCbs = container.querySelectorAll('.qb-row-cb');
    if (selectAllCb && allRowCbs.length > 0) {
      const allChecked = Array.from(allRowCbs).every(cb => cb.checked);
      const someChecked = Array.from(allRowCbs).some(cb => cb.checked);
      selectAllCb.checked = allChecked;
      selectAllCb.indeterminate = someChecked && !allChecked;
    } else if (selectAllCb) {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = false;
    }
  }

  async function loadQuestions() {
    const search = container.querySelector('#filter-search').value.trim();
    const course = container.querySelector('#filter-course').value;
    const type = container.querySelector('#filter-type').value;
    const diff = container.querySelector('#filter-difficulty').value;
    const status = container.querySelector('#filter-status').value;

    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (course) params.set('course_id', course);
    if (type) params.set('question_type', type);
    if (diff) params.set('difficulty', diff);
    if (status) params.set('status', status);

    const questions = await api.get(`/questions?${params.toString()}`);

    const countBadge = container.querySelector('#qb-total-count-badge');
    if (countBadge) {
      countBadge.textContent = `${questions.length} Question${questions.length === 1 ? '' : 's'}`;
    }

    if (questions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted); font-size:0.95rem;">No questions found matching your filter criteria.</td></tr>`;
      updateBulkBar();
      return;
    }

    tbody.innerHTML = questions.map(q => {
      const typeLabel = q.question_type.replace(/_/g, ' ').toUpperCase();
      const statusBadge = q.status === 'published' ? 'badge-success' : (q.status === 'draft' ? 'badge-neutral' : 'badge-warning');
      const diffBadge = q.difficulty === 'hard' ? 'badge-danger' : (q.difficulty === 'medium' ? 'badge-warning' : 'badge-neutral');
      const isSelected = selectedQuestionIds.has(q.id);
      let tags = [];
      try {
        tags = Array.isArray(q.tags) ? q.tags : (typeof q.tags === 'string' ? JSON.parse(q.tags || '[]') : []);
      } catch (_) { tags = []; }

      return `
        <tr data-qid="${q.id}" style="${isSelected ? 'background:rgba(239,68,68,0.06);' : ''}">
          <td class="qb-col-check">
            <input type="checkbox" class="qb-row-cb" value="${q.id}" ${isSelected ? 'checked' : ''} style="width:1.2rem; height:1.2rem; cursor:pointer; accent-color:var(--brand-lime, #62b017);">
          </td>
          <td class="qb-col-question">
            <div style="font-weight:700; font-size:0.95rem; color:var(--text-main); line-height:1.45; margin-bottom:0.25rem;">
              ${escapeHtml(q.question_text)}
            </div>
            ${q.question_description ? `
              <div class="qb-scenario-preview" title="${escapeHtml(q.question_description)}">
                <span style="font-weight:700; color:var(--text-main);">Context:</span> ${escapeHtml(q.question_description)}
              </div>
            ` : ''}
            ${tags.length ? `
              <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-top:0.4rem;">
                ${tags.slice(0, 5).map(t => `<span class="badge badge-secondary" style="font-size:0.68rem; padding:0.15rem 0.45rem;">#${escapeHtml(t)}</span>`).join('')}
                ${tags.length > 5 ? `<span class="badge badge-neutral" style="font-size:0.68rem; padding:0.15rem 0.45rem;">+${tags.length - 5}</span>` : ''}
              </div>
            ` : ''}
          </td>
          <td class="qb-col-type">
            <span class="badge badge-primary" style="font-size:0.75rem; font-weight:700; letter-spacing:0.4px;">${typeLabel}</span>
          </td>
          <td class="qb-col-course">
            <div style="font-weight:700; font-size:0.875rem; color:var(--text-main);">${escapeHtml(q.course_code || 'Global')}</div>
            <div style="font-size:0.785rem; color:var(--text-muted); margin-top:0.2rem;">${escapeHtml(q.topic || 'General')}</div>
          </td>
          <td class="qb-col-difficulty">
            <span class="badge ${diffBadge}" style="font-size:0.75rem; font-weight:700;">${q.difficulty.toUpperCase()}</span>
          </td>
          <td class="qb-col-status">
            <span class="badge ${statusBadge}" style="font-size:0.75rem; font-weight:700;">${q.status.toUpperCase()}</span>
          </td>
          <td class="qb-col-version">
            <span class="badge badge-neutral" style="font-size:0.75rem; font-weight:700;">v${q.version || 1}</span>
          </td>
          <td class="qb-col-used">
            <span class="badge badge-neutral" style="font-size:0.75rem;">${q.usage_count || 0} exam(s)</span>
          </td>
          <td class="qb-col-actions">
            <div style="display:flex; gap:0.4rem; justify-content:flex-end; align-items:center;">
              <button type="button" class="btn btn-secondary btn-sm btn-preview" data-id="${q.id}" title="Preview Question" style="padding:0.4rem 0.55rem; display:inline-flex; align-items:center; justify-content:center;">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              </button>
              <button type="button" class="btn btn-secondary btn-sm btn-edit" data-id="${q.id}" title="Edit / Version" style="padding:0.4rem 0.55rem; display:inline-flex; align-items:center; justify-content:center;">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button type="button" class="btn btn-secondary btn-sm btn-dup" data-id="${q.id}" title="Duplicate Question" style="padding:0.4rem 0.55rem; display:inline-flex; align-items:center; justify-content:center;">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              </button>
              <button type="button" class="btn btn-danger btn-sm btn-delete-one" data-id="${q.id}" title="Delete Question" style="padding:0.4rem 0.55rem; display:inline-flex; align-items:center; justify-content:center;">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row events
    tbody.querySelectorAll('.btn-preview').forEach(btn => {
      btn.onclick = () => showBankPreview(btn.dataset.id);
    });
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => renderQuestionEditor(container, { questionId: btn.dataset.id, onSaved: () => renderQuestionBank(container) });
    });
    tbody.querySelectorAll('.btn-dup').forEach(btn => {
      btn.onclick = async () => {
        if (confirm('Duplicate this question? A new Draft copy will be created.')) {
          await api.post(`/questions/${btn.dataset.id}/duplicate`);
          loadQuestions();
        }
      };
    });

    // Single Question Delete
    tbody.querySelectorAll('.btn-delete-one').forEach(btn => {
      btn.onclick = async () => {
        if (confirm('Permanently delete this question? This action cannot be undone.')) {
          try {
            await api.delete(`/questions/${btn.dataset.id}`);
            selectedQuestionIds.delete(btn.dataset.id);
            loadQuestions();
          } catch (err) {
            alert('Failed to delete question: ' + err.message);
          }
        }
      };
    });

    // Row Checkboxes
    tbody.querySelectorAll('.qb-row-cb').forEach(cb => {
      cb.onchange = () => {
        const row = cb.closest('tr');
        if (cb.checked) {
          selectedQuestionIds.add(cb.value);
          if (row) row.style.background = 'rgba(239,68,68,0.05)';
        } else {
          selectedQuestionIds.delete(cb.value);
          if (row) row.style.background = '';
        }
        updateBulkBar();
      };
    });

    updateBulkBar();
  }

  // Select All Checkbox in Table Header
  const selectAllCb = container.querySelector('#qb-select-all');
  if (selectAllCb) {
    selectAllCb.onclick = () => {
      const isChecked = selectAllCb.checked;
      container.querySelectorAll('.qb-row-cb').forEach(cb => {
        cb.checked = isChecked;
        const row = cb.closest('tr');
        if (isChecked) {
          selectedQuestionIds.add(cb.value);
          if (row) row.style.background = 'rgba(239,68,68,0.05)';
        } else {
          selectedQuestionIds.delete(cb.value);
          if (row) row.style.background = '';
        }
      });
      updateBulkBar();
    };
  }

  // Deselect All Button
  const deselectBtn = container.querySelector('#btn-qb-deselect-all');
  if (deselectBtn) {
    deselectBtn.onclick = () => {
      selectedQuestionIds.clear();
      container.querySelectorAll('.qb-row-cb').forEach(cb => {
        cb.checked = false;
        const row = cb.closest('tr');
        if (row) row.style.background = '';
      });
      updateBulkBar();
    };
  }

  // Bulk Delete Button
  const bulkDeleteBtn = container.querySelector('#btn-qb-bulk-delete');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.onclick = async () => {
      const count = selectedQuestionIds.size;
      if (count === 0) return;

      if (confirm(`Are you sure you want to PERMANENTLY DELETE ${count} selected question(s)?\n\nThis will remove the questions and all associated question versions and references. This cannot be undone.`)) {
        bulkDeleteBtn.disabled = true;
        bulkDeleteBtn.innerHTML = 'Deleting questions...';

        try {
          const res = await api.post('/questions/bulk-delete', {
            question_ids: Array.from(selectedQuestionIds)
          });
          alert(`Successfully deleted ${res.count || count} question(s).`);
          selectedQuestionIds.clear();
          loadQuestions();
        } catch (err) {
          alert('Failed to delete selected questions: ' + err.message);
        } finally {
          bulkDeleteBtn.disabled = false;
          updateBulkBar();
        }
      }
    };
  }

  // Filter change listeners
  container.querySelectorAll('#filter-search, #filter-course, #filter-type, #filter-difficulty, #filter-status').forEach(el => {
    el.oninput = loadQuestions;
    el.onchange = loadQuestions;
  });

  // Action Buttons
  container.querySelector('#btn-create-question').onclick = () => {
    renderQuestionEditor(container, { onSaved: () => renderQuestionBank(container) });
  };

  container.querySelector('#btn-view-pools').onclick = () => {
    window.location.hash = '#pools';
  };

  // Preview Dialog
  const previewModal = container.querySelector('#bank-preview-modal');
  async function showBankPreview(qId) {
    const q = await api.get(`/questions/${qId}`);
    const body = container.querySelector('#bank-preview-body');

    body.innerHTML = `
      <div style="margin-bottom:1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
        <span class="badge badge-primary">${q.question_type.toUpperCase()}</span>
        <span class="badge badge-neutral">${q.points} pt(s)</span>
        <span class="badge badge-warning">${q.difficulty.toUpperCase()}</span>
        <span class="badge badge-neutral">Version ${q.version || 1}</span>
      </div>

      ${q.question_description ? `
        <div class="question-description-box">
          <h4>Question Scenario & Context</h4>
          <div style="white-space:pre-wrap;">${escapeHtml(q.question_description)}</div>
        </div>
      ` : ''}

      <div style="font-weight:700; font-size:1.1rem; margin-bottom:1rem;">
        ${escapeHtml(q.question_text)}
      </div>

      <div style="margin-bottom:1.25rem;">
        <h5 style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.5rem;">Answer Options Configuration:</h5>
        <pre style="background:var(--surface-subtle); padding:0.75rem; border-radius:var(--radius-md); font-size:0.8125rem; overflow-x:auto;">${escapeHtml(JSON.stringify(q.answer_options, null, 2))}</pre>
      </div>

      <div style="margin-bottom:1.25rem;">
        <h5 style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.5rem;">Correct Answer Key:</h5>
        <pre style="background:var(--success-bg); color:var(--success); padding:0.75rem; border-radius:var(--radius-md); font-size:0.8125rem; font-weight:700;">${escapeHtml(JSON.stringify(q.correct_answer, null, 2))}</pre>
      </div>

      ${q.answer_explanation ? `
        <div style="margin-bottom:1.25rem;">
          <h5 style="font-size:0.875rem; color:var(--text-muted); margin-bottom:0.5rem;">Answer Explanation:</h5>
          <div style="background:var(--surface-subtle); padding:0.75rem; border-radius:var(--radius-md); font-size:0.875rem;">${escapeHtml(q.answer_explanation)}</div>
        </div>
      ` : ''}
    `;

    previewModal.showModal();
  }

  container.querySelector('#btn-close-bank-preview').onclick = () => previewModal.close();
  container.querySelector('#btn-dismiss-bank-preview').onclick = () => previewModal.close();

  // Import Dialog
  const importModal = container.querySelector('#bank-import-modal');
  container.querySelector('#btn-import-questions').onclick = () => {
    importModal.showModal();
  };
  container.querySelector('#btn-close-bank-import').onclick = () => importModal.close();
  container.querySelector('#btn-dismiss-bank-import').onclick = () => importModal.close();

  container.querySelector('#btn-submit-import').onclick = async () => {
    const raw = container.querySelector('#import-json-data').value.trim();
    const courseId = container.querySelector('#import-course-id').value || null;
    const statusDiv = container.querySelector('#import-status');

    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      statusDiv.innerHTML = '<span style="color:var(--text-muted)">Importing questions...</span>';
      const res = await api.post('/questions/import', {
        course_id: courseId,
        questions: items
      });

      statusDiv.innerHTML = `<span style="color:var(--success); font-weight:600;">Successfully imported ${res.imported.length} question(s) as Draft!</span>`;
      setTimeout(() => {
        importModal.close();
        loadQuestions();
      }, 1000);
    } catch (err) {
      statusDiv.innerHTML = `<span style="color:var(--danger); font-weight:600;">Error: ${err.message}</span>`;
    }
  };

  loadQuestions();
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
