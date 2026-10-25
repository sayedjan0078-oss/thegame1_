const crypto = require('crypto');

function secret() {
  if (!process.env.SYNC_SECRET || process.env.SYNC_SECRET.length < 32) {
    throw new Error('SYNC_SECRET must be set to a random string of at least 32 characters.');
  }
  return process.env.SYNC_SECRET;
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function createToken(username) {
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    exp: Date.now() + 12 * 60 * 60 * 1000
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Boolean(data.sub && data.exp > Date.now());
  } catch {
    return false;
  }
}

module.exports = { createToken, verifyToken };
