import React from 'react';
import { MapPin, Navigation } from 'lucide-react';

/**
 * LocationInfoCard
 * Displayed below the map when a location is selected.
 * Shows location name, coordinates, and address.
 */
export default function LocationInfoCard({ name, lat, lng, address }) {
  if (!name && !lat) return null;

  const displayName = name || 'Custom Pin';
  const shortAddress = address
    ? address.split(',').slice(0, 4).join(', ')
    : null;

  return (
    <div className="mt-2 rounded-md border border-signal/25 bg-signal/5 p-3 transition-all">
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5">
        <MapPin size={12} className="shrink-0 text-signal" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-signal">
          Location Selected
        </span>
      </div>

      {/* Name */}
      <p className="mb-1.5 text-sm font-semibold text-console-text leading-snug">
        {displayName}
        {displayName.toLowerCase().includes('bengaluru') ||
        displayName.toLowerCase().includes('bangalore') ? null : (
          <span className="text-console-muted font-normal">, Bengaluru</span>
        )}
      </p>

      {/* Coords row */}
      <div className="mb-1.5 flex items-center gap-3">
        <div className="flex items-center gap-1 rounded bg-console-raised px-2 py-0.5">
          <Navigation size={10} className="text-console-muted" />
          <span className="font-mono text-[10px] text-console-muted">
            {lat?.toFixed(6)}
          </span>
        </div>
        <div className="flex items-center gap-1 rounded bg-console-raised px-2 py-0.5">
          <Navigation size={10} className="rotate-90 text-console-muted" />
          <span className="font-mono text-[10px] text-console-muted">
            {lng?.toFixed(6)}
          </span>
        </div>
      </div>

      {/* Address */}
      {shortAddress && (
        <p className="text-[10px] leading-relaxed text-console-muted">
          {shortAddress}
        </p>
      )}
    </div>
  );
}