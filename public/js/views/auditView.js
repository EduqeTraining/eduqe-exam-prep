// Audit Log History View (Section 30)

import { api } from '../api.js';

export async function renderAuditView(container) {
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <div>
        <h1 style="font-size:1.75rem; font-weight:800;">System Audit Log</h1>
        <p class="form-hint">Traceable audit records of course creations, errata corrections, code changes, and score recalculations.</p>
      </div>
    </div>

    <!-- Audit Table Card -->
    <div class="card" style="padding:0; overflow:hidden;">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>User</th>
              <th>Entity</th>
              <th>Details & Reason</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody id="audit-tbody">
            <tr><td colspan="6" style="text-align:center; padding:2rem;">Loading audit trail...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = container.querySelector('#audit-tbody');

  try {
    const logs = await api.get('/audit-logs');
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No audit records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      let detailsSummary = '';
      if (typeof l.details === 'object' && l.details !== null) {
        detailsSummary = `<pre style="font-size:0.75rem; background:var(--surface-subtle); padding:0.4rem; border-radius:var(--radius-sm); margin:0; max-height:80px; overflow-y:auto;">${escapeHtml(JSON.stringify(l.details, null, 1))}</pre>`;
      } else {
        detailsSummary = escapeHtml(l.details || '');
      }

      return `
        <tr>
          <td style="font-size:0.8125rem; white-space:nowrap; color:var(--text-muted);">${l.created_at ? l.created_at.replace('T', ' ').substring(0, 19) : ''}</td>
          <td><span class="badge badge-primary">${escapeHtml(l.action)}</span></td>
          <td><strong>${escapeHtml(l.username || 'System')}</strong></td>
          <td><code>${escapeHtml(l.entity_type || '-')}${l.entity_id ? ` #${escapeHtml(l.entity_id.substring(0, 8))}` : ''}</code></td>
          <td style="max-width:380px;">${detailsSummary}</td>
          <td style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(l.ip_address || '-')}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--danger); text-align:center;">Failed to load audit logs: ${err.message}</td></tr>`;
  }
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
