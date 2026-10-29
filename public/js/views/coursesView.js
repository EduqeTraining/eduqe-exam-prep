// Course & Access Code Management View (Sections 5 & 6)

import { api } from '../api.js';

export function renderCoursesView(container, router, { action = null } = {}) {
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <div>
        <h1 style="font-size:1.75rem; font-weight:800;">Course Management</h1>
        <p class="form-hint">Create, manage, and duplicate exam preparation courses.</p>
      </div>
      <div>
        <button type="button" class="btn btn-primary" id="btn-open-create-course">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Create Course
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="card" style="padding:1rem; margin-bottom:1.25rem;">
      <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:0.75rem;">
        <input type="text" id="course-filter-search" class="form-control" placeholder="Search by course name, code, subject...">
        <select id="course-filter-status" class="form-control">
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
        <select id="course-filter-track" class="form-control">
          <option value="">All Tracks</option>
        </select>
      </div>
    </div>

    <!-- Courses Grid / Table -->
    <div class="card" style="padding:0; overflow:hidden;">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th style="width:36%;">Course</th>
              <th>Code</th>
              <th>Status</th>
              <th>Classes</th>
              <th>Assessments</th>
              <th>Enrolled</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="courses-tbody">
            <tr><td colspan="7" style="text-align:center; padding:2rem;">Loading courses...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit Course Modal -->
    <dialog id="modal-course-form" style="max-width:650px;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700;" id="course-modal-title">Create Course</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-course-modal">&times;</button>
      </div>
      <form id="course-form">
        <div class="modal-body">
          <input type="hidden" id="c-id">
          <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="c-name">Course Name <span style="color:var(--danger)">*</span></label>
              <input type="text" id="c-name" class="form-control" placeholder="e.g. AZ-104 Exam Preparation" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="c-code">Course Code <span style="color:var(--danger)">*</span></label>
              <input type="text" id="c-code" class="form-control" placeholder="e.g. AZ104" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="c-desc">Description</label>
            <textarea id="c-desc" class="form-control" placeholder="Preparation programme covering Azure administration..."></textarea>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="c-subject">Subject</label>
              <input type="text" id="c-subject" class="form-control" placeholder="Cloud Computing">
            </div>
            <div class="form-group">
              <label class="form-label" for="c-track">Certification / Learning Track</label>
              <input type="text" id="c-track" class="form-control" placeholder="Azure Systems Administration">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="c-status">Status</label>
            <select id="c-status" class="form-control">
              <option value="draft">Draft</option>
              <option value="published" selected>Published</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div id="course-form-error" style="color:var(--danger); font-size:0.875rem;"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="btn-cancel-course-modal">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-course">Save Course</button>
        </div>
      </form>
    </dialog>

    <!-- Delete Course Confirmation Modal -->
    <dialog id="modal-confirm-delete-course" style="max-width:480px; width:95%;">
      <div class="modal-header">
        <h3 style="font-size:1.125rem; font-weight:700; color:var(--danger);">Delete Course</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-delete-course">&times;</button>
      </div>
      <div class="modal-body" id="delete-course-modal-body"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-cancel-delete-course">Cancel</button>
        <button type="button" class="btn btn-danger" id="btn-confirm-delete-course" style="font-weight:700;">Delete Permanently</button>
      </div>
    </dialog>
  `;

  const tbody = container.querySelector('#courses-tbody');
  const courseModal = container.querySelector('#modal-course-form');
  const deleteCourseModal = container.querySelector('#modal-confirm-delete-course');

  async function loadCourses() {
    const search = container.querySelector('#course-filter-search').value.trim();
    const status = container.querySelector('#course-filter-status').value;
    const track = container.querySelector('#course-filter-track').value;

    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    if (track) params.set('learning_track', track);

    const courses = await api.get(`/courses?${params.toString()}`);

    if (courses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No courses found.</td></tr>`;
      return;
    }

    tbody.innerHTML = courses.map(c => {
      const statusBadge = c.status === 'published' ? 'badge-success' : (c.status === 'draft' ? 'badge-neutral' : 'badge-warning');

      return `
        <tr>
          <td>
            <strong>${escapeHtml(c.name)}</strong>
            ${c.description ? `<div style="font-size:0.75rem; color:var(--text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:340px;">${escapeHtml(c.description)}</div>` : ''}
          </td>
          <td><span class="badge badge-primary" style="font-weight:700;">${escapeHtml(c.code)}</span></td>
          <td><span class="badge ${statusBadge}">${c.status.toUpperCase()}</span></td>
          <td><span class="badge badge-neutral">${c.class_count || 0}</span></td>
          <td><span class="badge badge-neutral">${c.assessment_count || 0}</span></td>
          <td><span class="badge badge-neutral">${c.enrolled_students_count || 0} student(s)</span></td>
          <td style="text-align:right;">
            <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
              <button type="button" class="btn btn-secondary btn-sm btn-edit-course" data-id="${c.id}" title="Edit Course">Edit</button>
              <button type="button" class="btn btn-secondary btn-sm btn-dup-course" data-id="${c.id}" title="Duplicate Course">Duplicate</button>
              <button type="button" class="btn btn-secondary btn-sm btn-toggle-status" data-id="${c.id}" data-status="${c.status}">
                ${c.status === 'published' ? 'Close' : (c.status === 'closed' ? 'Reactivate' : 'Publish')}
              </button>
              <button type="button" class="btn btn-danger btn-sm btn-delete-course" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-code="${escapeHtml(c.code)}" title="Delete Course">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Row event handlers
    tbody.querySelectorAll('.btn-edit-course').forEach(btn => {
      btn.onclick = () => openCourseEdit(btn.dataset.id);
    });

    tbody.querySelectorAll('.btn-dup-course').forEach(btn => {
      btn.onclick = async () => {
        if (confirm('Duplicate this course? A new course will be created in Draft status.')) {
          await api.post(`/courses/${btn.dataset.id}/duplicate`, {});
          loadCourses();
        }
      };
    });

    tbody.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.onclick = async () => {
        const cur = btn.dataset.status;
        const next = cur === 'published' ? 'closed' : 'published';
        await api.post(`/courses/${btn.dataset.id}/status`, { status: next });
        loadCourses();
      };
    });

    tbody.querySelectorAll('.btn-delete-course').forEach(btn => {
      btn.onclick = () => openDeleteCourseModal(btn.dataset.id, btn.dataset.name, btn.dataset.code);
    });
  }

  function openDeleteCourseModal(courseId, courseName, courseCode) {
    container.querySelector('#delete-course-modal-body').innerHTML = `
      <p style="font-size:0.95rem; color:var(--text-main); margin-bottom:0.75rem;">
        Are you sure you want to permanently delete <strong>${escapeHtml(courseName)}</strong> (<code>${escapeHtml(courseCode)}</code>)?
      </p>
      <div class="card" style="background:rgba(220,38,38,0.06); border:1px solid rgba(220,38,38,0.3); padding:0.85rem; font-size:0.85rem; color:var(--danger);">
        <strong>&#x26A0; Warning:</strong> Deleting this course will permanently remove all associated classes, assessments, questions, student enrolments, and attempt results, and remove it from both the <strong>Student</strong> and <strong>Instructor</strong> portals.
      </div>
    `;
    deleteCourseModal.showModal();

    container.querySelector('#btn-close-delete-course').onclick = () => deleteCourseModal.close();
    container.querySelector('#btn-cancel-delete-course').onclick = () => deleteCourseModal.close();

    const confirmBtn = container.querySelector('#btn-confirm-delete-course');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete Permanently';
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting...';
      try {
        await api.delete(`/courses/${courseId}`);
        deleteCourseModal.close();
        loadCourses();
      } catch (err) {
        alert('Failed to delete course: ' + err.message);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete Permanently';
      }
    };
  }

  container.querySelector('#course-filter-search').oninput = loadCourses;
  container.querySelector('#course-filter-status').onchange = loadCourses;

  // Open Create Course Modal
  container.querySelector('#btn-open-create-course').onclick = () => {
    container.querySelector('#course-modal-title').textContent = 'Create Course';
    container.querySelector('#c-id').value = '';
    container.querySelector('#c-name').value = '';
    container.querySelector('#c-code').value = '';
    container.querySelector('#c-desc').value = '';
    container.querySelector('#c-subject').value = '';
    container.querySelector('#c-track').value = '';
    container.querySelector('#c-status').value = 'published';
    container.querySelector('#course-form-error').textContent = '';
    courseModal.showModal();
  };

  async function openCourseEdit(cId) {
    const c = await api.get(`/courses/${cId}`);
    container.querySelector('#course-modal-title').textContent = 'Edit Course';
    container.querySelector('#c-id').value = c.id;
    container.querySelector('#c-name').value = c.name;
    container.querySelector('#c-code').value = c.code;
    container.querySelector('#c-desc').value = c.description || '';
    container.querySelector('#c-subject').value = c.subject || '';
    container.querySelector('#c-track').value = c.learning_track || '';
    container.querySelector('#c-status').value = c.status;
    container.querySelector('#course-form-error').textContent = '';
    courseModal.showModal();
  }

  container.querySelector('#btn-close-course-modal').onclick = () => courseModal.close();
  container.querySelector('#btn-cancel-course-modal').onclick = () => courseModal.close();

  // Save Course Form
  container.querySelector('#course-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = container.querySelector('#c-id').value;
    const errDiv = container.querySelector('#course-form-error');

    const payload = {
      name: container.querySelector('#c-name').value.trim(),
      code: container.querySelector('#c-code').value.trim().toUpperCase(),
      description: container.querySelector('#c-desc').value.trim(),
      subject: container.querySelector('#c-subject').value.trim(),
      learning_track: container.querySelector('#c-track').value.trim(),
      status: container.querySelector('#c-status').value
    };

    try {
      if (id) {
        await api.put(`/courses/${id}`, payload);
      } else {
        await api.post('/courses', payload);
      }
      courseModal.close();
      loadCourses();
    } catch (err) {
      errDiv.textContent = err.message;
    }
  };

  if (action === 'create') {
    container.querySelector('#btn-open-create-course').click();
  }

  loadCourses();
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
