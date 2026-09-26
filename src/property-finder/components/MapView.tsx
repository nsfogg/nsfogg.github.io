import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { Listing } from '../../../shared/property-finder/types.ts';
import { money } from '../data.ts';

const SEATTLE: [number, number] = [47.62, -122.33];

function useDarkMode() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

const pinIcon = (l: Listing, selected: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="pf-pin${l.waterfront ? ' pf-pin--water' : ''}${selected ? ' pf-pin--selected' : ''}">${money(l.price)}</span>`,
    iconSize: undefined,
    iconAnchor: [0, 0],
  });

const clusterIcon = (cluster: L.MarkerCluster) => {
  const markers = cluster.getAllChildMarkers() as (L.Marker & { waterfront?: boolean })[];
  const water = markers.some((m) => m.waterfront);
  return L.divIcon({
    className: '',
    html: `<span class="pf-cluster${water ? ' pf-cluster--water' : ''}">${cluster.getChildCount()}</span>`,
    iconSize: L.point(40, 40),
  });
};

function Pins({ listings, selectedId, onSelect }: { listings: Listing[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const map = useMap();
  const group = useRef<L.MarkerClusterGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const fittedFor = useRef<string>('');
  const bounds = useRef<L.LatLngBounds | null>(null);

  // On phones the map starts hidden (list view). Leaflet measures its size
  // once, so re-measure and re-fit whenever the container changes size.
  useEffect(() => {
    const container = map.getContainer();
    let hidden = !container.clientWidth;
    const observer = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) {
        hidden = true;
        return;
      }
      map.invalidateSize();
      // Only re-fit when coming back from hidden, so resizing the window keeps your pan/zoom.
      if (hidden && bounds.current) map.fitBounds(bounds.current, { padding: [40, 40], maxZoom: 15 });
      hidden = false;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    const g = L.markerClusterGroup({ iconCreateFunction: clusterIcon, showCoverageOnHover: false, maxClusterRadius: 50 });
    group.current = g;
    map.addLayer(g);
    return () => {
      map.removeLayer(g);
      group.current = null;
    };
  }, [map]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.clearLayers();
    markers.current.clear();
    const layers = listings.map((l) => {
      const m = L.marker([l.lat, l.lng], { icon: pinIcon(l, false), title: l.address, keyboard: true }) as L.Marker & { waterfront?: boolean };
      m.waterfront = l.waterfront;
      m.on('click', () => onSelect(l.id));
      markers.current.set(l.id, m);
      return m;
    });
    g.addLayers(layers);

    // Re-fit only when the result set actually changes, not on every render.
    const key = listings.map((l) => l.id).join(',');
    if (listings.length && key !== fittedFor.current) {
      fittedFor.current = key;
      bounds.current = L.latLngBounds(listings.map((l) => [l.lat, l.lng] as [number, number]));
      if (map.getContainer().clientWidth) map.fitBounds(bounds.current, { padding: [40, 40], maxZoom: 15 });
    }
  }, [listings, map, onSelect]);

  useEffect(() => {
    if (!selectedId) return;
    const m = markers.current.get(selectedId);
    const l = listings.find((x) => x.id === selectedId);
    if (!m || !l) return;
    m.setIcon(pinIcon(l, true));
    m.setZIndexOffset(1000);
    group.current?.zoomToShowLayer(m, () => map.panTo(m.getLatLng(), { animate: true }));
    return () => {
      m.setIcon(pinIcon(l, false));
      m.setZIndexOffset(0);
    };
  }, [selectedId, listings, map]);

  return null;
}

export default function MapView(props: { listings: Listing[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const dark = useDarkMode();
  return (
    <MapContainer center={SEATTLE} zoom={11} className="pf-map" zoomControl>
      <TileLayer
        key={dark ? 'dark' : 'light'}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={`https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}{r}.png`}
        subdomains="abcd"
        maxZoom={19}
      />
      <Pins {...props} />
    </MapContainer>
  );
}
