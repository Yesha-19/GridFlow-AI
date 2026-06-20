import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { UNPLANNED_EVENT_TYPES, PLANNED_EVENT_TYPES, DATASET_LOCATIONS } from '../../utils/constants';
import { createVenueIcon, createDraggingIcon } from '../../utils/mapIcons';
import LocationSearch from '../LocationSearch/LocationSearch';
import LocationInfoCard from '../LocationSearch/LocationInFocard';

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

// ─── MapController: keeps the map view in sync with external position changes ─
function MapController({ position }) {
  const map = useMap();
  const prevPos = useRef(null);

  useEffect(() => {
    if (
      !prevPos.current ||
      prevPos.current.lat !== position.lat ||
      prevPos.current.lng !== position.lng
    ) {
      map.flyTo([position.lat, position.lng], map.getZoom(), {
        animate: true,
        duration: 0.8,
        easeLinearity: 0.35,
      });
      prevPos.current = position;
    }
  }, [position, map]);

  return null;
}

// ─── DraggableMarker ──────────────────────────────────────────────────────────
function DraggableMarker({ position, onDragEnd }) {
  const markerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const eventHandlers = useMemo(
    () => ({
      dragstart() { setIsDragging(true); },
      dragend() {
        setIsDragging(false);
        const marker = markerRef.current;
        if (marker) {
          const { lat, lng } = marker.getLatLng();
          onDragEnd({ lat, lng });
        }
      },
    }),
    [onDragEnd]
  );

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={[position.lat, position.lng]}
      ref={markerRef}
      icon={isDragging ? createDraggingIcon() : createVenueIcon()}
    />
  );
}

// ─── MapClickHandler: clicking the map moves the marker ──────────────────────
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// ─── Main EventForm ───────────────────────────────────────────────────────────
export default function EventForm({ onSubmit, status }) {
  const [formData, setFormData] = useState({
    eventName: '',
    eventType: 'political_rally',
    customEventType: '',
    isPlanned: true,
    venueName: '',
    expectedAttendance: 1000,
    startTime: '',
    durationHours: 4,
  });

  // Unified location state: drives dropdown, marker, coords, and info card
  const [location, setLocation] = useState({
    name: '',
    lat: DEFAULT_CENTER.lat,
    lng: DEFAULT_CENTER.lng,
    address: '',
    source: null, // 'venue' | 'search' | 'drag' | 'click'
  });

  // ── Setters ────────────────────────────────────────────────────────────────

  // Called when dropdown changes
  function handleVenueSelect(e) {
    const venueName = e.target.value;

    if (venueName === 'other') {
      setFormData(prev => ({ ...prev, venueName: 'other' }));
      return;
    }

    if (!venueName) {
      setFormData(prev => ({ ...prev, venueName: '' }));
      return;
    }

    const venue = DATASET_LOCATIONS.find(v => v.name === venueName);
    if (venue) {
      setFormData(prev => ({ ...prev, venueName }));
      setLocation({ name: venue.name, lat: venue.lat, lng: venue.lng, address: `${venue.name}, Bengaluru, Karnataka, India`, source: 'venue' });
    }
  }

  // Called when LocationSearch selects a geocoded result
  function handleSearchSelect({ name, lat, lng, address }) {
    setFormData(prev => ({ ...prev, venueName: 'other' }));
    setLocation({ name, lat, lng, address, source: 'search' });
  }

  // Called when marker is dragged
  const handleDragEnd = useCallback(({ lat, lng }) => {
    setFormData(prev => ({ ...prev, venueName: 'other' }));
    setLocation(prev => ({ ...prev, lat, lng, source: 'drag', name: prev.name || 'Custom Pin' }));

    // Reverse-geocode to get address for dragged position
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
      .then(r => r.json())
      .then(data => {
        const name = data.name || data.display_name?.split(',')[0] || 'Custom Pin';
        setLocation(prev => ({
          ...prev,
          name,
          address: data.display_name || '',
        }));
      })
      .catch(() => {});
  }, []);

  // Called when user clicks the map background
  const handleMapClick = useCallback(({ lat, lng }) => {
    setFormData(prev => ({ ...prev, venueName: 'other' }));
    setLocation(prev => ({ ...prev, lat, lng, source: 'click', name: 'Custom Pin' }));
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault();
    let finalEventType = formData.eventType;
    if (finalEventType === 'others') {
      finalEventType = formData.customEventType.trim() || 'Unspecified Incident';
    }
    onSubmit({
      ...formData,
      eventType: finalEventType,
      venueName: location.name || formData.venueName,
      latitude: location.lat,
      longitude: location.lng,
      expectedAttendance: Math.max(30, Math.round(Number(formData.expectedAttendance) || 30)),
      durationHours: Math.max(0.5, Number(formData.durationHours) || 0.5),
      startTime: formData.startTime
        ? new Date(formData.startTime).toISOString()
        : new Date().toISOString(),
    });
  }

  const isSubmitting = status === 'loading';
  const isOther = formData.venueName === 'other';

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-console-text">
          New Event Forecast
        </h2>
        <span className="font-mono text-[10px] uppercase text-console-muted">
          Input Parameters
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-console">
        {/* Planned / Unplanned Toggle */}
        <div className="flex items-center gap-4 rounded-md border border-console-border bg-console-raised/50 p-1">
          <button
            type="button"
            className={`flex-1 rounded-sm py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              formData.isPlanned ? 'bg-signal text-white' : 'text-console-muted hover:text-console-text'
            }`}
            onClick={() => setFormData(prev => ({ ...prev, isPlanned: true, eventType: PLANNED_EVENT_TYPES[0].value, customEventType: '' }))}
          >
            Planned Event
          </button>
          <button
            type="button"
            className={`flex-1 rounded-sm py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              !formData.isPlanned ? 'bg-risk-high text-white' : 'text-console-muted hover:text-console-text'
            }`}
            onClick={() => setFormData(prev => ({ ...prev, isPlanned: false, eventType: UNPLANNED_EVENT_TYPES[0].value, customEventType: '' }))}
          >
            Unplanned Incident
          </button>
        </div>

        {/* Event Name */}
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-console-muted">Event Name</span>
          <input
            type="text"
            required
            className="input"
            value={formData.eventName}
            onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
            placeholder={formData.isPlanned ? 'e.g. Election Rally' : 'e.g. Multi-vehicle collision'}
          />
        </label>

        {/* Event Type + Attendance */}
        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-console-muted">Event Type</span>
            <select
              className="input"
              value={formData.eventType}
              onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
            >
              {formData.isPlanned
                ? PLANNED_EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))
                : UNPLANNED_EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
              <option value="others">Other (Specify)</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-console-muted">
              {formData.isPlanned ? 'Expected Attendance' : 'Estimated Crowd Impact'}
            </span>
            <input
              type="number"
              required
              min="30"
              className="input"
              value={formData.expectedAttendance}
              onChange={(e) => setFormData({ ...formData, expectedAttendance: e.target.value })}
            />
          </label>
        </div>

        {/* Custom event type */}
        {formData.eventType === 'others' && (
          <label className="block animate-fade-in space-y-1.5 rounded border border-blue-500/50 bg-blue-500/10 p-2">
            <span className="text-xs font-medium text-blue-400">Specify Custom Event Type</span>
            <input
              type="text"
              required
              className="input border-blue-500/50 focus:border-blue-400"
              value={formData.customEventType}
              onChange={(e) => setFormData({ ...formData, customEventType: e.target.value })}
              placeholder="e.g. Pipeline Burst, VIP Convoy"
            />
          </label>
        )}

        {/* Time + Duration */}
        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-console-muted">Start Time</span>
            <input
              type="datetime-local"
              required={formData.isPlanned}
              className="input"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-console-muted">Est. Duration (hrs)</span>
            <input
              type="number"
              required
              min="0.5"
              step="any"
              className="input"
              value={formData.durationHours}
              onChange={(e) => setFormData({ ...formData, durationHours: e.target.value })}
            />
          </label>
        </div>

        {/* ── Location Selection Section ──────────────────────────────────── */}
        <div className="rounded-md border border-console-border bg-console-raised/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-console-muted">
              Location
            </span>
            {location.lat && location.lng && (
              <span className="font-mono text-[10px] text-console-muted/70">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
            )}
          </div>

         

          {/* 2. Quick-select dropdown */}
          <div className="space-y-1">
            <span className="text-[10px] text-console-muted">Or pick a known venue</span>
            <select
              className="input text-xs"
              onChange={handleVenueSelect}
              value={formData.venueName}
            >
              <option value="">— Select venue —</option>
              {DATASET_LOCATIONS.map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
              <option value="other">Other Location…</option>
            </select>
          </div>

          {/* 3. "Other Location" expanded search */}
          {isOther && (
            <div className="rounded border border-signal/30 bg-signal/5 p-2 space-y-1.5">
              <p className="text-[10px] font-medium text-signal">Search any address or place</p>
              <LocationSearch onSelect={handleSearchSelect} selectedName={location.name} />
              {location.source === 'search' && (
                <p className="text-[10px] text-console-muted">
                  ✓ {location.name}
                </p>
              )}
            </div>
          )}

          {/* 4. Map */}
          <div className="space-y-1">
            <div className="overflow-hidden rounded-md border border-console-border shadow-inner" style={{ height: 220 }}>
              <MapContainer
  center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
  zoom={12}
  style={{ height: '100%', width: '100%' }}
  zoomControl={false}
  attributionControl={false}
>
  {/* The correct, single CartoDB layer that includes dark roads AND high-contrast text */}
  <TileLayer
    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>"
    subdomains="abcd"
    maxZoom={19}
  />
  <MapController position={{ lat: location.lat, lng: location.lng }} />
  <MapClickHandler onMapClick={handleMapClick} />
  <DraggableMarker
    position={{ lat: location.lat, lng: location.lng }}
    onDragEnd={handleDragEnd}
  />
</MapContainer>
            </div>
            <p className="text-[10px] text-console-muted text-right">
              Drag marker or click map to set exact location
            </p>
          </div>

          {/* 5. Location info card */}
          <LocationInfoCard
            name={location.name}
            lat={location.lat}
            lng={location.lng}
            address={location.address}
          />
        </div>
      </div>

      {/* Submit */}
      <div className="mt-6 border-t border-console-border pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded-md bg-signal py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              RUNNING FORECAST...
            </span>
          ) : (
            'GENERATE PREDICTION'
          )}
        </button>
      </div>
    </form>
  );
}