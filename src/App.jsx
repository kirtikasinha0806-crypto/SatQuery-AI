import React, { useState, useEffect, useCallback } from 'react';
import SidebarLeft from './components/SidebarLeft';
import ImageViewer from './components/ImageViewer';
import AssistantChat from './components/AssistantChat';
import BottomTelemetry from './components/BottomTelemetry';
import { parseGeoTIFF } from './services/geotiffParser';
import { 
  getImageDataFromElement, 
  computeRgbAndSpectralStats, 
  classifyLULC, 
  detectObjects, 
  detectBiTemporalChange 
} from './services/remoteSensingEngine';
import { queryVisionLanguageAssistant } from './services/vlmProvider';

export default function App() {
  // Scenarios and Active Scene State
  const [scenarios, setScenarios] = useState([]);
  const [activeScenarioId, setActiveScenarioId] = useState('assam_flood');
  const [activeScene, setActiveScene] = useState(null);

  // Analysis task mode & visual overlays
  const [analysisMode, setAnalysisMode] = useState('general'); // 'general' | 'objects' | 'lulc' | 'change'
  const [overlays, setOverlays] = useState({
    showBoundingBoxes: true,
    showLulcMask: false,
    showChangeHeatmap: false,
    opacity: 0.65
  });

  // Computed Analysis Results State
  const [analysisData, setAnalysisData] = useState(null);
  const [changeData, setChangeData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Chat conversation state
  const [messages, setMessages] = useState([]);
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);

  // VLM Provider Config
  const [providerConfig, setProviderConfig] = useState(() => {
    const saved = localStorage.getItem('satquery_vlm_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      provider: 'local_fallback',
      apiKey: '',
      endpoint: '',
      modelName: ''
    };
  });

  useEffect(() => {
    localStorage.setItem('satquery_vlm_config', JSON.stringify(providerConfig));
  }, [providerConfig]);

  // Load Scenario Manifest on Mount
  useEffect(() => {
    fetch('/data/scenarios/manifest.json')
      .then(res => res.json())
      .then(data => {
        setScenarios(data);
        if (data.length > 0) {
          loadScenario(data[0]);
        }
      })
      .catch(err => {
        console.error('Failed to load scenarios manifest:', err);
      });
  }, []);

  // Switch Active Scenario
  const handleSelectScenario = (scenarioId) => {
    const found = scenarios.find(s => s.id === scenarioId);
    if (found) {
      setActiveScenarioId(scenarioId);
      loadScenario(found);
    }
  };

  const loadScenario = (sc) => {
    const mainImg = sc.images?.main || sc.images?.post || sc.images?.pre;
    const sceneObj = {
      id: sc.id,
      name: sc.name,
      region: sc.region,
      description: sc.description,
      images: sc.images,
      dataUrl: mainImg,
      metadata: {
        hasGeoMetadata: true,
        sensor: sc.sensor,
        resolution: sc.resolution,
        crs: sc.crs,
        bounds: sc.bounds,
        center: sc.center,
        date: sc.date || sc.date_post,
        date_pre: sc.date_pre,
        date_post: sc.date_post,
        bands: 3
      }
    };
    setActiveScene(sceneObj);
  };

  // Run Remote Sensing Analysis Pipeline on Active Scene
  const runAnalysisPipeline = useCallback(async (scene) => {
    if (!scene) return;
    setIsAnalyzing(true);

    try {
      const mainImgSrc = scene.dataUrl || scene.images?.main || scene.images?.post;
      const preImgSrc = scene.images?.pre;

      // Load main image into an HTMLImageElement
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = mainImgSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const { imageData, width, height, canvas } = getImageDataFromElement(img);

      // 1. RGB & Spectral Indices
      const stats = computeRgbAndSpectralStats(imageData);

      // 2. LULC Segmentation
      const gsd = parseFloat(scene.metadata?.resolution) || 10;
      const lulc = classifyLULC(imageData, gsd);

      // 3. Object / Target Detection
      const objects = detectObjects(imageData, { targetType: 'all' });

      const currentAnalysis = {
        width,
        height,
        stats,
        lulc,
        objects,
        mainCanvas: canvas
      };
      setAnalysisData(currentAnalysis);

      // 4. Bi-Temporal Change Detection if pre-image is available
      if (preImgSrc && preImgSrc !== mainImgSrc) {
        try {
          const preImg = new Image();
          preImg.crossOrigin = 'anonymous';
          preImg.src = preImgSrc;
          await new Promise((res, rej) => { preImg.onload = res; preImg.onerror = rej; });

          const preExtract = getImageDataFromElement(preImg, width, height);
          const cResult = detectBiTemporalChange(preExtract.imageData, imageData, gsd);
          setChangeData(cResult);
        } catch (e) {
          console.warn('Bi-temporal change analysis skipped:', e);
          setChangeData(null);
        }
      } else {
        setChangeData(null);
      }

      // Initial Assistant greeting for the newly loaded scene
      const initialQuery = 'Overview summary of this scene';
      const initialRes = await queryVisionLanguageAssistant({
        query: initialQuery,
        activeScene: scene,
        analysisData: currentAnalysis,
        changeData: null,
        activeMode: 'general',
        providerConfig
      });

      setMessages([
        {
          role: 'assistant',
          content: initialRes.rawResponse,
          structured: initialRes,
          systemNote: initialRes.systemNote
        }
      ]);

    } catch (err) {
      console.error('Analysis pipeline error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ **Invalid or Corrupted File**: Could not decode the uploaded file as a valid image raster. Please ensure the file is an uncorrupted PNG, JPEG, or GeoTIFF (.tif) satellite image.',
          structured: {
            confirmedMetadata: '• Error: Unsupported or corrupted raster payload',
            computedAnalysis: '• Pixel analysis aborted due to decoding failure.',
            aiVisualInterpretation: '• Image data unreadable.',
            uncertainNotAvailable: '• File could not be loaded into memory.'
          }
        }
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  }, [providerConfig]);

  // Session Reset Handler
  const handleResetSession = () => {
    if (scenarios.length > 0) {
      setActiveScenarioId(scenarios[0].id);
      loadScenario(scenarios[0]);
    }
    setAnalysisMode('general');
    setOverlays({
      showBoundingBoxes: true,
      showLulcMask: false,
      showChangeHeatmap: false,
      opacity: 0.65
    });
    setChangeData(null);
    setMessages([]);
  };

  useEffect(() => {
    if (activeScene) {
      runAnalysisPipeline(activeScene);
    }
  }, [activeScene?.id, activeScene?.dataUrl]);

  // Adjust overlay visibility depending on analysis task mode
  useEffect(() => {
    if (analysisMode === 'objects') {
      setOverlays(o => ({ ...o, showBoundingBoxes: true, showLulcMask: false, showChangeHeatmap: false }));
    } else if (analysisMode === 'lulc') {
      setOverlays(o => ({ ...o, showBoundingBoxes: false, showLulcMask: true, showChangeHeatmap: false }));
    } else if (analysisMode === 'change') {
      setOverlays(o => ({ ...o, showBoundingBoxes: false, showLulcMask: false, showChangeHeatmap: true }));
    }
  }, [analysisMode]);

  // Handle Single Image / GeoTIFF Upload
  const handleUploadSingle = async (file) => {
    setIsAnalyzing(true);
    const isGeoTiff = file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');

    if (isGeoTiff) {
      try {
        const parsedTiff = await parseGeoTIFF(file);
        if (parsedTiff.success) {
          const newScene = {
            id: `upload_${Date.now()}`,
            name: file.name,
            region: parsedTiff.hasGeoMetadata ? 'Geo-Referenced Scene' : 'Uploaded Scene',
            description: `User-uploaded GeoTIFF: ${file.name}`,
            dataUrl: parsedTiff.dataUrl,
            images: { main: parsedTiff.dataUrl },
            metadata: {
              hasGeoMetadata: parsedTiff.hasGeoMetadata,
              sensor: 'GeoTIFF Earth Observation Raster',
              resolution: parsedTiff.resolution,
              crs: parsedTiff.crs,
              bounds: parsedTiff.bounds,
              center: parsedTiff.center,
              width: parsedTiff.width,
              height: parsedTiff.height,
              bands: parsedTiff.bands
            }
          };
          setActiveScenarioId(null);
          setActiveScene(newScene);
          return;
        }
      } catch (e) {
        console.error('GeoTIFF upload error:', e);
      }
    }

    // Standard PNG/JPG upload
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const newScene = {
        id: `upload_${Date.now()}`,
        name: file.name,
        region: 'Uploaded Raster',
        description: `User-uploaded optical imagery: ${file.name}`,
        dataUrl,
        images: { main: dataUrl },
        metadata: {
          hasGeoMetadata: false,
          sensor: 'Standard Optical Raster (RGB)',
          resolution: 'Uncalibrated',
          crs: 'Location metadata unavailable',
          bounds: null,
          center: null,
          bands: 3
        }
      };
      setActiveScenarioId(null);
      setActiveScene(newScene);
    };
    reader.readAsDataURL(file);
  };

  // Handle Bi-Temporal Pair Upload
  const handleUploadPair = (file, type) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setActiveScene(prev => {
        const prevImages = prev?.images || {};
        const updatedImages = { ...prevImages, [type]: dataUrl };
        if (type === 'post') updatedImages.main = dataUrl;

        return {
          id: `bitemporal_${Date.now()}`,
          name: `Bi-Temporal Pair (${file.name})`,
          region: prev?.region || 'Custom Temporal AOI',
          description: 'User-uploaded bi-temporal satellite pair for change detection.',
          dataUrl: updatedImages.main || dataUrl,
          images: updatedImages,
          metadata: {
            hasGeoMetadata: false,
            sensor: 'Bi-Temporal Optical Ingestion',
            resolution: '10m (Estimated)',
            crs: 'Location metadata unavailable',
            bounds: null,
            center: null,
            bands: 3
          }
        };
      });
      setAnalysisMode('change');
    };
    reader.readAsDataURL(file);
  };

  // Handle User Chat Queries
  const handleSendMessage = async (queryText) => {
    const userMsg = { role: 'user', content: queryText };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessingQuery(true);

    try {
      const response = await queryVisionLanguageAssistant({
        query: queryText,
        activeScene,
        analysisData,
        changeData,
        activeMode: analysisMode,
        providerConfig,
        history: messages
      });

      const assistantMsg = {
        role: 'assistant',
        content: response.rawResponse,
        structured: response,
        systemNote: response.systemNote
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Query processing error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Error processing query: ${err.message}`
        }
      ]);
    } finally {
      setIsProcessingQuery(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#070a13' }}>
      {/* Top Main Workspace (3-Column Layout) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <SidebarLeft
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          onSelectScenario={handleSelectScenario}
          activeScene={activeScene}
          onUploadSingle={handleUploadSingle}
          onUploadPair={handleUploadPair}
          analysisMode={analysisMode}
          setAnalysisMode={setAnalysisMode}
          overlays={overlays}
          setOverlays={setOverlays}
          isAnalyzing={isAnalyzing}
          onResetSession={handleResetSession}
        />

        {/* Center Satellite Canvas Viewer */}
        <ImageViewer
          activeScene={activeScene}
          analysisData={analysisData}
          changeData={changeData}
          overlays={overlays}
          analysisMode={analysisMode}
        />

        {/* Right Vision-Language Assistant */}
        <AssistantChat
          messages={messages}
          onSendMessage={handleSendMessage}
          isProcessing={isProcessingQuery || isAnalyzing}
          providerConfig={providerConfig}
          setProviderConfig={setProviderConfig}
          activeScene={activeScene}
          analysisData={analysisData}
          changeData={changeData}
          onResetSession={handleResetSession}
        />
      </div>

      {/* Bottom Compact Geospatial Telemetry Bar */}
      <BottomTelemetry
        activeScene={activeScene}
        analysisData={analysisData}
        isAnalyzing={isAnalyzing}
      />
    </div>
  );
}
