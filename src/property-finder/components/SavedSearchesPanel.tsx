import type { Listing } from '../../../shared/property-finder/types.ts';
import { newMatches, type SavedSearch } from '../savedSearches.ts';

export default function SavedSearchesPanel({
  searches,
  listings,
  onApply,
  onToggleAlert,
  onRemove,
  canPublish,
  onPublish,
  publishState,
}: {
  searches: SavedSearch[];
  listings: Listing[];
  onApply: (s: SavedSearch) => void;
  onToggleAlert: (s: SavedSearch) => void;
  onRemove: (s: SavedSearch) => void;
  canPublish: boolean;
  onPublish: () => void;
  publishState: string | null;
}) {
  if (!searches.length) {
    return (
      <div className="pf-panel-empty">
        <p className="pf-empty-title">No saved searches yet.</p>
        <p>Set some filters, then choose “Save search”. You’ll see how many homes are new each time you come back.</p>
      </div>
    );
  }

  return (
    <div className="pf-saved">
      <ul>
        {searches.map((s) => {
          const fresh = newMatches(s, listings).length;
          return (
            <li key={s.id} className="pf-saved-row">
              <button type="button" className="pf-saved-apply" onClick={() => onApply(s)}>
                <span className="pf-saved-name">{s.name}</span>
                {fresh > 0 && <span className="badge">{fresh} new</span>}
              </button>
              <label className="pf-saved-alert" title="Send new matches to Discord (after publishing)">
                <input type="checkbox" checked={s.alert} onChange={() => onToggleAlert(s)} />
                Alert
              </label>
              <button type="button" className="pf-link pf-danger" onClick={() => onRemove(s)} aria-label={`Delete ${s.name}`}>
                Delete
              </button>
            </li>
          );
        })}
      </ul>
      <div className="pf-saved-footer">
        {canPublish ? (
          <button type="button" className="pf-btn" onClick={onPublish}>
            Publish alerts to GitHub
          </button>
        ) : (
          <p className="pf-help">Discord alerts need a GitHub token — add one in Settings.</p>
        )}
        {publishState && <p className="pf-help" role="status">{publishState}</p>}
      </div>
    </div>
  );
}
