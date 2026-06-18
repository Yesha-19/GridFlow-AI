import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { UNPLANNED_EVENT_TYPES, PLANNED_EVENT_TYPES  } from '../../utils/constants';
import { createVenueIcon } from '../../utils/mapIcons';

const BENGALURU_VENUES = [
  { name: 'Chinnaswamy Stadium Area', lat: 12.9788, lng: 77.5996 },
  { name: 'Palace Grounds', lat: 13.0070, lng: 77.5725 },
  { name: 'Kanteerava Stadium', lat: 12.9756, lng: 77.5928 },
  { name: 'Freedom Park', lat: 12.9770, lng: 77.5734 },
  { name: 'Lalbagh', lat: 12.9507, lng: 77.5848 },
  { name: 'MG Road', lat: 12.9758, lng: 77.6069 },
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { name: 'Whitefield', lat: 12.9698, lng: 77.7500 },
];

function LocationPicker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });
  return position ? <Marker position={position} icon={createVenueIcon()} /> : null;
}

export default function EventForm({ onSubmit, status }) {
  const [formData, setFormData] = useState({
    eventName: '',
    eventType: 'political_rally',
    isPlanned: true,
    venueName: '',
    expectedAttendance: 1000,
    startTime: '',
    durationHours: 4,
  });

  const [position, setPosition] = useState({
    lat: 12.9716,
    lng: 77.5946,
  });

  function handleVenueSelect(e) {
    const venueName = e.target.value;
    if (!venueName) return;
    
    const venue = BENGALURU_VENUES.find(v => v.name === venueName);
    if (venue) {
      setFormData(prev => ({ ...prev, venueName }));
      setPosition({ lat: venue.lat, lng: venue.lng });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      ...formData,
      latitude: position.lat,
      longitude: position.lng,
      expectedAttendance: Number(formData.expectedAttendance),
      durationHours: Number(formData.durationHours),
      startTime: formData.startTime
        ? new Date(formData.startTime).toISOString()
        : new Date().toISOString(),
    });
  }

  const isSubmitting = status === 'loading';

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col p-5">
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
            onClick={() => setFormData(prev => ({ ...prev, isPlanned: true }))}
          >
            Planned Event
          </button>
          <button
            type="button"
            className={`flex-1 rounded-sm py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              !formData.isPlanned ? 'bg-risk-high text-white' : 'text-console-muted hover:text-console-text'
            }`}
            onClick={() => setFormData(prev => ({ ...prev, isPlanned: false, eventType: 'accident' }))}
          >
            Unplanned Incident
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-console-muted">Event Name</span>
          <input
            type="text"
            required
            className="input"
            value={formData.eventName}
            onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
            placeholder={formData.isPlanned ? "e.g. Election Rally" : "e.g. Multi-vehicle collision"}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-console-muted">Event Type</span>
            <select
              className="input"
              value={formData.eventType}
              onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
            >
              {formData.isPlanned
                ? PLANNED_EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))
                : UNPLANNED_EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-console-muted">
              {formData.isPlanned ? 'Expected Attendance' : 'Estimated Crowd Impact'}
            </span>
            <input
              type="number"
              required
              min="100"
              step="100"
              className="input"
              value={formData.expectedAttendance}
              onChange={(e) => setFormData({ ...formData, expectedAttendance: e.target.value })}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-console-muted">Start Time</span>
            <input
              type="datetime-local"
              required
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
              step="0.5"
              className="input"
              value={formData.durationHours}
              onChange={(e) => setFormData({ ...formData, durationHours: e.target.value })}
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-console-muted">Quick Location (Bengaluru)</span>
          <select className="input" onChange={handleVenueSelect} value={formData.venueName}>
            <option value="">-- Custom location --</option>
            {BENGALURU_VENUES.map(v => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-xs font-medium text-console-muted">
            <span>Location Pin</span>
            <span className="font-mono text-[10px]">
              {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
            </span>
          </span>
          <input
            type="text"
            required
            className="input mb-2"
            value={formData.venueName}
            onChange={(e) => setFormData({ ...formData, venueName: e.target.value })}
            placeholder="Custom venue name"
          />
          <div className="h-[200px] w-full overflow-hidden rounded-md border border-console-border">
            <MapContainer
              center={[12.9716, 77.5946]}
              zoom={11}
              style={{ height: '100%', width: '100%', background: '#070B14' }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <LocationPicker position={position} setPosition={setPosition} />
            </MapContainer>
          </div>
          <p className="text-[10px] text-console-muted text-right">Click map to move pin</p>
        </label>
      </div>

      <div className="mt-6 pt-4 border-t border-console-border">
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
