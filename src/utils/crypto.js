const crypto = require('node:crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateId() {
  return crypto.randomUUID();
}

function generateRandomCode(prefix = 'EDU', length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return `${prefix}-${code}`;
}

function generateTemporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let pwd = 'Edu!';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    pwd += chars[randomBytes[i] % chars.length];
  }
  return pwd;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  generateId,
  generateRandomCode,
  generateTemporaryPassword
};
