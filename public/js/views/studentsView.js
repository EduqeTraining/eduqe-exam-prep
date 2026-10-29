// Student Management View (Section 8)

import { api } from '../api.js';

export function renderStudentsView(container, router, { action = null } = {}) {
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <div>
        <h1 style="font-size:1.75rem; font-weight:800;">Student Management</h1>
        <p class="form-hint">Manage student accounts, temporary passwords, enrollments, and access statuses.</p>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button type="button" class="btn btn-primary" id="btn-open-add-student">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Add Student
        </button>
        <button type="button" class="btn btn-secondary" id="btn-open-import-students">Import Students</button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card" style="padding:1rem; margin-bottom:1.25rem;">
      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:0.75rem;">
        <input type="text" id="stu-filter-search" class="form-control" placeholder="Search students by name, username, email, student number...">
        <select id="stu-filter-status" class="form-control">
          <option value="">All Account Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>
    </div>

    <!-- Students Table -->
    <div class="card" style="padding:0; overflow:hidden;">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th style="width:25%;">Student Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Student #</th>
              <th>Status</th>
              <th>Enrolled Classes</th>
              <th>Attempts</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="students-tbody">
            <tr><td colspan="8" style="text-align:center; padding:2rem;">Loading student accounts...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Student Modal -->
    <dialog id="modal-student-form" style="max-width:550px;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;" id="stu-modal-title">Add Student</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-stu-modal">&times;</button>
      </div>
      <form id="student-form">
        <div class="modal-body">
          <input type="hidden" id="s-id">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="s-fname">First Name <span style="color:var(--danger)">*</span></label>
              <input type="text" id="s-fname" class="form-control" placeholder="e.g. Alex" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="s-sname">Surname <span style="color:var(--danger)">*</span></label>
              <input type="text" id="s-sname" class="form-control" placeholder="e.g. Morgan" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="s-email">Email Address <span style="color:var(--danger)">*</span></label>
            <input type="email" id="s-email" class="form-control" placeholder="alex.morgan@example.com" required>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="s-username">Username (Optional - auto-generated if blank)</label>
              <input type="text" id="s-username" class="form-control" placeholder="alex.morgan">
            </div>
            <div class="form-group">
              <label class="form-label" for="s-number">Student Number</label>
              <input type="text" id="s-number" class="form-control" placeholder="STU-10025">
            </div>
          </div>
          <div class="form-group" id="pwd-field-group">
            <label class="form-label" for="s-temp-pwd">Temporary Password (Optional - auto-generated)</label>
            <input type="text" id="s-temp-pwd" class="form-control" placeholder="Auto-generated secure temp password">
            <p class="form-hint">Student will be required to change their temporary password upon first sign-in.</p>
          </div>
          <div class="form-group">
            <label class="form-label" for="s-status">Account Status</label>
            <select id="s-status" class="form-control">
              <option value="active" selected>Active</option>
              <option value="suspended">Suspended</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
          <div id="stu-form-error" style="color:var(--danger); font-size:0.875rem;"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="btn-cancel-stu-modal">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-student">Save Student</button>
        </div>
      </form>
    </dialog>

    <!-- Temp Password Notice Modal -->
    <dialog id="modal-temp-pwd-notice">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;">Student Credentials Generated</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-pwd-notice">&times;</button>
      </div>
      <div class="modal-body" id="pwd-notice-body"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-cancel-pwd-notice">Cancel</button>
        <button type="button" class="btn btn-primary" id="btn-dismiss-pwd-notice">Done</button>
      </div>
    </dialog>

    <!-- Student Import Modal -->
    <dialog id="modal-import-students">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;">Import Students Template</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-import-stu">&times;</button>
      </div>
      <div class="modal-body">
        <p class="form-hint" style="margin-bottom:1rem;">
          Paste JSON array or CSV records with headers: <code>first_name, surname, email, student_number</code>
        </p>
        <div class="form-group">
          <textarea id="import-students-json" class="form-control" style="font-family:var(--font-mono); min-height:160px;" placeholder='[&#10;  { "first_name": "Jordan", "surname": "Smith", "email": "jordan@example.com", "student_number": "STU-991" }&#10;]'></textarea>
        </div>
        <div id="import-stu-status"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-cancel-import-stu">Cancel</button>
        <button type="button" class="btn btn-primary" id="btn-submit-import-stu">Import Students</button>
      </div>
    </dialog>
  `;

  const tbody = container.querySelector('#students-tbody');
  const stuModal = container.querySelector('#modal-student-form');
  const pwdNoticeModal = container.querySelector('#modal-temp-pwd-notice');
  const importModal = container.querySelector('#modal-import-students');

  async function loadStudents() {
    const search = container.querySelector('#stu-filter-search').value.trim();
    const status = container.querySelector('#stu-filter-status').value;

    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status) params.set('account_status', status);

    const students = await api.get(`/students?${params.toString()}`);

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">No student accounts found.</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => {
      const statusBadge = s.account_status === 'active' ? 'badge-success' : (s.account_status === 'suspended' ? 'badge-warning' : 'badge-danger');

      return `
        <tr>
          <td>
            <strong>${escapeHtml(s.first_name)} ${escapeHtml(s.surname)}</strong>
            ${s.must_change_password ? `<div style="font-size:0.75rem; color:var(--warning); font-weight:600;">Must change password</div>` : ''}
          </td>
          <td><code>${escapeHtml(s.username)}</code></td>
          <td style="font-size:0.8125rem;">${escapeHtml(s.email)}</td>
          <td style="font-size:0.8125rem;">${escapeHtml(s.student_number || '-')}</td>
          <td><span class="badge ${statusBadge}">${s.account_status.toUpperCase()}</span></td>
          <td><span class="badge badge-neutral">${s.class_count || 0} class(es)</span></td>
          <td><span class="badge badge-neutral">${s.attempt_count || 0} attempt(s)</span></td>
          <td style="text-align:right;">
            <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
              <button type="button" class="btn btn-secondary btn-sm btn-reset-pwd" data-id="${s.id}" data-user="${escapeHtml(s.username)}" title="Reset Password">Reset Pwd</button>
              <button type="button" class="btn btn-secondary btn-sm btn-edit-stu" data-id="${s.id}">Edit</button>
              <button type="button" class="btn btn-secondary btn-sm btn-toggle-suspend" data-id="${s.id}" data-status="${s.account_status}">
                ${s.account_status === 'active' ? 'Suspend' : 'Activate'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-reset-pwd').forEach(btn => {
      btn.onclick = async () => {
        if (confirm(`Reset password for student '${btn.dataset.user}'? A new temporary password will be generated.`)) {
          const res = await api.post(`/students/${btn.dataset.id}/reset-password`, {});
          container.querySelector('#pwd-notice-body').innerHTML = `
            <p>Password reset successfully for <strong>${escapeHtml(btn.dataset.user)}</strong>.</p>
            <div class="card" style="background:var(--surface-subtle); padding:1rem; text-align:center; font-size:1.25rem; font-weight:800; font-family:var(--font-mono); margin:1rem 0;">
              ${escapeHtml(res.temporary_password)}
            </div>
            <p class="form-hint">Provide this temporary password to the student. They will be required to change it at their next sign-in.</p>
          `;
          pwdNoticeModal.showModal();
          loadStudents();
        }
      };
    });

    tbody.querySelectorAll('.btn-edit-stu').forEach(btn => {
      btn.onclick = () => openEditStudent(btn.dataset.id);
    });

    tbody.querySelectorAll('.btn-toggle-suspend').forEach(btn => {
      btn.onclick = async () => {
        const cur = btn.dataset.status;
        const next = cur === 'active' ? 'suspended' : 'active';
        await api.post(`/students/${btn.dataset.id}/status`, { status: next });
        loadStudents();
      };
    });
  }

  container.querySelector('#stu-filter-search').oninput = loadStudents;
  container.querySelector('#stu-filter-status').onchange = loadStudents;

  // Add Student
  container.querySelector('#btn-open-add-student').onclick = () => {
    container.querySelector('#stu-modal-title').textContent = 'Add Student';
    container.querySelector('#s-id').value = '';
    container.querySelector('#s-fname').value = '';
    container.querySelector('#s-sname').value = '';
    container.querySelector('#s-email').value = '';
    container.querySelector('#s-username').value = '';
    container.querySelector('#s-number').value = '';
    container.querySelector('#s-temp-pwd').value = '';
    container.querySelector('#pwd-field-group').style.display = 'block';
    container.querySelector('#s-status').value = 'active';
    container.querySelector('#stu-form-error').textContent = '';
    stuModal.showModal();
  };

  async function openEditStudent(uId) {
    const s = await api.get(`/students/${uId}`);
    container.querySelector('#stu-modal-title').textContent = 'Edit Student';
    container.querySelector('#s-id').value = s.id;
    container.querySelector('#s-fname').value = s.first_name;
    container.querySelector('#s-sname').value = s.surname;
    container.querySelector('#s-email').value = s.email;
    container.querySelector('#s-username').value = s.username;
    container.querySelector('#s-number').value = s.student_number || '';
    container.querySelector('#pwd-field-group').style.display = 'none'; // Use Reset Password button instead
    container.querySelector('#s-status').value = s.account_status;
    container.querySelector('#stu-form-error').textContent = '';
    stuModal.showModal();
  }

  container.querySelector('#btn-close-stu-modal').onclick = () => stuModal.close();
  container.querySelector('#btn-cancel-stu-modal').onclick = () => stuModal.close();
  container.querySelector('#btn-close-pwd-notice').onclick = () => pwdNoticeModal.close();
  container.querySelector('#btn-cancel-pwd-notice').onclick = () => pwdNoticeModal.close();
  container.querySelector('#btn-dismiss-pwd-notice').onclick = () => pwdNoticeModal.close();

  // Save student form
  container.querySelector('#student-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = container.querySelector('#s-id').value;
    const errDiv = container.querySelector('#stu-form-error');

    const payload = {
      first_name: container.querySelector('#s-fname').value.trim(),
      surname: container.querySelector('#s-sname').value.trim(),
      email: container.querySelector('#s-email').value.trim(),
      username: container.querySelector('#s-username').value.trim() || null,
      student_number: container.querySelector('#s-number').value.trim() || null,
      account_status: container.querySelector('#s-status').value
    };

    if (!id && container.querySelector('#s-temp-pwd').value.trim()) {
      payload.temporary_password = container.querySelector('#s-temp-pwd').value.trim();
    }

    try {
      if (id) {
        await api.put(`/students/${id}`, payload);
        stuModal.close();
        loadStudents();
      } else {
        const res = await api.post('/students', payload);
        stuModal.close();
        container.querySelector('#pwd-notice-body').innerHTML = `
          <p>Account created for <strong>${escapeHtml(res.student.first_name)} ${escapeHtml(res.student.surname)}</strong>.</p>
          <div style="margin:1rem 0; font-size:0.95rem;">
            <strong>Username:</strong> <code>${escapeHtml(res.student.username)}</code><br>
            <strong>Temporary Password:</strong> <code style="font-weight:700; color:var(--primary);">${escapeHtml(res.temporary_password)}</code>
          </div>
          <p class="form-hint">Provide these credentials to the student. They will be prompted to change their password upon first sign-in.</p>
        `;
        pwdNoticeModal.showModal();
        loadStudents();
      }
    } catch (err) {
      errDiv.textContent = err.message;
    }
  };

  // Import Students
  container.querySelector('#btn-open-import-students').onclick = () => {
    container.querySelector('#import-stu-status').textContent = '';
    importModal.showModal();
  };
  container.querySelector('#btn-close-import-stu').onclick = () => importModal.close();
  container.querySelector('#btn-cancel-import-stu').onclick = () => importModal.close();

  container.querySelector('#btn-submit-import-stu').onclick = async () => {
    const raw = container.querySelector('#import-students-json').value.trim();
    const statusDiv = container.querySelector('#import-stu-status');

    try {
      let rows = [];
      if (raw.startsWith('[')) {
        rows = JSON.parse(raw);
      } else {
        // Simple CSV parse
        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row = {};
          headers.forEach((h, idx) => row[h] = vals[idx]);
          rows.push(row);
        }
      }

      statusDiv.innerHTML = '<span style="color:var(--text-muted)">Importing students...</span>';
      const res = await api.post('/students/import', rows);
      statusDiv.innerHTML = `<span style="color:var(--success); font-weight:600;">Imported ${res.imported.length} student(s)! ${res.errors.length ? `(${res.errors.length} errors)` : ''}</span>`;
      setTimeout(() => {
        importModal.close();
        loadStudents();
      }, 1000);
    } catch (err) {
      statusDiv.innerHTML = `<span style="color:var(--danger); font-weight:600;">Error: ${err.message}</span>`;
    }
  };

  if (action === 'add') {
    container.querySelector('#btn-open-add-student').click();
  }

  loadStudents();
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
