import { useEffect, useRef, useState } from 'react';
import type { Listing } from '../../../shared/property-finder/types.ts';
import { formatWater, moneyFull } from '../data.ts';

const PAGE = 60;
const TYPE_LABELS: Record<string, string> = {
  single_family: 'House',
  condo: 'Condo',
  townhouse: 'Townhouse',
  multi_family: 'Multi-family',
  manufactured: 'Manufactured',
  land: 'Land',
  other: 'Other',
};
export const typeLabel = (t: string) => TYPE_LABELS[t] ?? t;

export function facts(l: Listing): string {
  return [
    l.beds !== null && l.beds > 0 && `${l.beds} bd`,
    l.baths !== null && l.baths > 0 && `${l.baths} ba`,
    l.sqft !== null && l.sqft > 0 && `${l.sqft.toLocaleString('en-US')} sqft`,
    typeLabel(l.propertyType),
  ]
    .filter(Boolean)
    .join(' · ');
}

export default function ListingList({
  listings,
  selectedId,
  onSelect,
  newIds,
}: {
  listings: Listing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  newIds: Set<string>;
}) {
  const [shown, setShown] = useState(PAGE);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setShown(PAGE), [listings]);
  useEffect(() => selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), [selectedId]);

  if (!listings.length) {
    return (
      <div className="pf-empty">
        <p className="pf-empty-title">No homes match.</p>
        <p>Try widening the price range or clearing a filter.</p>
      </div>
    );
  }

  return (
    <ol className="pf-list" aria-label="Listings">
      {listings.slice(0, shown).map((l) => {
        const water = formatWater(l.waterDistanceM, l.waterName);
        const drop = l.priceHistory.length > 1 && l.price < l.priceHistory[l.priceHistory.length - 2].price;
        return (
          <li key={l.id}>
            <button
              type="button"
              ref={l.id === selectedId ? selectedRef : undefined}
              className="pf-row"
              aria-current={l.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(l.id)}
            >
              {l.photos[0] ? (
                <img className="pf-row-photo" src={l.photos[0]} alt="" loading="lazy" />
              ) : (
                <span className={`pf-row-photo pf-row-photo--none${l.waterfront ? ' is-water' : ''}`} aria-hidden="true" />
              )}
              <span className="pf-row-body">
                <span className="pf-row-price">
                  {moneyFull(l.price)}
                  {newIds.has(l.id) && <span className="pf-tag pf-tag--new">New</span>}
                  {drop && <span className="pf-tag pf-tag--drop">Price cut</span>}
                </span>
                <span className="pf-row-facts">{facts(l)}</span>
                <span className="pf-row-address">{l.address}</span>
                {l.waterfront ? (
                  <span className="pf-row-water">🌊 {water}</span>
                ) : (
                  water && <span className="pf-row-near">{water}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
      {shown < listings.length && (
        <li className="pf-more">
          <button type="button" className="pf-btn" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({listings.length - shown} left)
          </button>
        </li>
      )}
    </ol>
  );
}
