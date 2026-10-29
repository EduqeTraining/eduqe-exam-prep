// Question Pools View (Section 16)

import { api } from '../api.js';

export function renderPoolsView(container) {
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <div>
        <h1 style="font-size:1.75rem; font-weight:800;">Question Pools</h1>
        <p class="form-hint">Create reusable pools of questions for randomised assessment delivery.</p>
      </div>
      <div>
        <button type="button" class="btn btn-primary" id="btn-create-pool">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Create Question Pool
        </button>
      </div>
    </div>

    <!-- Pools Grid -->
    <div id="pools-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem;">
      <div style="text-align:center; padding:2rem;">Loading question pools...</div>
    </div>

    <!-- Create Pool Modal -->
    <dialog id="modal-create-pool">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;">Create Question Pool</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-pool-modal">&times;</button>
      </div>
      <form id="pool-form">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="pool-name">Pool Name <span style="color:var(--danger)">*</span></label>
            <input type="text" id="pool-name" class="form-control" placeholder="e.g. Azure Storage Practice Pool" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="pool-course">Associated Course</label>
            <select id="pool-course" class="form-control"></select>
          </div>
          <div class="form-group">
            <label class="form-label" for="pool-count">Random Questions Picked (Default)</label>
            <input type="number" id="pool-count" class="form-control" value="5" min="1" max="50">
          </div>
          <div class="form-group">
            <label class="form-label" for="pool-desc">Description</label>
            <textarea id="pool-desc" class="form-control" placeholder="Pool description..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="btn-cancel-pool-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Pool</button>
        </div>
      </form>
    </dialog>

    <!-- Delete Pool Confirmation Modal -->
    <dialog id="modal-confirm-delete-pool" style="max-width:460px; width:95%;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700; color:var(--danger);">Delete Question Pool</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-delete-pool">&times;</button>
      </div>
      <div class="modal-body" id="delete-pool-modal-body"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-cancel-delete-pool">Cancel</button>
        <button type="button" class="btn btn-danger" id="btn-confirm-delete-pool" style="font-weight:700;">Delete Pool</button>
      </div>
    </dialog>
  `;

  const grid = container.querySelector('#pools-grid');
  const poolModal = container.querySelector('#modal-create-pool');
  const deletePoolModal = container.querySelector('#modal-confirm-delete-pool');
  const courseSelect = container.querySelector('#pool-course');

  api.get('/courses').then(courses => {
    courseSelect.innerHTML = '<option value="">-- No Specific Course (Global) --</option>' +
      courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`).join('');
  });

  async function loadPools() {
    const pools = await api.get('/pools');
    if (pools.length === 0) {
      grid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align:center; padding:3rem;">
          <p style="color:var(--text-muted); font-weight:600; margin-bottom:1rem;">No Question Pools created yet.</p>
          <button type="button" class="btn btn-primary" id="btn-empty-create-pool">+ Create Question Pool</button>
        </div>
      `;
      grid.querySelector('#btn-empty-create-pool')?.addEventListener('click', () => poolModal.showModal());
      return;
    }

    grid.innerHTML = pools.map(p => `
      <div class="card" style="margin:0; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
            <h3 style="font-size:1.1rem; font-weight:700;">${escapeHtml(p.name)}</h3>
            <span class="badge badge-primary">${p.question_count || 0} questions</span>
          </div>
          <p class="form-hint" style="margin-bottom:1rem;">${escapeHtml(p.description || 'No description provided.')}</p>
          <div style="font-size:0.8125rem; color:var(--text-muted); margin-bottom:0.5rem;">
            <strong>Course:</strong> ${escapeHtml(p.course_name || 'Global')}
          </div>
          <div style="font-size:0.8125rem; color:var(--text-muted);">
            <strong>Selection Rule:</strong> Randomly selects ${p.random_count || 5} questions
          </div>
        </div>
        <div style="margin-top:1.25rem; padding-top:0.85rem; border-top:1px solid var(--border); display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-danger btn-sm btn-delete-pool" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Delete Question Pool">
            Delete Pool
          </button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-delete-pool').forEach(btn => {
      btn.onclick = () => openDeletePoolModal(btn.dataset.id, btn.dataset.name);
    });
  }

  function openDeletePoolModal(poolId, poolName) {
    container.querySelector('#delete-pool-modal-body').innerHTML = `
      <p style="font-size:0.95rem; color:var(--text-main); margin-bottom:0.75rem;">
        Are you sure you want to permanently delete the question pool <strong>${escapeHtml(poolName)}</strong>?
      </p>
      <div class="card" style="background:rgba(220,38,38,0.06); border:1px solid rgba(220,38,38,0.3); padding:0.85rem; font-size:0.85rem; color:var(--danger);">
        <strong>Note:</strong> Deleting this pool removes the pool and unlinks it from any assessments, while keeping the individual questions in your Question Bank intact.
      </div>
    `;
    deletePoolModal.showModal();

    container.querySelector('#btn-close-delete-pool').onclick = () => deletePoolModal.close();
    container.querySelector('#btn-cancel-delete-pool').onclick = () => deletePoolModal.close();

    const confirmBtn = container.querySelector('#btn-confirm-delete-pool');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete Pool';
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting...';
      try {
        await api.delete(`/pools/${poolId}`);
        deletePoolModal.close();
        loadPools();
      } catch (err) {
        alert('Failed to delete question pool: ' + err.message);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete Pool';
      }
    };
  }

  container.querySelector('#btn-create-pool').onclick = () => poolModal.showModal();
  container.querySelector('#btn-close-pool-modal').onclick = () => poolModal.close();
  container.querySelector('#btn-cancel-pool-modal').onclick = () => poolModal.close();

  container.querySelector('#pool-form').onsubmit = async (e) => {
    e.preventDefault();
    await api.post('/pools', {
      name: container.querySelector('#pool-name').value.trim(),
      course_id: container.querySelector('#pool-course').value || null,
      random_count: parseInt(container.querySelector('#pool-count').value, 10),
      description: container.querySelector('#pool-desc').value.trim()
    });
    poolModal.close();
    loadPools();
  };

  loadPools();
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
