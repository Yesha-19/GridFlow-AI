import L from 'leaflet';

/**
 * Primary venue / event marker — animated pulse ring.
 * High-contrast: bright cyan core against the dark tile, white border.
 */
export function createVenueIcon(color = '#4C8DFF') {
  return L.divIcon({
    className: 'venue-pulse-icon',
    html: `
      <span style="position:relative; display:flex; align-items:center; justify-content:center; width:30px; height:30px;">
        <span style="
          position:absolute;
          inset:0;
          border-radius:999px;
          background:${color}33;
          animation: venue-pulse-ring 2.2s cubic-bezier(0.2,0.6,0.4,1) infinite;
        "></span>
        <span style="
          position:relative;
          width:16px;
          height:16px;
          border-radius:999px;
          background:${color};
          border:2.5px solid #ffffff;
          box-shadow:0 0 0 3px ${color}55, 0 2px 8px rgba(0,0,0,0.6);
        "></span>
      </span>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/**
 * Dragging state marker — no pulse, bright orange to signal active drag.
 */
export function createDraggingIcon() {
  return L.divIcon({
    className: 'venue-dragging-icon',
    html: `
      <span style="position:relative; display:flex; align-items:center; justify-content:center; width:34px; height:34px;">
        <span style="
          position:relative;
          width:20px;
          height:20px;
          border-radius:999px;
          background:#FF7A45;
          border:2.5px solid #ffffff;
          box-shadow:0 0 0 3px rgba(255,122,69,0.4), 0 4px 16px rgba(0,0,0,0.7);
          transform: scale(1.15);
          transition: transform 0.15s ease;
        "></span>
      </span>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export function createZoneIcon(color = '#7C8AA8', label = '') {
  return L.divIcon({
    className: 'zone-icon',
    html: `
      <span style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:22px;
        height:22px;
        border-radius:6px;
        background:#0F1729;
        border:1.5px solid ${color};
        color:${color};
        font-family: 'JetBrains Mono', monospace;
        font-size:10px;
        font-weight:600;
      ">
        ${label}
      </span>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}