// Multiple Classes per Course Management View (Section 7)

import { api } from '../api.js';

export function renderClassesView(container, router, { action = null } = {}) {
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <div>
        <h1 style="font-size:1.75rem; font-weight:800;">Class Management</h1>
        <p class="form-hint">Create multiple classes under each course, manage class access codes, cohorts, and assign assessments.</p>
      </div>
      <div>
        <button type="button" class="btn btn-primary" id="btn-open-create-class">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Create Class
        </button>
      </div>
    </div>

    <!-- Filter by Course -->
    <div class="card" style="padding:1rem; margin-bottom:1.25rem;">
      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:0.75rem;">
        <select id="class-course-filter" class="form-control">
          <option value="">All Associated Courses</option>
        </select>
        <select id="class-status-filter" class="form-control">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>
    </div>

    <!-- Classes Table -->
    <div class="card" style="padding:0; overflow:hidden;">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th style="width:22%;">Class Name</th>
              <th>Course</th>
              <th>Active Access Code</th>
              <th>Instructor</th>
              <th>Access Duration</th>
              <th>Students</th>
              <th>Assessments</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="classes-tbody">
            <tr><td colspan="9" style="text-align:center; padding:2rem;">Loading classes...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit Class Modal -->
    <dialog id="modal-class-form" style="max-width:600px;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;" id="class-modal-title">Create Class</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-class-modal">&times;</button>
      </div>
      <form id="class-form">
        <div class="modal-body">
          <input type="hidden" id="cl-id">
          <div class="form-group">
            <label class="form-label" for="cl-course">Associated Course <span style="color:var(--danger)">*</span></label>
            <select id="cl-course" class="form-control" required></select>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="cl-name">Class Name <span style="color:var(--danger)">*</span></label>
              <input type="text" id="cl-name" class="form-control" placeholder="e.g. November Morning Class" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="cl-access-code">Active Access Code</label>
              <input type="text" id="cl-access-code" class="form-control" placeholder="e.g. AZ104-CENTURION-01" style="text-transform:uppercase; font-weight:700;">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cl-max-uses" style="display:flex; justify-content:space-between; align-items:center;">
              <span>Access Code Max Usage Limit (Seat Capacity)</span>
              <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">Leave blank for unlimited</span>
            </label>
            <input type="number" id="cl-max-uses" class="form-control" placeholder="e.g. 25 (increase anytime as new students join)" min="1">
            <div class="form-hint" style="font-size:0.75rem; margin-top:0.25rem;">
              Controls how many students can redeem this active access code. You can increase this number anytime when new students join.
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cl-desc">Description</label>
            <textarea id="cl-desc" class="form-control" placeholder="Cohort description..."></textarea>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="cl-instructor">Allocate Instructor</label>
              <select id="cl-instructor" class="form-control">
                <option value="">-- No Allocated Instructor / Self-Paced --</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="cl-duration">Access Duration (Days)</label>
              <input type="number" id="cl-duration" class="form-control" placeholder="e.g. 30" min="1">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cl-facilitator">Custom Facilitator Title <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(Optional override/notes)</span></label>
            <input type="text" id="cl-facilitator" class="form-control" placeholder="e.g. Dr. Evelyn Reed (Lead Instructor)">
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="cl-start">Start Date & Time</label>
              <input type="datetime-local" id="cl-start" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label" for="cl-end">End Date & Time</label>
              <input type="datetime-local" id="cl-end" class="form-control">
            </div>
          </div>
          <div id="class-form-error" style="color:var(--danger); font-size:0.875rem;"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="btn-cancel-class-modal">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-class">Save Class</button>
        </div>
      </form>
    </dialog>

    <!-- Class Access Codes Modal -->
    <dialog id="modal-access-codes" style="max-width:700px;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;" id="codes-modal-title">Class Access Codes</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-codes-modal">&times;</button>
      </div>
      <div class="modal-body">
        <p class="form-hint" style="margin-bottom:1rem;">
          Students enter this class access code after signing in (or during registration) to enroll directly into this class cohort.
        </p>

        <div class="card" style="background:var(--surface-subtle); padding:1rem; margin-bottom:1.25rem;">
          <h4 style="font-size:0.875rem; margin-bottom:0.75rem; color:var(--primary);">Generate or Create New Class Access Code</h4>
          <div style="display:grid; grid-template-columns: 1.8fr 1fr auto; gap:0.5rem; align-items:end;">
            <div>
              <label class="form-label" style="font-size:0.75rem; margin-bottom:0.25rem;" for="new-code-input">Access Code</label>
              <input type="text" id="new-code-input" class="form-control" placeholder="e.g. AZ104-CENTURION-02" style="font-weight:700; text-transform:uppercase;">
            </div>
            <div>
              <label class="form-label" style="font-size:0.75rem; margin-bottom:0.25rem;" for="new-code-max-uses">Max Usage Limit</label>
              <input type="number" id="new-code-max-uses" class="form-control" placeholder="Blank = unlimited" min="1">
            </div>
            <button type="button" class="btn btn-primary" id="btn-create-code" style="height:38px;">+ Add Code</button>
          </div>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>Usage / Seat Limit</th>
                <th>Created</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="codes-table-body"></tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-dismiss-codes-modal">Close</button>
      </div>
    </dialog>

    <!-- Class Details & Enrolment Drawer (Section 7 & 8) -->
    <dialog id="modal-class-details" style="max-width:850px; width:90vw;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;" id="details-class-title">Class Details & Cohort</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-details-modal">&times;</button>
      </div>
      <div class="modal-body" id="class-details-body"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-dismiss-details-modal">Close</button>
      </div>
    </dialog>

    <!-- Delete Class Confirmation Modal -->
    <dialog id="modal-confirm-delete-class" style="max-width:480px; width:95%;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700; color:var(--danger);">Delete Class</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-delete-class">&times;</button>
      </div>
      <div class="modal-body" id="delete-class-modal-body"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-cancel-delete-class">Cancel</button>
        <button type="button" class="btn btn-danger" id="btn-confirm-delete-class" style="font-weight:700;">Delete Permanently</button>
      </div>
    </dialog>
  `;

  const tbody = container.querySelector('#classes-tbody');
  const courseFilter = container.querySelector('#class-course-filter');
  const classModal = container.querySelector('#modal-class-form');
  const codesModal = container.querySelector('#modal-access-codes');
  const detailsModal = container.querySelector('#modal-class-details');
  const deleteClassModal = container.querySelector('#modal-confirm-delete-class');

  let allCourses = [];
  let allInstructors = [];

  Promise.all([
    api.get('/courses'),
    api.getInstructors().catch(() => [])
  ]).then(([courses, instructors]) => {
    allCourses = courses || [];
    allInstructors = instructors || [];

    const filterSelect = container.querySelector('#class-course-filter');
    const formSelect = container.querySelector('#cl-course');
    const instSelect = container.querySelector('#cl-instructor');

    filterSelect.innerHTML = '<option value="">All Associated Courses</option>' +
      courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`).join('');

    formSelect.innerHTML = '<option value="">-- Select Course --</option>' +
      courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`).join('');

    if (instSelect) {
      instSelect.innerHTML = '<option value="">-- No Allocated Instructor / Self-Paced --</option>' +
        allInstructors.map(i => `<option value="${i.id}">${escapeHtml(i.first_name)} ${escapeHtml(i.surname)} (@${escapeHtml(i.username)})</option>`).join('');
    }
  });

  async function loadClasses() {
    const courseId = courseFilter.value;
    const status = container.querySelector('#class-status-filter').value;

    const classes = await api.get(`/classes${courseId ? `?course_id=${courseId}` : ''}`);

    const filtered = status ? classes.filter(c => c.status === status) : classes;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No classes found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(cls => `
      <tr>
        <td>
          <a href="javascript:void(0)" class="btn-view-details" data-id="${cls.id}" style="font-weight:700; color:var(--primary); text-decoration:none;">
            ${escapeHtml(cls.name)}
          </a>
          ${cls.description ? `<div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(cls.description)}</div>` : ''}
        </td>
        <td>
          <span class="badge badge-primary">${escapeHtml(cls.course_code)}</span>
          <span style="font-size:0.8125rem;">${escapeHtml(cls.course_name)}</span>
        </td>
        <td>
          ${cls.active_code ? `
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
              <div style="display:flex; align-items:center; gap:0.35rem;">
                <code style="font-weight:700; background:var(--surface-subtle); padding:0.2rem 0.5rem; border-radius:var(--radius-sm); border:1px solid var(--border);">${escapeHtml(cls.active_code)}</code>
                <button type="button" class="btn btn-secondary btn-sm btn-manage-codes" data-id="${cls.id}" data-name="${escapeHtml(cls.name)}" title="Manage Class Access Codes">Codes</button>
              </div>
              <div style="font-size:0.75rem; display:flex; align-items:center; gap:0.35rem;">
                ${cls.code_max_uses !== null && cls.code_max_uses !== undefined ? `
                  <span class="badge ${cls.code_used_count >= cls.code_max_uses ? 'badge-danger' : 'badge-neutral'}" style="font-size:0.7rem; font-weight:600;">
                    ${cls.code_used_count || 0} / ${cls.code_max_uses} used ${cls.code_used_count >= cls.code_max_uses ? '(FULL)' : ''}
                  </span>
                ` : `
                  <span class="badge badge-neutral" style="font-size:0.7rem;">${cls.code_used_count || 0} used (Unlimited)</span>
                `}
              </div>
            </div>
          ` : `
            <button type="button" class="btn btn-secondary btn-sm btn-manage-codes" data-id="${cls.id}" data-name="${escapeHtml(cls.name)}">+ Create Code</button>
          `}
        </td>
        <td style="font-size:0.8125rem;">
          ${cls.instructor_name 
            ? `<span class="badge badge-primary" style="display:inline-flex; align-items:center; gap:0.35rem;"><span>&#x1F468;&#x200D;&#x1F3EB;</span> ${escapeHtml(cls.instructor_name)}</span>` 
            : `<span style="color:var(--text-muted); font-size:0.8rem;">Unassigned</span>`}
        </td>
        <td style="font-size:0.8125rem;">${cls.access_duration_days ? `${cls.access_duration_days} days` : 'Course duration'}</td>
        <td><span class="badge badge-neutral">${cls.student_count || 0} student(s)</span></td>
        <td><span class="badge badge-neutral">${cls.assessment_count || 0} exam(s)</span></td>
        <td><span class="badge ${cls.status === 'active' ? 'badge-success' : 'badge-neutral'}">${cls.status.toUpperCase()}</span></td>
        <td style="text-align:right;">
          <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
            <button type="button" class="btn btn-secondary btn-sm btn-view-details" data-id="${cls.id}" title="Cohort & Enrolments">Cohort</button>
            <button type="button" class="btn btn-secondary btn-sm btn-dup-class" data-id="${cls.id}" title="Duplicate Class">Duplicate</button>
            <button type="button" class="btn btn-secondary btn-sm btn-edit-class" data-id="${cls.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm btn-delete-class" data-id="${cls.id}" data-name="${escapeHtml(cls.name)}" data-course="${escapeHtml(cls.course_name)}" title="Delete Class">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-manage-codes').forEach(btn => {
      btn.onclick = () => openCodesModal(btn.dataset.id, btn.dataset.name);
    });

    tbody.querySelectorAll('.btn-view-details').forEach(btn => {
      btn.onclick = () => openClassDetails(btn.dataset.id);
    });

    tbody.querySelectorAll('.btn-dup-class').forEach(btn => {
      btn.onclick = async () => {
        const newName = prompt('Enter name for the duplicated class:');
        if (newName) {
          await api.post(`/classes/${btn.dataset.id}/duplicate`, { name: newName });
          loadClasses();
        }
      };
    });

    tbody.querySelectorAll('.btn-edit-class').forEach(btn => {
      btn.onclick = () => openEditClass(btn.dataset.id);
    });

    tbody.querySelectorAll('.btn-delete-class').forEach(btn => {
      btn.onclick = () => openDeleteClassModal(btn.dataset.id, btn.dataset.name, btn.dataset.course);
    });
  }

  function openDeleteClassModal(classId, className, courseName) {
    container.querySelector('#delete-class-modal-body').innerHTML = `
      <p style="font-size:0.95rem; color:var(--text-main); margin-bottom:0.75rem;">
        Are you sure you want to permanently delete the class <strong>${escapeHtml(className)}</strong> (${escapeHtml(courseName)})?
      </p>
      <div class="card" style="background:rgba(220,38,38,0.06); border:1px solid rgba(220,38,38,0.3); padding:0.85rem; font-size:0.85rem; color:var(--danger);">
        <strong>&#x26A0; Warning:</strong> Deleting this class will permanently remove all student enrolments and attempt records for this class, and immediately remove it from both the <strong>Student</strong> and <strong>Instructor</strong> portals.
      </div>
    `;
    deleteClassModal.showModal();

    container.querySelector('#btn-close-delete-class').onclick = () => deleteClassModal.close();
    container.querySelector('#btn-cancel-delete-class').onclick = () => deleteClassModal.close();

    const confirmBtn = container.querySelector('#btn-confirm-delete-class');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete Permanently';
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting...';
      try {
        await api.delete(`/classes/${classId}`);
        deleteClassModal.close();
        loadClasses();
      } catch (err) {
        alert('Failed to delete class: ' + err.message);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete Permanently';
      }
    };
  }

  courseFilter.onchange = loadClasses;
  container.querySelector('#class-status-filter').onchange = loadClasses;

  // Open Create Class Modal
  container.querySelector('#btn-open-create-class').onclick = () => {
    container.querySelector('#class-modal-title').textContent = 'Create Class';
    container.querySelector('#cl-id').value = '';
    container.querySelector('#cl-name').value = '';
    container.querySelector('#cl-access-code').value = '';
    container.querySelector('#cl-max-uses').value = '';
    container.querySelector('#cl-desc').value = '';
    container.querySelector('#cl-instructor').value = '';
    container.querySelector('#cl-facilitator').value = '';
    container.querySelector('#cl-duration').value = '';
    container.querySelector('#cl-start').value = '';
    container.querySelector('#cl-end').value = '';
    container.querySelector('#class-form-error').textContent = '';
    classModal.showModal();
  };

  async function openEditClass(cId) {
    const cls = await api.get(`/classes/${cId}`);
    container.querySelector('#class-modal-title').textContent = 'Edit Class';
    container.querySelector('#cl-id').value = cls.id;
    container.querySelector('#cl-course').value = cls.course_id;
    container.querySelector('#cl-name').value = cls.name;
    container.querySelector('#cl-access-code').value = cls.active_code || '';
    container.querySelector('#cl-max-uses').value = (cls.code_max_uses !== null && cls.code_max_uses !== undefined) ? cls.code_max_uses : '';
    container.querySelector('#cl-desc').value = cls.description || '';
    container.querySelector('#cl-instructor').value = cls.instructor_id || '';
    container.querySelector('#cl-facilitator').value = cls.facilitator_name || '';
    container.querySelector('#cl-duration').value = cls.access_duration_days || '';
    container.querySelector('#cl-start').value = cls.start_date ? cls.start_date.substring(0, 16) : '';
    container.querySelector('#cl-end').value = cls.end_date ? cls.end_date.substring(0, 16) : '';
    container.querySelector('#class-form-error').textContent = '';
    classModal.showModal();
  }

  container.querySelector('#btn-close-class-modal').onclick = () => classModal.close();
  container.querySelector('#btn-cancel-class-modal').onclick = () => classModal.close();

  // Save Class Form
  container.querySelector('#class-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = container.querySelector('#cl-id').value;
    const errDiv = container.querySelector('#class-form-error');

    const maxUsesVal = container.querySelector('#cl-max-uses').value.trim();
    const payload = {
      course_id: container.querySelector('#cl-course').value,
      name: container.querySelector('#cl-name').value.trim(),
      access_code: container.querySelector('#cl-access-code').value.trim().toUpperCase() || null,
      max_uses: maxUsesVal !== '' ? parseInt(maxUsesVal, 10) : null,
      description: container.querySelector('#cl-desc').value.trim(),
      instructor_id: container.querySelector('#cl-instructor').value || null,
      facilitator_name: container.querySelector('#cl-facilitator').value.trim(),
      access_duration_days: container.querySelector('#cl-duration').value ? parseInt(container.querySelector('#cl-duration').value, 10) : null,
      start_date: container.querySelector('#cl-start').value ? new Date(container.querySelector('#cl-start').value).toISOString() : null,
      end_date: container.querySelector('#cl-end').value ? new Date(container.querySelector('#cl-end').value).toISOString() : null
    };

    try {
      if (id) {
        await api.put(`/classes/${id}`, payload);
      } else {
        await api.post('/classes', payload);
      }
      classModal.close();
      loadClasses();
    } catch (err) {
      errDiv.textContent = err.message;
    }
  };

  // Manage Class Access Codes Modal
  let activeClassIdForCodes = null;
  async function openCodesModal(classId, className) {
    activeClassIdForCodes = classId;
    container.querySelector('#codes-modal-title').textContent = `Access Codes for ${className}`;
    await reloadCodesTable(classId);
    codesModal.showModal();
  }

  async function reloadCodesTable(classId) {
    const codes = await api.get(`/classes/${classId}/codes`);
    const codesTbody = container.querySelector('#codes-table-body');

    if (codes.length === 0) {
      codesTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem;">No codes generated yet.</td></tr>`;
      return;
    }

    codesTbody.innerHTML = codes.map(cd => {
      const isFull = cd.max_uses && cd.used_count >= cd.max_uses;
      const limitDisplay = cd.max_uses !== null && cd.max_uses !== undefined 
        ? `${cd.used_count || 0} / ${cd.max_uses}` 
        : `${cd.used_count || 0} used (Unlimited)`;
      return `
      <tr>
        <td>
          <code style="font-weight:700; font-size:0.95rem;">${escapeHtml(cd.code)}</code>
        </td>
        <td>
          <span class="badge ${cd.is_active ? 'badge-success' : 'badge-neutral'}">
            ${cd.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </td>
        <td>
          <div style="display:inline-flex; align-items:center; gap:0.4rem;">
            <span class="badge ${isFull ? 'badge-danger' : 'badge-neutral'}" style="font-weight:600;">
              ${limitDisplay} ${isFull ? '(FULL)' : ''}
            </span>
            <button type="button" class="btn btn-secondary btn-sm btn-edit-code-limit" data-id="${cd.id}" data-code="${escapeHtml(cd.code)}" data-limit="${cd.max_uses !== null && cd.max_uses !== undefined ? cd.max_uses : ''}" title="Adjust or increase usage limit" style="padding:0.15rem 0.4rem; font-size:0.72rem;">
              Edit Limit
            </button>
          </div>
        </td>
        <td style="font-size:0.75rem; color:var(--text-muted);">${cd.created_at ? cd.created_at.substring(0, 10) : ''}</td>
        <td style="text-align:right;">
          <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
            <button type="button" class="btn btn-secondary btn-sm btn-replace-code" data-id="${cd.id}" title="Replace compromised code">Rotate</button>
            <button type="button" class="btn btn-secondary btn-sm btn-toggle-code" data-id="${cd.id}" data-active="${cd.is_active}">
              ${cd.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </td>
      </tr>
      `;
    }).join('');

    codesTbody.querySelectorAll('.btn-edit-code-limit').forEach(btn => {
      btn.onclick = async () => {
        const currentLimit = btn.dataset.limit;
        const promptMsg = `Enter maximum usage limit for code '${btn.dataset.code}':\n(Leave empty to remove limit / make unlimited, or enter a number to increase/decrease seats):`;
        const inputVal = prompt(promptMsg, currentLimit);
        if (inputVal === null) return; // User cancelled

        const trimmed = inputVal.trim();
        let newMax = null;
        if (trimmed !== '') {
          newMax = parseInt(trimmed, 10);
          if (isNaN(newMax) || newMax < 1) {
            alert('Please enter a valid positive number greater than 0.');
            return;
          }
        }

        try {
          await api.put(`/classes/codes/${btn.dataset.id}`, { max_uses: newMax });
          await reloadCodesTable(classId);
          loadClasses();
        } catch (err) {
          alert('Failed to update code limit: ' + err.message);
        }
      };
    });

    codesTbody.querySelectorAll('.btn-replace-code').forEach(btn => {
      btn.onclick = async () => {
        const reason = prompt('Enter reason for replacing/rotating code:', 'Security rotation');
        if (reason) {
          await api.post(`/classes/codes/${btn.dataset.id}/replace`, { reason });
          reloadCodesTable(classId);
          loadClasses();
        }
      };
    });

    codesTbody.querySelectorAll('.btn-toggle-code').forEach(btn => {
      btn.onclick = async () => {
        const nextActive = btn.dataset.active === '1' ? false : true;
        await api.put(`/classes/codes/${btn.dataset.id}/status`, { is_active: nextActive });
        reloadCodesTable(classId);
        loadClasses();
      };
    });
  }

  container.querySelector('#btn-create-code').onclick = async () => {
    const input = container.querySelector('#new-code-input');
    const limitInput = container.querySelector('#new-code-max-uses');
    const val = input.value.trim().toUpperCase();
    if (!val) {
      alert('Please enter a class access code string.');
      return;
    }

    const rawLimit = limitInput ? limitInput.value.trim() : '';
    let parsedLimit = null;
    if (rawLimit !== '') {
      parsedLimit = parseInt(rawLimit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        alert('Max usage limit must be a positive number greater than 0.');
        return;
      }
    }

    try {
      await api.post(`/classes/${activeClassIdForCodes}/codes`, { code: val, max_uses: parsedLimit });
      input.value = '';
      if (limitInput) limitInput.value = '';
      reloadCodesTable(activeClassIdForCodes);
      loadClasses();
    } catch (err) {
      alert(err.message);
    }
  };

  container.querySelector('#btn-close-codes-modal').onclick = () => codesModal.close();
  container.querySelector('#btn-dismiss-codes-modal').onclick = () => codesModal.close();

  // Open Class Cohort Details Modal
  async function openClassDetails(classId) {
    const cls = await api.get(`/classes/${classId}`);
    container.querySelector('#details-class-title').textContent = `${cls.name} (Course: ${cls.course_name})`;
    const body = container.querySelector('#class-details-body');

    body.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.75rem;">
        <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
          <span class="badge ${cls.status === 'active' ? 'badge-success' : 'badge-neutral'}">${cls.status.toUpperCase()}</span>
          ${cls.active_code ? `
            <span style="font-size:0.85rem; display:inline-flex; align-items:center; gap:0.35rem;">
              Access Code: <code style="font-weight:700; background:var(--surface-subtle); padding:0.2rem 0.5rem; border-radius:var(--radius-sm); border:1px solid var(--border);">${escapeHtml(cls.active_code)}</code>
              <span class="badge ${cls.code_max_uses && cls.code_used_count >= cls.code_max_uses ? 'badge-danger' : 'badge-neutral'}" style="font-size:0.72rem;">
                ${cls.code_max_uses ? `${cls.code_used_count || 0}/${cls.code_max_uses} used` : `${cls.code_used_count || 0} used (unlimited)`}
              </span>
            </span>
          ` : ''}
          <span style="font-size:0.875rem; color:var(--text-muted);">Facilitator: ${escapeHtml(cls.instructor_name || cls.facilitator_name || 'None')}</span>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-details-codes">Manage Codes</button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-quick-enroll">+ Enroll Student</button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-assess">+ Assign Exam</button>
        </div>
      </div>

      <!-- Cohort Enrolled Students -->
      <h4 style="font-size:1rem; font-weight:700; margin-bottom:0.75rem;">Enrolled Students (${cls.students.length})</h4>
      <div class="table-container" style="margin-bottom:1.5rem;">
        <table class="table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Username</th>
              <th>Enrolled Date</th>
              <th>Access Expires</th>
              <th>Attempts</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${cls.students.length === 0 ? `
              <tr><td colspan="6" style="text-align:center; padding:1.5rem;">No students enrolled in this class.</td></tr>
            ` : cls.students.map(s => `
              <tr>
                <td><strong>${escapeHtml(s.first_name)} ${escapeHtml(s.surname)}</strong></td>
                <td><code>${escapeHtml(s.username)}</code></td>
                <td style="font-size:0.75rem;">${s.enrolled_at ? s.enrolled_at.substring(0, 10) : ''}</td>
                <td style="font-size:0.75rem;">
                  ${s.enrollment_status === 'expired' 
                    ? '<span class="badge badge-danger">Expired (Data Purged)</span>' 
                    : (s.access_expires_at ? s.access_expires_at.substring(0, 10) : '<span class="badge badge-success">Active</span>')}
                </td>
                <td><span class="badge badge-neutral">${s.attempt_count || 0}</span></td>
                <td style="text-align:right;">
                  <button type="button" class="btn btn-secondary btn-sm btn-move-student" data-uid="${s.id}" data-name="${escapeHtml(s.first_name)}">Move</button>
                  <button type="button" class="btn btn-secondary btn-sm btn-copy-student" data-uid="${s.id}">Copy</button>
                  ${s.enrollment_status !== 'expired' ? `
                    <button type="button" class="btn btn-warning btn-sm btn-expire-student" data-uid="${s.id}" data-name="${escapeHtml(s.first_name)}" title="Expire enrollment and purge questions & previous results per platform rule">Expire</button>
                  ` : ''}
                  <button type="button" class="btn btn-danger btn-sm btn-remove-student" data-uid="${s.id}" title="Remove without deleting account">&times;</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Assigned Assessments -->
      <h4 style="font-size:1rem; font-weight:700; margin-bottom:0.75rem;">Assigned Assessments (${cls.assessments.length})</h4>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Assessment Name</th>
              <th>Questions</th>
              <th>Duration</th>
              <th>Pass Mark</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${cls.assessments.length === 0 ? `
              <tr><td colspan="6" style="text-align:center; padding:1.5rem;">No assessments assigned to this class.</td></tr>
            ` : cls.assessments.map(a => `
              <tr>
                <td><strong>${escapeHtml(a.name)}</strong></td>
                <td><span class="badge badge-neutral"><strong>${a.question_count || 0}</strong> Qs</span></td>
                <td>${a.duration_minutes} min</td>
                <td>${a.pass_mark_percentage}%</td>
                <td><span class="badge badge-success">${a.status.toUpperCase()}</span></td>
                <td style="text-align:right;">
                  <button type="button" class="btn btn-danger btn-sm btn-unassign-assess" data-aid="${a.id}">&times; Unassign</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Hook up cohort student actions
    const manageCodesBtn = body.querySelector('#btn-details-codes');
    if (manageCodesBtn) {
      manageCodesBtn.onclick = () => {
        detailsModal.close();
        openCodesModal(cls.id, cls.name);
      };
    }

    body.querySelectorAll('.btn-expire-student').forEach(btn => {
      btn.onclick = async () => {
        if (confirm(`Enforce Expired Certification Rule for ${btn.dataset.name}?\n\nThis will mark enrollment as EXPIRED and permanently delete all previous questions and attempts for this class per platform policy.`)) {
          try {
            const res = await api.post(`/classes/${classId}/students/${btn.dataset.uid}/expire`, {});
            alert(`Rule enforced: Expired enrollment for ${res.username} and purged ${res.deleted_attempts} historical attempt(s).`);
            openClassDetails(classId);
            loadClasses();
          } catch (err) {
            alert('Failed to expire: ' + err.message);
          }
        }
      };
    });

    body.querySelectorAll('.btn-remove-student').forEach(btn => {
      btn.onclick = async () => {
        if (confirm('Remove student from this class? Note: The student account and previous attempt records will NOT be deleted.')) {
          await api.delete(`/classes/${classId}/students/${btn.dataset.uid}`);
          openClassDetails(classId);
          loadClasses();
        }
      };
    });

    body.querySelectorAll('.btn-move-student').forEach(btn => {
      btn.onclick = async () => {
        const otherClasses = await api.get(`/classes?course_id=${cls.course_id}`);
        const targets = otherClasses.filter(c => c.id !== classId);
        if (targets.length === 0) {
          alert('No other class exists under this course to move the student to.');
          return;
        }
        const promptMsg = `Select target class ID:\n` + targets.map(c => `${c.id} - ${c.name}`).join('\n');
        const targetId = prompt(promptMsg, targets[0].id);
        if (targetId) {
          await api.post(`/classes/${classId}/students/${btn.dataset.uid}/move`, { to_class_id: targetId });
          openClassDetails(classId);
          loadClasses();
        }
      };
    });

    body.querySelectorAll('.btn-copy-student').forEach(btn => {
      btn.onclick = async () => {
        const otherClasses = await api.get(`/classes?course_id=${cls.course_id}`);
        const targets = otherClasses.filter(c => c.id !== classId);
        if (targets.length === 0) {
          alert('No other class exists under this course.');
          return;
        }
        const promptMsg = `Select target class ID to copy student into:\n` + targets.map(c => `${c.id} - ${c.name}`).join('\n');
        const targetId = prompt(promptMsg, targets[0].id);
        if (targetId) {
          await api.post(`/classes/${classId}/students/${btn.dataset.uid}/copy`, { to_class_id: targetId });
          alert('Student copied to target class successfully.');
        }
      };
    });

    body.querySelectorAll('.btn-unassign-assess').forEach(btn => {
      btn.onclick = async () => {
        await api.delete(`/classes/${classId}/assessments/${btn.dataset.aid}`);
        openClassDetails(classId);
        loadClasses();
      };
    });

    detailsModal.showModal();
  }

  container.querySelector('#btn-close-details-modal').onclick = () => detailsModal.close();
  container.querySelector('#btn-dismiss-details-modal').onclick = () => detailsModal.close();

  if (action === 'create') {
    container.querySelector('#btn-open-create-class').click();
  }

  loadClasses();
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
