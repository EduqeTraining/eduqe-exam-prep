const { getDatabase } = require('../db');
const { generateId } = require('../utils/crypto');

function logAction({ userId = null, username = 'system', action, entityType, entityId = null, details = null, ipAddress = '127.0.0.1' }) {
  const db = getDatabase();
  const id = generateId();
  const detailsStr = typeof details === 'object' && details !== null ? JSON.stringify(details) : (details || '');
  
  db.run(
    `INSERT INTO audit_logs (id, user_id, username, action, entity_type, entity_id, details, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, userId, username, action, entityType, entityId, detailsStr, ipAddress]
  );
  return id;
}

function listLogs({ entityType, entityId, userId, limit = 100, offset = 0 } = {}) {
  const db = getDatabase();
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (entityType) {
    sql += ' AND entity_type = ?';
    params.push(entityType);
  }
  if (entityId) {
    sql += ' AND entity_id = ?';
    params.push(entityId);
  }
  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.all(sql, params).map(log => {
    let parsedDetails = null;
    try {
      parsedDetails = log.details ? JSON.parse(log.details) : null;
    } catch (e) {
      parsedDetails = log.details;
    }
    return {
      ...log,
      details: parsedDetails
    };
  });
}

module.exports = {
  logAction,
  listLogs
};
