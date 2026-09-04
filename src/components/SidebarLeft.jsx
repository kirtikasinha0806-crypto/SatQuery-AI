import React, { useState } from 'react';
import { 
  Satellite, 
  Layers, 
  Upload, 
  Crosshair, 
  PieChart, 
  GitCompare, 
  FileText, 
  Calendar, 
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FolderOpen
} from 'lucide-react';

export default function SidebarLeft({
  scenarios = [],
  activeScenarioId,
  onSelectScenario,
  activeScene,
  onUploadSingle,
  onUploadPair,
  analysisMode,
  setAnalysisMode,
  overlays,
  setOverlays,
  isAnalyzing,
  onResetSession
}) {
  const [uploadType, setUploadType] = useState('single'); // 'single' | 'pair'
  const [dragActive, setDragActive] = useState(false);

  const handleSingleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) onUploadSingle(file);
  };

  const handlePairFileInput = (e, type) => {
    const file = e.target.files?.[0];
    if (file) onUploadPair(file, type);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadSingle(e.dataTransfer.files[0]);
    }
  };

  const meta = activeScene?.metadata || {};
  const hasGeo = Boolean(meta.hasGeoMetadata || (meta.bounds && meta.crs && !meta.crs.includes('unavailable')));

  return (
    <aside style={{
      width: '280px',
      minWidth: '280px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRight: '1px solid #1e293b',
      background: '#0d1527',
      userSelect: 'none'
    }}>
      {/* 1. Header & ISRO Space Tech Branding */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid #1e293b',
        background: '#0b1120',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <Satellite size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#f8fafc', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              SatQuery AI
              <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid rgba(2, 132, 199, 0.3)', fontWeight: 600 }}>
                ISRO EO
              </span>
            </div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>Vision-Language RS Workspace</div>
          </div>
        </div>

        {onResetSession && (
          <button
            onClick={onResetSession}
            title="Reset Session (Clear conversation & scene)"
            style={{
              padding: '4px 7px',
              borderRadius: '4px',
              border: '1px solid #334155',
              background: '#141f36',
              color: '#94a3b8',
              fontSize: '10.5px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Main Scrollable Settings Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* 2. Mission Scenario Selection */}
        <div>
          <label style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            Mission Scenario
          </label>
          <select
            value={activeScenarioId || ''}
            onChange={(e) => onSelectScenario(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 9px',
              borderRadius: '5px',
              background: '#141f36',
              border: '1px solid #334155',
              color: '#f8fafc',
              fontSize: '11.5px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            {!activeScenarioId && <option value="">Custom Uploaded Imagery</option>}
          </select>
        </div>

        {/* 3. Active Scene Metadata Box */}
        <div style={{
          padding: '10px',
          borderRadius: '6px',
          background: '#111827',
          border: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1f293d', paddingBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>Active Scene Info</span>
            {hasGeo ? (
              <span style={{ fontSize: '9.5px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <CheckCircle2 size={10} /> Georeferenced
              </span>
            ) : (
              <span style={{ fontSize: '9.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <AlertCircle size={10} /> Uncalibrated
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', rowGap: '4px', fontSize: '11px' }}>
            <span style={{ color: '#64748b' }}>Region:</span>
            <span style={{ color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeScene?.region || 'Custom AOI'}
            </span>

            <span style={{ color: '#64748b' }}>Sensor:</span>
            <span style={{ color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {meta.sensor || 'Optical Earth Observation'}
            </span>

            <span style={{ color: '#64748b' }}>Resolution:</span>
            <span style={{ color: '#38bdf8', fontWeight: 500 }}>
              {meta.resolution || '10m GSD'}
            </span>

            <span style={{ color: '#64748b' }}>Date:</span>
            <span style={{ color: '#cbd5e1' }}>
              {meta.date || meta.date_post || 'Archived'}
            </span>
          </div>
        </div>

        {/* 4. Upload Image / GeoTIFF */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>
              Upload Image / GeoTIFF
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setUploadType('single')}
                style={{
                  fontSize: '9.5px', padding: '2px 6px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                  background: uploadType === 'single' ? '#0284c7' : '#1e293b',
                  color: uploadType === 'single' ? '#ffffff' : '#94a3b8'
                }}
              >
                Single
              </button>
              <button
                onClick={() => setUploadType('pair')}
                style={{
                  fontSize: '9.5px', padding: '2px 6px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                  background: uploadType === 'pair' ? '#0284c7' : '#1e293b',
                  color: uploadType === 'pair' ? '#ffffff' : '#94a3b8'
                }}
              >
                Dual Pair
              </button>
            </div>
          </div>

          {uploadType === 'single' ? (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 10px',
                borderRadius: '6px',
                border: dragActive ? '1px dashed #0284c7' : '1px dashed #334155',
                background: dragActive ? 'rgba(2, 132, 199, 0.08)' : '#141f36',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'border-color 0.15s'
              }}
            >
              <Upload size={18} color="#0284c7" style={{ marginBottom: '4px' }} />
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#f1f5f9' }}>Select or drop file</span>
              <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>PNG, JPG, or GeoTIFF (.tif)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/tiff,.tif,.tiff"
                onChange={handleSingleFileInput}
                style={{ display: 'none' }}
              />
            </label>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '5px', border: '1px dashed #334155', background: '#141f36', cursor: 'pointer' }}>
                <Calendar size={14} color="#0ea5e9" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#f1f5f9' }}>Pre-Event (T1)</div>
                  <div style={{ fontSize: '9.5px', color: '#64748b' }}>Select baseline image</div>
                </div>
                <input type="file" accept="image/png,image/jpeg,image/tiff,.tif,.tiff" onChange={(e) => handlePairFileInput(e, 'pre')} style={{ display: 'none' }} />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '5px', border: '1px dashed #334155', background: '#141f36', cursor: 'pointer' }}>
                <Calendar size={14} color="#f43f5e" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#f1f5f9' }}>Post-Event (T2)</div>
                  <div style={{ fontSize: '9.5px', color: '#64748b' }}>Select follow-up image</div>
                </div>
                <input type="file" accept="image/png,image/jpeg,image/tiff,.tif,.tiff" onChange={(e) => handlePairFileInput(e, 'post')} style={{ display: 'none' }} />
              </label>
            </div>
          )}
        </div>

        {/* 5. Analysis Task Mode */}
        <div>
          <label style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            Analysis Task Mode
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[
              { id: 'general', name: 'General Summary', icon: Sparkles },
              { id: 'objects', name: 'Object Counting', icon: Crosshair },
              { id: 'lulc', name: 'LULC Classification', icon: PieChart },
              { id: 'change', name: 'Change Detection', icon: GitCompare }
            ].map((mode) => {
              const Icon = mode.icon;
              const isCur = analysisMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setAnalysisMode(mode.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 10px',
                    borderRadius: '5px',
                    border: isCur ? '1px solid #0284c7' : '1px solid #1e293b',
                    background: isCur ? '#1e2d4a' : '#111827',
                    color: isCur ? '#38bdf8' : '#cbd5e1',
                    fontSize: '11.5px',
                    fontWeight: isCur ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s ease'
                  }}
                >
                  <Icon size={14} color={isCur ? '#38bdf8' : '#64748b'} />
                  <span>{mode.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. Visual Overlays */}
        <div>
          <label style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            Visual Overlays
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#111827', padding: '8px 10px', borderRadius: '6px', border: '1px solid #1e293b' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer' }}>
              <span>Bounding Boxes</span>
              <input
                type="checkbox"
                checked={overlays.showBoundingBoxes}
                onChange={(e) => setOverlays(o => ({ ...o, showBoundingBoxes: e.target.checked }))}
                style={{ cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer' }}>
              <span>Segmentation / Masks</span>
              <input
                type="checkbox"
                checked={overlays.showLulcMask}
                onChange={(e) => setOverlays(o => ({ ...o, showLulcMask: e.target.checked }))}
                style={{ cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#cbd5e1', cursor: 'pointer' }}>
              <span>Change Overlay</span>
              <input
                type="checkbox"
                checked={overlays.showChangeHeatmap}
                onChange={(e) => setOverlays(o => ({ ...o, showChangeHeatmap: e.target.checked }))}
                style={{ cursor: 'pointer' }}
              />
            </label>

            {/* Opacity slider */}
            <div style={{ marginTop: '4px', borderTop: '1px solid #1f293d', paddingTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginBottom: '3px' }}>
                <span>Overlay Opacity</span>
                <span style={{ color: '#38bdf8' }}>{Math.round(overlays.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={overlays.opacity}
                onChange={(e) => setOverlays(o => ({ ...o, opacity: parseFloat(e.target.value) }))}
                style={{ width: '100%', height: '4px', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
}
