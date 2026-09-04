import React, { useState, useRef, useEffect } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  Columns, 
  Crosshair
} from 'lucide-react';

export default function ImageViewer({
  activeScene,
  analysisData,
  changeData,
  overlays,
  analysisMode
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Transform / Zoom / Pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Curtain slider for bi-temporal split view (0 to 100%)
  const [splitCurtainPos, setSplitCurtainPos] = useState(50);
  const [isCurtainActive, setIsCurtainActive] = useState(false);

  // Cursor coordinate tracking
  const [cursorGeo, setCursorGeo] = useState(null);

  // Active images
  const mainImageUrl = activeScene?.dataUrl || activeScene?.images?.main || activeScene?.images?.post || activeScene?.images?.pre;
  const preImageUrl = activeScene?.images?.pre || null;
  const hasBiTemporal = Boolean(preImageUrl && mainImageUrl && preImageUrl !== mainImageUrl);

  // Reset to fit on scene change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    if (analysisMode === 'change' && hasBiTemporal) {
      setIsCurtainActive(true);
    } else {
      setIsCurtainActive(false);
    }
  }, [activeScene?.id, activeScene?.dataUrl, analysisMode, hasBiTemporal]);

  const handleZoom = (delta) => {
    setScale(prevScale => {
      const newScale = Math.min(8, Math.max(0.2, prevScale + delta));
      return Number(newScale.toFixed(2));
    });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    handleZoom(delta);
  };

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.closest('.viewer-controls')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left - (rect.width / 2) - position.x;
      const clickY = e.clientY - rect.top - (rect.height / 2) - position.y;

      const imgW = analysisData?.width || activeScene?.metadata?.width || 800;
      const imgH = analysisData?.height || activeScene?.metadata?.height || 600;

      const renderW = imgW * scale;
      const renderH = imgH * scale;

      const pixelX = Math.floor((clickX + renderW / 2) / scale);
      const pixelY = Math.floor((clickY + renderH / 2) / scale);

      if (pixelX >= 0 && pixelX < imgW && pixelY >= 0 && pixelY < imgH) {
        const meta = activeScene?.metadata;
        let lat = null, lon = null;
        if (meta?.bounds && meta?.crs && !meta.crs.includes('unavailable')) {
          const b = meta.bounds;
          const minLat = b.min_lat ?? b.minY;
          const maxLat = b.max_lat ?? b.maxY;
          const minLon = b.min_lon ?? b.minX;
          const maxLon = b.max_lon ?? b.maxX;
          lat = (maxLat - (pixelY / imgH) * (maxLat - minLat)).toFixed(5);
          lon = (minLon + (pixelX / imgW) * (maxLon - minLon)).toFixed(5);
        }
        setCursorGeo({ px: pixelX, py: pixelY, lat, lon });
      } else {
        setCursorGeo(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleFitToScreen = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Render Overlays onto Overlay Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysisData) return;

    const w = analysisData.width;
    const h = analysisData.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    // 1. Draw LULC Mask Overlay if active
    if (overlays.showLulcMask && analysisData.lulc?.maskCanvas) {
      ctx.globalAlpha = overlays.opacity;
      ctx.drawImage(analysisData.lulc.maskCanvas, 0, 0, w, h);
      ctx.globalAlpha = 1.0;
    }

    // 2. Draw Change Heatmap Overlay if active
    if (overlays.showChangeHeatmap && changeData?.changeCanvas) {
      ctx.globalAlpha = overlays.opacity;
      ctx.drawImage(changeData.changeCanvas, 0, 0, w, h);
      ctx.globalAlpha = 1.0;
    }

    // 3. Draw Bounding Boxes if active
    if (overlays.showBoundingBoxes && analysisData.objects?.objects) {
      const objs = analysisData.objects.objects;
      objs.forEach((box) => {
        const isShip = box.label.includes('Vessel') || box.label.includes('Ship');
        const isBldg = box.label.includes('Building');
        const color = isShip ? '#0ea5e9' : isBldg ? '#f43f5e' : '#f59e0b';

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        ctx.fillStyle = isShip ? 'rgba(14, 165, 233, 0.12)' : 'rgba(244, 63, 94, 0.12)';
        ctx.fillRect(box.x, box.y, box.width, box.height);

        const labelText = `${box.label.split('/')[0]} ${Math.round(box.confidence * 100)}%`;
        ctx.font = '500 10.5px JetBrains Mono, monospace';
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = color;
        ctx.fillRect(box.x, Math.max(0, box.y - 16), textWidth + 6, 16);

        ctx.fillStyle = '#0f172a';
        ctx.fillText(labelText, box.x + 3, Math.max(12, box.y - 4));
      });
    }
  }, [analysisData, changeData, overlays]);

  return (
    <main
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        flex: 1,
        position: 'relative',
        background: '#080c16',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none'
      }}
    >
      {/* Subtle Map Grid Lines */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(to right, rgba(30, 41, 59, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(30, 41, 59, 0.2) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none'
        }}
      />

      {/* Main Satellite Canvas Wrapper */}
      <div
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.06s ease-out',
          position: 'relative',
          display: 'inline-block',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
          border: '1px solid #1e293b'
        }}
      >
        {isCurtainActive && hasBiTemporal ? (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <img
              src={mainImageUrl}
              alt="Post Scene"
              style={{ display: 'block', maxWidth: '920px', maxHeight: '740px', objectFit: 'contain' }}
              draggable={false}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${splitCurtainPos}%`,
                overflow: 'hidden',
                borderRight: '2px solid #0284c7'
              }}
            >
              <img
                src={preImageUrl}
                alt="Pre Scene"
                style={{ display: 'block', maxWidth: '920px', maxHeight: '740px', objectFit: 'contain' }}
                draggable={false}
              />
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <img
              src={mainImageUrl}
              alt={activeScene?.name || 'Satellite Scene'}
              style={{
                display: 'block',
                maxWidth: '920px',
                maxHeight: '740px',
                objectFit: 'contain'
              }}
              draggable={false}
            />
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* Floating Zoom & Tool Controls (Top Right) */}
      <div className="viewer-controls" style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(15, 23, 42, 0.9)',
        padding: '3px 4px',
        borderRadius: '5px',
        border: '1px solid #334155',
        zIndex: 20
      }}>
        {hasBiTemporal && (
          <button
            onClick={() => setIsCurtainActive(!isCurtainActive)}
            title="Toggle Split Comparison Slider"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              background: isCurtainActive ? '#0284c7' : '#1e293b',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Columns size={12} />
            <span>{isCurtainActive ? 'Curtain ON' : 'Compare'}</span>
          </button>
        )}

        <button
          onClick={() => handleZoom(0.2)}
          title="Zoom In"
          style={{ width: '28px', height: '28px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => handleZoom(-0.2)}
          title="Zoom Out"
          style={{ width: '28px', height: '28px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleFitToScreen}
          title="Fit to Screen"
          style={{ width: '28px', height: '28px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={handleReset}
          title="Reset View"
          style={{ width: '28px', height: '28px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Split Comparison Slider Bar when Curtain Active */}
      {isCurtainActive && hasBiTemporal && (
        <div className="viewer-controls" style={{
          position: 'absolute',
          top: '52px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.92)',
          padding: '5px 12px',
          borderRadius: '4px',
          border: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 20
        }}>
          <span style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: 600 }}>T1 (Pre)</span>
          <input
            type="range"
            min="0"
            max="100"
            value={splitCurtainPos}
            onChange={(e) => setSplitCurtainPos(Number(e.target.value))}
            style={{ width: '120px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '10.5px', color: '#f43f5e', fontWeight: 600 }}>T2 (Post)</span>
        </div>
      )}

      {/* Live Coordinate Inspector HUD (Bottom Left) */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '5px 10px',
        borderRadius: '4px',
        background: 'rgba(15, 23, 42, 0.88)',
        border: '1px solid #1e293b',
        fontSize: '11px',
        color: '#94a3b8',
        zIndex: 20
      }}>
        <Crosshair size={12} color="#0284c7" />
        {cursorGeo ? (
          <div style={{ display: 'flex', gap: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
            <span>Pixel: <strong style={{ color: '#f1f5f9' }}>{cursorGeo.px}, {cursorGeo.py}</strong></span>
            {cursorGeo.lat && cursorGeo.lon ? (
              <span>Coords: <strong style={{ color: '#34d399' }}>{cursorGeo.lat}° N, {cursorGeo.lon}° E</strong></span>
            ) : (
              <span style={{ color: '#64748b' }}>(Uncalibrated Raster)</span>
            )}
          </div>
        ) : (
          <span>Move cursor over scene for coordinate telemetry</span>
        )}
        <span style={{ color: '#334155' }}>|</span>
        <span>Zoom: <strong style={{ color: '#38bdf8' }}>{Math.round(scale * 100)}%</strong></span>
      </div>
    </main>
  );
}
