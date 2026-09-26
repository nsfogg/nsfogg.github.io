import { useEffect, useRef, useState } from 'react';
import { KEYWORD_LABELS } from '../../../shared/property-finder/keywords.ts';
import type { Listing } from '../../../shared/property-finder/types.ts';
import { formatWater, listingLinks, moneyFull, relativeDate } from '../data.ts';
import { typeLabel } from './ListingList.tsx';

function Fact({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="pf-fact">
      <dt>{label}</dt>
      <dd>{value === null || value === '' ? '—' : value}</dd>
    </div>
  );
}

export default function ListingDrawer({ listing, onClose, thresholdM }: { listing: Listing; onClose: () => void; thresholdM: number }) {
  const [photo, setPhoto] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setPhoto(0);
    closeRef.current?.focus();
  }, [listing.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const water = formatWater(listing.waterDistanceM, listing.waterName);
  const links = listing.sourceUrl ? [{ label: 'Original listing', href: listing.sourceUrl }, ...listingLinks(listing.address)] : listingLinks(listing.address);

  return (
    <aside className="pf-drawer" role="dialog" aria-modal="false" aria-labelledby="pf-drawer-title">
      <div className="pf-drawer-head">
        <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close listing">
          ✕
        </button>
      </div>

      {listing.photos.length > 0 && (
        <div className="pf-gallery">
          <img src={listing.photos[photo]} alt={`${listing.address}, photo ${photo + 1} of ${listing.photos.length}`} />
          {listing.photos.length > 1 && (
            <div className="pf-gallery-nav">
              <button type="button" className="icon-button" aria-label="Previous photo" onClick={() => setPhoto((p) => (p - 1 + listing.photos.length) % listing.photos.length)}>
                ‹
              </button>
              <span>
                {photo + 1} / {listing.photos.length}
              </span>
              <button type="button" className="icon-button" aria-label="Next photo" onClick={() => setPhoto((p) => (p + 1) % listing.photos.length)}>
                ›
              </button>
            </div>
          )}
        </div>
      )}

      <div className="pf-drawer-body">
        <p className="pf-drawer-price">{moneyFull(listing.price)}</p>
        <h2 id="pf-drawer-title" className="pf-drawer-address">
          {listing.address}
        </h2>

        {water && (
          <p className={`pf-water-callout${listing.waterfront ? ' is-waterfront' : ''}`}>
            <strong>{listing.waterfront ? 'Waterfront' : 'Near water'}</strong>
            <span>
              {water}
              {listing.waterfront && listing.waterDistanceM !== 0 && ` (threshold ${thresholdM} m)`}
            </span>
          </p>
        )}

        <dl className="pf-facts">
          <Fact label="Beds" value={listing.beds} />
          <Fact label="Baths" value={listing.baths} />
          <Fact label="Sqft" value={listing.sqft?.toLocaleString('en-US') ?? null} />
          <Fact label="Lot" value={listing.lotSqft ? `${listing.lotSqft.toLocaleString('en-US')} sqft` : null} />
          <Fact label="Built" value={listing.yearBuilt} />
          <Fact label="Type" value={typeLabel(listing.propertyType)} />
          <Fact label="HOA" value={listing.hoaFee === null ? null : listing.hoaFee === 0 ? 'None' : `${moneyFull(listing.hoaFee)}/mo`} />
          <Fact label="On market" value={listing.daysOnMarket === null ? null : `${listing.daysOnMarket} days`} />
        </dl>

        {listing.keywords.length > 0 && (
          <ul className="tags pf-tags">
            {listing.keywords.map((k) => (
              <li key={k}>{KEYWORD_LABELS[k] ?? k}</li>
            ))}
          </ul>
        )}

        {listing.description && <p className="pf-description">{listing.description}</p>}

        {listing.priceHistory.length > 1 && (
          <section className="pf-history" aria-label="Price history">
            <h3>Price history</h3>
            <ol>
              {[...listing.priceHistory].reverse().map((p) => (
                <li key={p.date}>
                  <span>{new Date(`${p.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span>{moneyFull(p.price)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="pf-links">
          {links.map((link) => (
            <a key={link.label} className="text-link" href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label} ↗
            </a>
          ))}
        </div>

        <p className="pf-attribution">
          {listing.listingOffice && <>Listed by {listing.listingOffice}. </>}
          Data from {listing.source === 'rentcast' ? 'RentCast' : listing.source === 'simplyrets-demo' ? 'the SimplyRETS demo feed (sample data)' : listing.source}
          {listing.mergedSources.length > 0 && ` and ${listing.mergedSources.length} other source${listing.mergedSources.length > 1 ? 's' : ''}`}. First seen{' '}
          {relativeDate(listing.firstSeen)}.
        </p>
      </div>
    </aside>
  );
}
