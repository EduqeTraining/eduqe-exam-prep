// Assessments List View (Sections 12, 17)

import { api } from '../api.js';

export function renderAssessmentsView(container, router) {
  container.innerHTML = `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h1 style="font-size:1.75rem; font-weight:800;">Assessments</h1>
          <p class="form-hint">Manage formal assessments, certification mock exams, and practice question sets.</p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn-primary" id="btn-create-assessment">+ Create Assessment</button>
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="card" style="margin-bottom:1.5rem; padding:1rem 1.25rem;">
        <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center;">
          <div style="flex:1; min-width:240px;">
            <input type="text" id="filter-search" class="form-control" placeholder="Search assessments by title or description..." />
          </div>
          <div style="width:200px;">
            <select id="filter-status" class="form-control">
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-filter-refresh">Refresh</button>
        </div>
      </div>

      <div id="assessments-list-container">
        <div style="text-align:center; padding:3rem;">Loading assessments...</div>
      </div>
    </div>
  `;

  const listContainer = container.querySelector('#assessments-list-container');
  const searchInput = container.querySelector('#filter-search');
  const statusSelect = container.querySelector('#filter-status');
  const refreshBtn = container.querySelector('#btn-filter-refresh');
  const createBtn = container.querySelector('#btn-create-assessment');

  createBtn.onclick = () => {
    if (router && router.navigate) {
      router.navigate('assessment-builder');
    }
  };

  async function loadAssessments() {
    listContainer.innerHTML = `<div style="text-align:center; padding:3rem;">Loading assessments...</div>`;
    try {
      const q = encodeURIComponent(searchInput.value.trim());
      const status = statusSelect.value;
      const data = await api.get(`/assessments?q=${q}&status=${status}`);

      if (!data || data.length === 0) {
        listContainer.innerHTML = `
          <div class="card" style="text-align:center; padding:3rem; color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:0.5rem;">&#x1F4CB;</div>
            <p style="font-weight:600; margin-bottom:0.5rem;">No assessments found matching the criteria.</p>
            <button type="button" class="btn btn-primary btn-sm" id="btn-empty-create">+ Create Assessment</button>
          </div>
        `;
        const emptyBtn = listContainer.querySelector('#btn-empty-create');
        if (emptyBtn) {
          emptyBtn.onclick = () => router && router.navigate && router.navigate('assessment-builder');
        }
        return;
      }

      listContainer.innerHTML = `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Course</th>
                <th>Questions</th>
                <th>Duration</th>
                <th>Pass Mark</th>
                <th>Attempts Allowed</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(a => `
                <tr>
                  <td>
                    <strong>${escapeHtml(a.name)}</strong>
                    ${a.description ? `<div style="font-size:0.75rem; color:var(--text-muted); max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(a.description)}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge badge-secondary">${escapeHtml(a.course_name || 'General')}</span>
                  </td>
                  <td>
                    <span class="badge badge-neutral" style="margin-right:0.25rem;">${a.section_count || 3} Sections</span>
                    <strong>${a.question_count || 0}</strong> Qs
                  </td>
                  <td>${a.duration_minutes} min</td>
                  <td>${a.pass_mark_percentage}%</td>
                  <td>${(!a.max_attempts || a.max_attempts <= 0) ? '<span class="badge badge-neutral">Unlimited</span>' : `${a.max_attempts} max`}</td>
                  <td>
                    <span class="badge ${a.status === 'published' ? 'badge-success' : (a.status === 'draft' ? 'badge-warning' : 'badge-secondary')}">
                      ${escapeHtml(a.status ? a.status.toUpperCase() : 'DRAFT')}
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex; gap:0.35rem;">
                      <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${a.id}">
                        Edit
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm" data-action="duplicate" data-id="${a.id}" data-name="${escapeHtml(a.name)}">
                        Duplicate
                      </button>
                      ${a.status === 'published' ? `
                        <button type="button" class="btn btn-secondary btn-sm" data-action="status" data-id="${a.id}" data-status="draft">
                          Draft
                        </button>
                      ` : `
                        <button type="button" class="btn btn-success btn-sm" data-action="status" data-id="${a.id}" data-status="published">
                          Publish
                        </button>
                      `}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Attach actions
      listContainer.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          if (router && router.navigate) {
            router.navigate(`assessment-builder?id=${id}`);
          }
        };
      });

      listContainer.querySelectorAll('[data-action="duplicate"]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          const currentName = btn.getAttribute('data-name');
          const newName = prompt('Enter a name for the duplicated assessment:', `${currentName} (Copy)`);
          if (!newName) return;
          try {
            await api.post(`/assessments/${id}/duplicate`, { name: newName });
            loadAssessments();
          } catch (err) {
            alert('Failed to duplicate assessment: ' + err.message);
          }
        };
      });

      listContainer.querySelectorAll('[data-action="status"]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          const newStatus = btn.getAttribute('data-status');
          try {
            await api.post(`/assessments/${id}/status`, { status: newStatus });
            loadAssessments();
          } catch (err) {
            alert('Failed to update status: ' + err.message);
          }
        };
      });

    } catch (err) {
      listContainer.innerHTML = `
        <div class="card" style="text-align:center; padding:3rem; color:var(--danger);">
          Failed to load assessments: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  searchInput.oninput = debounce(() => loadAssessments(), 300);
  statusSelect.onchange = () => loadAssessments();
  refreshBtn.onclick = () => loadAssessments();

  loadAssessments();
}

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
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
