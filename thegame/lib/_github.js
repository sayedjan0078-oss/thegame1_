const API_BASE = 'https://api.github.com';

function config() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error('Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO environment variable.');
  }
  return {
    token: GITHUB_TOKEN,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || 'main',
    path: process.env.GITHUB_STATE_PATH || '.thegame-data/state.json'
  };
}

async function githubRequest(path, options = {}) {
  const cfg = config();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `GitHub API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function filePath() {
  const cfg = config();
  return `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${cfg.path.split('/').map(encodeURIComponent).join('/')}`;
}

async function readStateFile() {
  const cfg = config();
  try {
    const file = await githubRequest(`${filePath()}?ref=${encodeURIComponent(cfg.branch)}`);
    const raw = Buffer.from(file.content || '', 'base64').toString('utf8');
    return { state: JSON.parse(raw), sha: file.sha };
  } catch (error) {
    if (error.status === 404) return { state: null, sha: null };
    throw error;
  }
}

async function writeStateFile(state) {
  const cfg = config();
  const existing = await readStateFile();
  const content = Buffer.from(JSON.stringify(state, null, 2), 'utf8').toString('base64');
  const payload = {
    message: 'Update The Game shared site data',
    content,
    branch: cfg.branch
  };
  if (existing.sha) payload.sha = existing.sha;

  return githubRequest(filePath(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

module.exports = { readStateFile, writeStateFile };
