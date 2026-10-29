// Instructors Management View (Administrator Portal)

import { api } from '../api.js';

export function renderInstructorsView(container, router) {
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
      <div>
        <h1 style="font-size:1.75rem; font-weight:800;">Instructor Management</h1>
        <p class="form-hint">Create instructor accounts, manage credentials, and view class allocations.</p>
      </div>
      <div>
        <button type="button" class="btn btn-primary" id="btn-open-create-instructor">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Add New Instructor
        </button>
      </div>
    </div>

    <!-- Instructor Metric Stats -->
    <div class="stats-grid" id="instructors-stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total Instructors</span>
        <span class="stat-value" id="stat-total-instructors">-</span>
        <span class="stat-subtext">Teaching staff</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Active Instructors</span>
        <span class="stat-value" id="stat-active-instructors" style="color:var(--brand-lime);">-</span>
        <span class="stat-subtext">Currently assigned</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Classes Allocated</span>
        <span class="stat-value" id="stat-allocated-classes">-</span>
        <span class="stat-subtext">Cohorts with instructor</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Students Guided</span>
        <span class="stat-value" id="stat-total-students-guided">-</span>
        <span class="stat-subtext">Active enrolled learners</span>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="card" style="padding:1rem; margin-bottom:1.25rem;">
      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:0.75rem;">
        <input 
          type="text" 
          id="instructor-search-input" 
          class="form-control" 
          placeholder="Search by instructor name, username, or email..."
        />
        <select id="instructor-status-filter" class="form-control">
          <option value="">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="suspended">Suspended Only</option>
        </select>
      </div>
    </div>

    <!-- Instructors Table -->
    <div class="card" style="padding:0; overflow:hidden;">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th style="width:28%;">Instructor</th>
              <th>Username</th>
              <th>Email</th>
              <th>Assigned Classes</th>
              <th>Students Guided</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="instructors-tbody">
            <tr><td colspan="7" style="text-align:center; padding:2rem;">Loading instructors...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create / Edit Instructor Modal -->
    <dialog id="modal-instructor-form" style="max-width:560px;">
      <div class="modal-header">
        <h3 style="font-size:1.15rem; font-weight:700;" id="instructor-modal-title">Create New Instructor</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-instructor-modal">&times;</button>
      </div>
      <form id="instructor-form">
        <div class="modal-body">
          <input type="hidden" id="inst-id">
          
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="inst-first-name">First Name <span style="color:var(--danger)">*</span></label>
              <input type="text" id="inst-first-name" class="form-control" placeholder="e.g. Evelyn" required>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="inst-surname">Surname <span style="color:var(--danger)">*</span></label>
              <input type="text" id="inst-surname" class="form-control" placeholder="e.g. Reed" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="inst-email">Email Address <span style="color:var(--danger)">*</span></label>
            <input type="email" id="inst-email" class="form-control" placeholder="e.g. evelyn.reed@eduqe.example.com" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="inst-username">Username <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(Optional - leave blank to auto-generate)</span></label>
            <input type="text" id="inst-username" class="form-control" placeholder="e.g. evelyn.reed">
          </div>

          <div class="form-group" id="group-inst-password">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <label class="form-label" for="inst-password" style="margin-bottom:0;">Password <span id="label-pwd-required" style="color:var(--danger)">*</span></label>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-gen-inst-pwd" style="padding:0.15rem 0.5rem; font-size:0.75rem;">Generate Strong Password</button>
            </div>
            <input type="text" id="inst-password" class="form-control" placeholder="Enter secure password (min 6 chars)">
            <small class="form-hint" id="inst-pwd-hint">The instructor will use these credentials to sign in to the instructor portal.</small>
          </div>

          <div class="form-group" id="group-inst-status" style="display:none;">
            <label class="form-label" for="inst-status">Account Status</label>
            <select id="inst-status" class="form-control">
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div id="inst-form-error" style="color:var(--danger); font-size:0.875rem; display:none; margin-top:0.75rem;"></div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
          <button type="button" class="btn btn-danger btn-sm" id="btn-modal-delete-inst" style="display:none; align-items:center; gap:0.25rem;">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Delete Instructor
          </button>
          <div style="display:flex; gap:0.5rem; margin-left:auto;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-instructor-form">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-instructor">Save Instructor</button>
          </div>
        </div>
      </form>
    </dialog>

    <!-- Success Credentials Display Modal -->
    <dialog id="modal-inst-credentials" style="max-width:500px;">
      <div class="modal-header">
        <h3 style="font-size:1.15rem; font-weight:700;">Instructor Account Ready</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-credentials-modal">&times;</button>
      </div>
      <div class="modal-body" id="inst-credentials-body"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" id="btn-done-credentials">Done</button>
      </div>
    </dialog>
  `;

  // Elements
  const tbody = container.querySelector('#instructors-tbody');
  const searchInput = container.querySelector('#instructor-search-input');
  const statusFilter = container.querySelector('#instructor-status-filter');
  const modal = container.querySelector('#modal-instructor-form');
  const form = container.querySelector('#instructor-form');
  const credModal = container.querySelector('#modal-inst-credentials');

  let instructorsList = [];

  async function loadInstructors() {
    try {
      const q = searchInput.value.trim();
      const status = statusFilter.value;
      const params = {};
      if (q) params.q = q;
      if (status) params.status = status;

      instructorsList = await api.getInstructors(params);

      // Update metrics
      const total = instructorsList.length;
      const active = instructorsList.filter(i => i.account_status === 'active').length;
      const classesAllocated = instructorsList.reduce((sum, i) => sum + (Number(i.assigned_class_count) || 0), 0);
      const studentsGuided = instructorsList.reduce((sum, i) => sum + (Number(i.total_student_count) || 0), 0);

      container.querySelector('#stat-total-instructors').textContent = total;
      container.querySelector('#stat-active-instructors').textContent = active;
      container.querySelector('#stat-allocated-classes').textContent = classesAllocated;
      container.querySelector('#stat-total-students-guided').textContent = studentsGuided;

      renderTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger); text-align:center; padding:2rem;">Failed to load instructors: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderTable() {
    if (instructorsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No instructors found. Click "Add New Instructor" to create an instructor account.</td></tr>`;
      return;
    }

    tbody.innerHTML = instructorsList.map(inst => `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div style="width:36px; height:36px; border-radius:50%; background:var(--brand-lime); color:#202020; display:flex; align-items:center; justify-content:center; font-weight:800; font-family:var(--font-heading); font-size:0.85rem; box-shadow:0 0 10px rgba(181,244,74,0.25);">
              ${escapeHtml((inst.first_name?.[0] || 'I').toUpperCase())}
            </div>
            <div>
              <div style="font-weight:700; color:var(--text-main); font-family:var(--font-heading);">
                ${escapeHtml(inst.first_name)} ${escapeHtml(inst.surname)}
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted);">ID: ${escapeHtml(inst.id.slice(0, 8))}...</div>
            </div>
          </div>
        </td>
        <td><code>${escapeHtml(inst.username)}</code></td>
        <td style="font-size:0.85rem;">${escapeHtml(inst.email)}</td>
        <td>
          <span class="badge ${inst.assigned_class_count > 0 ? 'badge-primary' : 'badge-neutral'}">
            ${inst.assigned_class_count} class(es)
          </span>
        </td>
        <td>
          <span class="badge badge-neutral">${inst.total_student_count || 0} student(s)</span>
        </td>
        <td>
          <span class="badge ${inst.account_status === 'active' ? 'badge-success' : 'badge-danger'}">
            ${escapeHtml(inst.account_status.toUpperCase())}
          </span>
        </td>
        <td style="text-align:right;">
          <div style="display:flex; gap:0.35rem; justify-content:flex-end; align-items:center;">
            <button type="button" class="btn btn-secondary btn-sm btn-edit-inst" data-id="${inst.id}">Edit</button>
            <button type="button" class="btn btn-secondary btn-sm btn-track-inst" data-id="${inst.id}" title="View Live Class Progress">Track Progress &rarr;</button>
            <button type="button" class="btn btn-danger btn-sm btn-delete-inst" data-id="${inst.id}" data-name="${escapeHtml(inst.first_name)} ${escapeHtml(inst.surname)}" title="Delete Instructor" style="display:inline-flex; align-items:center; gap:0.25rem;">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              Delete
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach actions
    tbody.querySelectorAll('.btn-edit-inst').forEach(btn => {
      btn.onclick = () => openEditInstructor(btn.dataset.id);
    });

    tbody.querySelectorAll('.btn-track-inst').forEach(btn => {
      btn.onclick = () => {
        router.navigate(`instructor?instructor_id=${btn.dataset.id}`);
      };
    });

    tbody.querySelectorAll('.btn-delete-inst').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        if (confirm(`Are you sure you want to permanently delete instructor "${name}"? This action cannot be undone and will unassign them from any allocated classes.`)) {
          try {
            await api.deleteInstructor(id);
            await loadInstructors();
          } catch (err) {
            alert('Failed to delete instructor: ' + err.message);
          }
        }
      };
    });
  }

  searchInput.oninput = () => {
    clearTimeout(searchInput._t);
    searchInput._t = setTimeout(loadInstructors, 250);
  };
  statusFilter.onchange = loadInstructors;

  // Open Create Modal
  container.querySelector('#btn-open-create-instructor').onclick = () => {
    container.querySelector('#instructor-modal-title').textContent = 'Create New Instructor';
    container.querySelector('#inst-id').value = '';
    container.querySelector('#inst-first-name').value = '';
    container.querySelector('#inst-surname').value = '';
    container.querySelector('#inst-email').value = '';
    container.querySelector('#inst-username').value = '';
    container.querySelector('#inst-password').value = '';
    container.querySelector('#inst-password').required = true;
    container.querySelector('#label-pwd-required').style.display = 'inline';
    container.querySelector('#inst-pwd-hint').textContent = 'The instructor will use these credentials to sign in to the instructor portal.';
    container.querySelector('#group-inst-status').style.display = 'none';
    container.querySelector('#inst-form-error').style.display = 'none';
    const delModalBtn = container.querySelector('#btn-modal-delete-inst');
    if (delModalBtn) delModalBtn.style.display = 'none';
    modal.showModal();
  };

  // Generate Password Helper
  container.querySelector('#btn-gen-inst-pwd').onclick = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = 'Eduqe!';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    container.querySelector('#inst-password').value = pwd;
  };

  // Edit Instructor Modal
  async function openEditInstructor(id) {
    const inst = instructorsList.find(i => i.id === id);
    if (!inst) return;

    container.querySelector('#instructor-modal-title').textContent = 'Edit Instructor';
    container.querySelector('#inst-id').value = inst.id;
    container.querySelector('#inst-first-name').value = inst.first_name;
    container.querySelector('#inst-surname').value = inst.surname;
    container.querySelector('#inst-email').value = inst.email;
    container.querySelector('#inst-username').value = inst.username;
    container.querySelector('#inst-password').value = '';
    container.querySelector('#inst-password').required = false;
    container.querySelector('#label-pwd-required').style.display = 'none';
    container.querySelector('#inst-pwd-hint').textContent = 'Leave empty to keep existing password, or enter new password to reset.';
    container.querySelector('#group-inst-status').style.display = 'block';
    container.querySelector('#inst-status').value = inst.account_status;
    container.querySelector('#inst-form-error').style.display = 'none';

    const delModalBtn = container.querySelector('#btn-modal-delete-inst');
    if (delModalBtn) {
      delModalBtn.style.display = 'inline-flex';
      delModalBtn.onclick = async () => {
        if (confirm(`Are you sure you want to permanently delete instructor "${inst.first_name} ${inst.surname}"? This action cannot be undone and will unassign them from any allocated classes.`)) {
          try {
            await api.deleteInstructor(inst.id);
            modal.close();
            await loadInstructors();
          } catch (err) {
            alert('Failed to delete instructor: ' + err.message);
          }
        }
      };
    }

    modal.showModal();
  }

  // Modal Closers
  container.querySelector('#btn-close-instructor-modal').onclick = () => modal.close();
  container.querySelector('#btn-cancel-instructor-form').onclick = () => modal.close();
  container.querySelector('#btn-close-credentials-modal').onclick = () => credModal.close();
  container.querySelector('#btn-done-credentials').onclick = () => credModal.close();

  // Form Submit Handler
  form.onsubmit = async (e) => {
    e.preventDefault();
    const errorBox = container.querySelector('#inst-form-error');
    const submitBtn = container.querySelector('#btn-save-instructor');
    errorBox.style.display = 'none';

    const id = container.querySelector('#inst-id').value;
    const firstName = container.querySelector('#inst-first-name').value.trim();
    const surname = container.querySelector('#inst-surname').value.trim();
    const email = container.querySelector('#inst-email').value.trim();
    const username = container.querySelector('#inst-username').value.trim() || null;
    const password = container.querySelector('#inst-password').value;
    const status = container.querySelector('#inst-status').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      if (id) {
        // Update existing instructor
        const payload = { first_name: firstName, surname, email, account_status: status };
        if (password) payload.password = password;
        await api.updateInstructor(id, payload);
        modal.close();
        loadInstructors();
      } else {
        // Create new instructor
        const res = await api.createInstructor({
          first_name: firstName,
          surname,
          email,
          username,
          password
        });
        modal.close();

        // Show credentials popup
        container.querySelector('#inst-credentials-body').innerHTML = `
          <div style="background:var(--primary-light); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--brand-lime); margin-bottom:1rem;">
            <p style="margin-bottom:0.5rem; font-weight:700; color:var(--text-main);">Instructor credentials created successfully!</p>
            <div style="font-size:0.875rem; display:flex; flex-direction:column; gap:0.35rem;">
              <div><strong>Name:</strong> ${escapeHtml(res.instructor.first_name)} ${escapeHtml(res.instructor.surname)}</div>
              <div><strong>Username:</strong> <code>${escapeHtml(res.instructor.username)}</code></div>
              <div><strong>Password:</strong> <code>${escapeHtml(res.temporary_password)}</code></div>
              <div><strong>Email:</strong> ${escapeHtml(res.instructor.email)}</div>
            </div>
          </div>
          <p class="form-hint" style="font-size:0.8125rem;">
            Share these credentials with the instructor so they can sign in and monitor their classes.
          </p>
        `;
        credModal.showModal();
        loadInstructors();
      }
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Instructor';
    }
  };

  // Initial Load
  loadInstructors();

  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  if (urlParams.get('action') === 'add' || urlParams.get('action') === 'create') {
    container.querySelector('#btn-open-create-instructor').click();
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
