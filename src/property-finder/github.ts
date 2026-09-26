// Optional owner tools, same approach as plant_watering: a fine-grained
// GitHub token kept in this browser's localStorage lets the page publish
// alert searches to the repo and start the ingest workflow. Nothing here is
// needed to browse listings.

import type { SavedSearch } from './savedSearches.ts';

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

const KEY = 'pf.github.v1';
export const WORKFLOW_FILE = 'property-finder-ingest.yml';
export const SAVED_SEARCHES_PATH = 'property-finder/saved-searches.json';
const DEFAULTS: GitHubConfig = { owner: 'nsfogg', repo: 'nsfogg.github.io', branch: 'main', token: '' };

export function loadGitHubConfig(): GitHubConfig {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<GitHubConfig>) };
  } catch {
    return DEFAULTS;
  }
}

export function saveGitHubConfig(cfg: GitHubConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

async function gh(cfg: GitHubConfig, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.ok || res.status === 404) return res;
  const detail = await res.text().catch(() => '');
  if (res.status === 401) throw new Error('GitHub rejected the token — it may have expired. Paste a new one.');
  if (res.status === 403)
    throw new Error('GitHub refused (403). The token needs Contents and Actions read/write on this repository.');
  throw new Error(`GitHub ${res.status}: ${detail.slice(0, 200)}`);
}

const toBase64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

/** Writes the alert-enabled searches to the repo, where the ingest Action reads them. */
export async function publishAlertSearches(cfg: GitHubConfig, searches: SavedSearch[]): Promise<number> {
  const payload = {
    searches: searches
      .filter((s) => s.alert)
      .map(({ id, name, filters }) => ({ id, name, filters, alert: true, updatedAt: new Date().toISOString() })),
  };
  const path = `/repos/${cfg.owner}/${cfg.repo}/contents/${SAVED_SEARCHES_PATH}`;
  const existing = await gh(cfg, `${path}?ref=${encodeURIComponent(cfg.branch)}`);
  const sha = existing.status === 404 ? undefined : ((await existing.json()) as { sha: string }).sha;
  const res = await gh(cfg, path, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Update Property Finder alert searches [skip ci]',
      content: toBase64(`${JSON.stringify(payload, null, 2)}\n`),
      branch: cfg.branch,
      sha,
    }),
  });
  if (res.status === 404) throw new Error(`Repository ${cfg.owner}/${cfg.repo} not found (or the token can't see it).`);
  return payload.searches.length;
}

/** Starts the ingest workflow now instead of waiting for the schedule. */
export async function triggerRefresh(cfg: GitHubConfig): Promise<void> {
  const res = await gh(cfg, `/repos/${cfg.owner}/${cfg.repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: cfg.branch }),
  });
  if (res.status === 404) throw new Error(`Workflow ${WORKFLOW_FILE} not found on ${cfg.branch}.`);
}

export const actionsUrl = (cfg: GitHubConfig) =>
  `https://github.com/${cfg.owner}/${cfg.repo}/actions/workflows/${WORKFLOW_FILE}`;
