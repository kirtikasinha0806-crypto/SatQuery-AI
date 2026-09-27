import React from 'react';
import { 
  Compass, 
  MapPin, 
  Layers, 
  Maximize, 
  ShieldCheck, 
  AlertCircle,
  Database,
  Calendar
} from 'lucide-react';

export default function BottomTelemetry({
  activeScene,
  analysisData,
  isAnalyzing
}) {
  const meta = activeScene?.metadata || {};
  const hasGeo = Boolean(meta.hasGeoMetadata || (meta.bounds && meta.crs && !meta.crs.includes('unavailable')));

  const imgW = analysisData?.width || meta.width || '—';
  const imgH = analysisData?.height || meta.height || '—';
  const bands = meta.bands || 3;
  const resolution = meta.resolution || (hasGeo ? '10m GSD' : 'Uncalibrated');
  const dateStr = meta.date || meta.date_post || meta.date_pre || 'Archive';

  return (
    <footer style={{
      height: '36px',
      minHeight: '36px',
      borderTop: '1px solid #1e293b',
      background: '#0b1120',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 14px',
      fontSize: '11px',
      color: '#94a3b8',
      zIndex: 10,
      userSelect: 'none'
    }}>
      {/* Left Segment: Source, CRS, Coordinates */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Database size={12} color="#0284c7" />
          <span>Source: <strong style={{ color: '#e2e8f0' }}>{activeScene?.id || 'Active Scene'}</strong></span>
        </div>

        <div style={{ width: '1px', height: '12px', background: '#1e293b' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Compass size={12} color="#0ea5e9" />
          <span>CRS: <strong style={{ color: hasGeo ? '#34d399' : '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
            {hasGeo ? meta.crs : 'Location metadata unavailable'}
          </strong></span>
        </div>

        <div style={{ width: '1px', height: '12px', background: '#1e293b' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <MapPin size={12} color="#a855f7" />
          <span>Coords: <strong style={{ color: hasGeo ? '#f1f5f9' : '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
            {hasGeo && meta.center ? `${meta.center.lat}° N, ${meta.center.lon}° E` : 'Unavailable'}
          </strong></span>
        </div>
      </div>

      {/* Right Segment: Dimensions, Bands, Resolution, Date, Verification Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Maximize size={11} color="#94a3b8" />
          <span>Dimensions: <strong style={{ color: '#cbd5e1' }}>{imgW} × {imgH} px</strong></span>
        </div>

        <div style={{ width: '1px', height: '12px', background: '#1e293b' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Layers size={11} color="#94a3b8" />
          <span>Bands: <strong style={{ color: '#cbd5e1' }}>{bands} (RGB)</strong></span>
        </div>

        <div style={{ width: '1px', height: '12px', background: '#1e293b' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>GSD: <strong style={{ color: '#38bdf8' }}>{resolution}</strong></span>
        </div>

        <div style={{ width: '1px', height: '12px', background: '#1e293b' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Calendar size={11} color="#94a3b8" />
          <span>Acquired: <strong style={{ color: '#cbd5e1' }}>{dateStr}</strong></span>
        </div>

        <div style={{ width: '1px', height: '12px', background: '#1e293b' }} />

        {hasGeo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '10px', fontWeight: 600 }}>
            <ShieldCheck size={11} /> Verified Georeference
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(148, 163, 184, 0.08)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.2)', fontSize: '10px' }}>
            <AlertCircle size={11} /> Location metadata unavailable
          </div>
        )}
      </div>
    </footer>
  );
}
