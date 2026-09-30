// Minimal GitHub REST client for storing vault files in a (private) repository.
// Talks to api.github.com directly from the browser — no server of our own.

import { b64decode, b64encode } from './crypto.js';

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

export class GitHub {
  constructor({ token, owner, repo, branch }) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
  }

  async request(method, path, { body, accept = 'application/vnd.github+json', as = 'json' } = {}) {
    const headers = {
      Accept: accept,
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      });
    } catch {
      throw new GitHubError('Could not reach GitHub. Check your connection.', 0);
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.json()).message || '';
      } catch {
        /* ignore */
      }
      throw new GitHubError(`GitHub ${res.status}: ${detail || res.statusText}`, res.status);
    }
    if (res.status === 204) return null;
    if (as === 'bytes') return new Uint8Array(await res.arrayBuffer());
    return res.json();
  }

  get repoPath() {
    return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`;
  }

  getUser() {
    return this.request('GET', '/user');
  }

  getRepo() {
    return this.request('GET', this.repoPath);
  }

  /** Makes sure the data branch exists, creating it from the default branch if needed. */
  async ensureBranch() {
    try {
      await this.request('GET', `${this.repoPath}/git/ref/heads/${encodePath(this.branch)}`);
      return;
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    const repo = await this.getRepo();
    const base = await this.request('GET', `${this.repoPath}/git/ref/heads/${encodePath(repo.default_branch)}`);
    await this.request('POST', `${this.repoPath}/git/refs`, {
      body: { ref: `refs/heads/${this.branch}`, sha: base.object.sha },
    });
  }

  /** Returns { sha, bytes } or null if the file does not exist. Handles files > 1 MB. */
  async getFile(path) {
    const url = `${this.repoPath}/contents/${encodePath(path)}?ref=${encodeURIComponent(this.branch)}`;
    let meta;
    try {
      meta = await this.request('GET', url);
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
    if (Array.isArray(meta) || meta.type !== 'file') throw new GitHubError(`${path} is not a file`, 400);
    let bytes;
    if (meta.encoding === 'base64' && meta.content) {
      bytes = b64decode(meta.content);
    } else if (meta.size === 0) {
      bytes = new Uint8Array(0);
    } else {
      // Files over 1 MB are not inlined; fetch the blob by sha (up to 100 MB).
      const blob = await this.request('GET', `${this.repoPath}/git/blobs/${meta.sha}`);
      bytes = b64decode(blob.content);
    }
    return { sha: meta.sha, bytes };
  }

  /** Creates or updates a file. Pass the current sha when updating. Returns the new sha. */
  async putFile(path, bytes, message, sha) {
    const body = { message, content: b64encode(bytes), branch: this.branch };
    if (sha) body.sha = sha;
    const res = await this.request('PUT', `${this.repoPath}/contents/${encodePath(path)}`, { body });
    return res.content.sha;
  }

  async deleteFile(path, sha, message) {
    await this.request('DELETE', `${this.repoPath}/contents/${encodePath(path)}`, {
      body: { message, sha, branch: this.branch },
    });
  }

  /** Returns the sha of a file without downloading it, or null if missing. */
  async getSha(path) {
    try {
      const meta = await this.request(
        'GET',
        `${this.repoPath}/contents/${encodePath(path)}?ref=${encodeURIComponent(this.branch)}`,
        { accept: 'application/vnd.github.object+json' },
      );
      return meta.sha;
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }
}

export function isConflict(e) {
  return e instanceof GitHubError && (e.status === 409 || e.status === 422);
}
