import { useEffect, type ReactNode } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { LatLng } from '../lib/types';
import { REGION_CENTER } from '../data/region';

export const STATUS_COLOR = { active: '#1f8a52', upcoming: '#2a78d6', completed: '#7D8781' } as const;
export const SHELTER_COLOR = '#6d5bd0';
export const DROPOFF_COLOR = '#B57F05';

export function pinIcon(color: string, opts: { size?: number; pulse?: boolean; square?: boolean; selected?: boolean } = {}) {
  const size = (opts.size ?? 16) + (opts.selected ? 6 : 0);
  return L.divIcon({
    className: `nn-pin${opts.square ? ' square' : ''}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px;color:${color}">${
      opts.pulse ? '<div class="nn-pulse"></div>' : ''
    }<span style="position:relative;width:${size}px;height:${size}px;background:${color};${opts.selected ? 'outline:3px solid #11432B;outline-offset:1px;' : ''}"></span></div>`,
  });
}

function FlyTo({ target, zoom }: { target?: LatLng | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], zoom ?? Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [target, zoom, map]);
  return null;
}

function FitBounds({ points }: { points?: LatLng[] }) {
  const map = useMap();
  const key = points?.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (points && points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export function MapBase({ children, height = 520, center = REGION_CENTER, zoom = 11, flyTo, fitTo, className }: { children?: ReactNode; height?: number | string; center?: LatLng; zoom?: number; flyTo?: LatLng | null; fitTo?: LatLng[]; className?: string }) {
  return (
    <div className={className} style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyTo target={flyTo} />
        <FitBounds points={fitTo} />
        {children}
      </MapContainer>
    </div>
  );
}
