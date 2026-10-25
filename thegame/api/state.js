const { readStateFile, writeStateFile } = require('../lib/_github');
const { verifyToken } = require('../lib/_auth');

const MAX_BODY_BYTES = 3 * 1024 * 1024;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Vary', 'Authorization');

  if (req.method === 'GET') {
    try {
      const file = await readStateFile();
      if (!file.state) return res.status(200).json({ sharedState: null, updatedAt: null });
      return res.status(200).json({
        sharedState: file.state.sharedState || null,
        updatedAt: file.state.updatedAt || null
      });
    } catch (error) {
      console.error('Read shared state failed:', error.message);
      return res.status(500).json({ error: 'Could not read shared data. Check Vercel GitHub environment variables and repository permissions.' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyToken(req)) {
    return res.status(401).json({ error: 'Admin session is missing or expired. Please sign in again.' });
  }

  try {
    const serialized = JSON.stringify(req.body || {});
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'Shared data is too large. Use image URLs instead of large embedded image files.' });
    }

    const body = req.body || {};
    const sharedState = {
      customGames: Array.isArray(body.customGames) ? body.customGames : [],
      deletedBaseIds: Array.isArray(body.deletedBaseIds) ? body.deletedBaseIds : [],
      banners: Array.isArray(body.banners) ? body.banners : []
    };
    const updatedAt = new Date().toISOString();
    await writeStateFile({ sharedState, updatedAt });
    return res.status(200).json({ ok: true, updatedAt });
  } catch (error) {
    console.error('Write shared state failed:', error.message);
    const status = error.status === 409 ? 409 : 500;
    return res.status(status).json({
      error: status === 409
        ? 'Another update happened at the same time. Please save again.'
        : 'Could not save shared data. Check the GitHub token, repository, branch, and permissions.'
    });
  }
};
