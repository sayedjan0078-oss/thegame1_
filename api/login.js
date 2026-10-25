const { createToken } = require('../lib/_auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return res.status(500).json({ error: 'Admin credentials are not configured in Vercel environment variables.' });
  }

  if (typeof username !== 'string' || typeof password !== 'string' ||
      username !== expectedUser || password !== expectedPassword) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  return res.status(200).json({ token: createToken(username), expiresIn: 43200 });
};
