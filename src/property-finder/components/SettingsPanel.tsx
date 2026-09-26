import { useState } from 'react';
import type { SnapshotMeta } from '../../../shared/property-finder/types.ts';
import { relativeDate } from '../data.ts';
import { actionsUrl, loadGitHubConfig, saveGitHubConfig, triggerRefresh, type GitHubConfig } from '../github.ts';

export default function SettingsPanel({ meta, onConfigChange }: { meta: SnapshotMeta; onConfigChange: (cfg: GitHubConfig) => void }) {
  const [cfg, setCfg] = useState(loadGitHubConfig);
  const [status, setStatus] = useState<string | null>(null);
  const run = meta.lastRun;

  const save = (next: GitHubConfig) => {
    setCfg(next);
    saveGitHubConfig(next);
    onConfigChange(next);
  };

  const refresh = async () => {
    setStatus('Starting…');
    try {
      await triggerRefresh(cfg);
      setStatus('Started. New listings are published in about 2–3 minutes — reload then.');
    } catch (err) {
      setStatus((err as Error).message);
    }
  };

  return (
    <div className="pf-settings">
      <section>
        <h3>Data</h3>
        <dl className="pf-kv">
          <dt>Updated</dt>
          <dd>{relativeDate(meta.generatedAt)}</dd>
          <dt>Source</dt>
          <dd>{meta.demo ? 'SimplyRETS demo feed (sample data)' : meta.sources.join(', ') || '—'}</dd>
          <dt>Areas</dt>
          <dd>{meta.areas.join(', ') || '—'}</dd>
          <dt>API calls</dt>
          <dd>
            {meta.budget.callsUsed} of {meta.budget.limit} used in {meta.budget.month}
          </dd>
          {run && (
            <>
              <dt>Last run</dt>
              <dd>
                {run.status} · {run.fetched} fetched, {run.created} new, {run.offMarket} off-market
              </dd>
            </>
          )}
        </dl>
        {run?.notes.length ? (
          <ul className="pf-notes">
            {run.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h3>GitHub (owner only)</h3>
        <p className="pf-help">
          A fine-grained token for <strong>{cfg.owner}/{cfg.repo}</strong> with <em>Contents</em> and <em>Actions</em> read/write lets this
          page publish alert searches and refresh listings. It stays in this browser.
        </p>
        <label className="pf-field">
          <span>Token</span>
          <input
            type="password"
            autoComplete="off"
            placeholder="github_pat_…"
            value={cfg.token}
            onChange={(e) => save({ ...cfg, token: e.target.value.trim() })}
          />
        </label>
        <div className="pf-inline">
          <button type="button" className="pf-btn" disabled={!cfg.token} onClick={refresh}>
            Refresh listings now
          </button>
          <a className="text-link" href={actionsUrl(cfg)} target="_blank" rel="noopener noreferrer">
            Runs ↗
          </a>
          {cfg.token && (
            <button type="button" className="pf-link pf-danger" onClick={() => save({ ...cfg, token: '' })}>
              Forget token
            </button>
          )}
        </div>
        {status && (
          <p className="pf-help" role="status">
            {status}
          </p>
        )}
      </section>
    </div>
  );
}
