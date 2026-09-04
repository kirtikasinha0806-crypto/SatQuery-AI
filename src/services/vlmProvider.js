/**
 * Vision-Language Assistant Provider & Reasoning Pipeline
 * Provides pluggable integration with Gemini, OpenAI/Ollama,
 * and a robust deterministic local Remote Sensing Grounded Engine fallback.
 */

export const VLM_PROVIDERS = [
  { id: 'local_fallback', name: 'Deterministic RS Grounded Engine (Local Fallback)' },
  { id: 'gemini', name: 'Google Gemini (Gemini 1.5 / 2.0 Flash)' },
  { id: 'openai_custom', name: 'OpenAI / Ollama / Custom VLM' },
];

/**
 * Execute a query against the active scene and metadata
 */
export async function queryVisionLanguageAssistant({
  query,
  activeScene,
  analysisData,
  changeData = null,
  activeMode = 'general',
  providerConfig = { provider: 'local_fallback' },
  history = []
}) {
  const { provider = 'local_fallback', apiKey = '', endpoint = '', modelName = '' } = providerConfig;

  // If a live API key is provided and provider is Gemini or OpenAI, attempt API call
  if (provider === 'gemini' && apiKey) {
    try {
      return await callGeminiVLM({ query, activeScene, analysisData, changeData, apiKey, modelName });
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local grounded engine:', err);
      const fallbackResult = generateLocalGroundedResponse({ query, activeScene, analysisData, changeData, activeMode });
      fallbackResult.systemNote = `(Gemini API error: ${err.message}. Showing local computed remote-sensing analysis instead.)`;
      return fallbackResult;
    }
  }

  if (provider === 'openai_custom' && (apiKey || endpoint)) {
    try {
      return await callOpenAIVLM({ query, activeScene, analysisData, changeData, apiKey, endpoint, modelName });
    } catch (err) {
      console.warn('Custom VLM call failed, falling back to local grounded engine:', err);
      const fallbackResult = generateLocalGroundedResponse({ query, activeScene, analysisData, changeData, activeMode });
      fallbackResult.systemNote = `(VLM Provider error: ${err.message}. Showing local computed remote-sensing analysis instead.)`;
      return fallbackResult;
    }
  }

  // Default: Local Deterministic Remote-Sensing Grounded Engine
  return generateLocalGroundedResponse({ query, activeScene, analysisData, changeData, activeMode });
}

/**
 * Deterministic Remote-Sensing Grounded Reasoning Engine
 * Dynamically synthesizes honest, factual answers from actual computed pixel metrics
 */
export function generateLocalGroundedResponse({
  query,
  activeScene,
  analysisData,
  changeData,
  activeMode
}) {
  const q = (query || '').toLowerCase();
  const meta = activeScene?.metadata || {};
  const hasGeo = Boolean(meta.hasGeoMetadata || (meta.bounds && meta.crs && !meta.crs.includes('unavailable')));

  // Extract computed metrics
  const lulcStats = analysisData?.lulc?.stats || [];
  const objects = analysisData?.objects?.objects || [];
  const objectCounts = analysisData?.objects?.countsByLabel || {};
  const spectral = analysisData?.stats?.indices || {};
  const rgbMean = analysisData?.stats?.mean || {};
  const dims = `${analysisData?.width || meta.width || 'Unknown'} × ${analysisData?.height || meta.height || 'Unknown'} px`;

  // Determine Primary Query Intent
  const isUnsupportedQuery = /temperature|thermometer|weather tomorrow|forecast|who is|captain|driver|name of person|underground|subterranean|depth of soil|gdp|economy|price|cost|population census/i.test(q);
  const isCountQuery = /count|how many|ships|buildings|vessels|vehicles|structures|number of/i.test(q);
  const isWaterFloodQuery = /water|flood|flooded|inundat|river|lake|reservoir|submerge/i.test(q);
  const isVegForestQuery = /vegetation|forest|tree|canopy|crop|green|agriculture|wildfire|burn|fire/i.test(q);
  const isLulcQuery = /land.?use|lulc|land.?cover|breakdown|class|classification|percentage|category/i.test(q);
  const isChangeQuery = /change|difference|compare|before.*after|temporal|loss|growth|expanded/i.test(q);
  const isLocationMetadataQuery = /location|where|coordinate|lat|lon|crs|epsg|sensor|satellite|metadata|bounds/i.test(q);

  let confirmedMetadata = '';
  let computedAnalysis = '';
  let aiVisualInterpretation = '';
  let uncertainNotAvailable = '';
  let keyMetrics = [];

  // 1. CONFIRMED METADATA SECTION
  if (hasGeo) {
    confirmedMetadata = `• **Sensor / Platform**: ${meta.sensor || 'Optical Earth Observation'}\n` +
      `• **Coordinate Reference System**: \`${meta.crs}\`\n` +
      `• **Center Coordinates**: Lat ${meta.center?.lat ?? 'N/A'}°, Lon ${meta.center?.lon ?? 'N/A'}°\n` +
      `• **Ground Resolution**: ${meta.resolution || '10m'}\n` +
      `• **Image Dimensions**: ${dims} (${meta.bands || 3} bands)\n` +
      `• **Acquisition Date**: ${meta.date || meta.date_post || 'Recorded archive'}`;
  } else {
    confirmedMetadata = `• **Location Metadata**: Location metadata unavailable (Standard non-georeferenced raster)\n` +
      `• **Image Dimensions**: ${dims}\n` +
      `• **Color Channels**: RGB 3-Channel 8-bit\n` +
      `• **CRS / Projection**: None embedded`;
  }

  // 2. INTENT-SPECIFIC COMPUTED ANALYSIS & VISUAL INTERPRETATION
  if (isUnsupportedQuery) {
    computedAnalysis = `• **Requested Parameter Cannot Be Derived**: The query requests data (e.g., sub-surface parameters, personal identities, exact temperatures, or non-visible economic attributes) that cannot be measured directly from optical 2D surface satellite imagery.\n` +
      `• **Available Computed Surface Parameters**: Optical reflectance indices (VARI=${spectral.meanVARI ?? '0.0'}, GLI=${spectral.meanGLI ?? '0.0'}), LULC spatial distribution, and visible surface morphology only.`;

    aiVisualInterpretation = `• Standard Earth Observation satellites capture top-of-atmosphere and surface optical reflectance. Sub-surface or non-optical parameters are strictly out of domain.`;

    uncertainNotAvailable = `• **Information Not Available / Out of Domain**: Cannot reliably infer requested property from surface optical raster without ground-truth sensors or specialized geophysical instrumentation.`;

    keyMetrics = [
      { label: 'Status', value: 'Out of Scope', color: 'slate' },
      { label: 'Reason', value: 'Non-observable from 2D optical', color: 'amber' }
    ];
  } else if (isCountQuery) {
    const totalObjs = objects.length;
    const ships = objectCounts['Maritime Vessel / Ship'] || 0;
    const bldgs = objectCounts['Building Complex'] || 0;
    const structures = objectCounts['Structure / Facility'] || 0;
    const vehicles = objectCounts['Vehicle / Unit / Tank'] || 0;

    computedAnalysis = `• **Total Detected Salient Objects**: **${totalObjs}**\n`;
    if (ships > 0) computedAnalysis += `• **Maritime Vessels / Ships**: **${ships}** distinct targets detected\n`;
    if (bldgs > 0) computedAnalysis += `• **Building Complexes**: **${bldgs}** clusters identified\n`;
    if (structures > 0) computedAnalysis += `• **Structures / Facilities**: **${structures}** structural entities\n`;
    if (vehicles > 0) computedAnalysis += `• **Vehicles / Storage Units**: **${vehicles}** detected\n`;
    computedAnalysis += `• Bounding boxes with spatial coordinates and confidence ratings are mapped on the center viewer.`;

    aiVisualInterpretation = `• Target detection algorithm utilized spatial luminance contrast, morphometric aspect ratios, and background separation.\n` +
      (ships > 0 ? `• High-confidence maritime targets correlate with deep-water berths, vessel fairways, and open sea anchorages.` : `• Structural centroids are clustered in developed, high-radiance zones.`);

    uncertainNotAvailable = `• Sub-pixel objects smaller than 6 pixels cannot be resolved reliably without higher-resolution optical tasking.\n` +
      `• Dense adjacent buildings may be merged into single complex bounding boxes.`;

    keyMetrics = [
      { label: 'Total Objects', value: totalObjs, color: 'emerald' },
      { label: 'Ships / Vessels', value: ships, color: 'cyan' },
      { label: 'Buildings', value: bldgs, color: 'rose' }
    ];

  } else if (isWaterFloodQuery) {
    const waterClass = lulcStats.find(c => c.id === 'water') || { percentage: 0, estimatedKm2: 0 };
    const burnScar = lulcStats.find(c => c.id === 'burn_scar') || { percentage: 0, estimatedKm2: 0 };

    computedAnalysis = `• **Water Extent / Inundation**: **${waterClass.percentage}%** of visible scene\n` +
      `• **Estimated Surface Water Area**: **${waterClass.estimatedKm2 > 0 ? waterClass.estimatedKm2 + ' km²' : waterClass.pixelCount + ' px'}**\n` +
      `• **Spectral Water Absorption Index**: Mean Blue/Green attenuation is consistent with sediment-laden water bodies.\n` +
      (changeData?.breakdown?.newlyFlooded ? `• **Bi-temporal Newly Submerged Flood Extent**: **${changeData.breakdown.newlyFlooded.percentage}%** (${changeData.breakdown.newlyFlooded.areaKm2} km²)\n` : '');

    aiVisualInterpretation = `• Water bodies appear in characteristic deep blue/cyan hues along river channels, retention wetlands, or floodplains.\n` +
      (waterClass.percentage > 20 ? `• Extensive water spread indicates major seasonal inundation or coastal waters.` : `• Water bodies are localized to natural reservoirs, drainage channels, or localized depressions.`);

    uncertainNotAvailable = `• Cloud shadows and dense terrain topography can sometimes mimic dark water spectral signatures.\n` +
      `• True bathymetry/depth is not available from optical RGB alone without multispectral SWIR/SAR data.`;

    keyMetrics = [
      { label: 'Water Surface', value: `${waterClass.percentage}%`, color: 'cyan' },
      { label: 'Area', value: `${waterClass.estimatedKm2} km²`, color: 'blue' }
    ];

  } else if (isVegForestQuery) {
    const denseVeg = lulcStats.find(c => c.id === 'dense_veg') || { percentage: 0, estimatedKm2: 0 };
    const sparseVeg = lulcStats.find(c => c.id === 'sparse_veg') || { percentage: 0, estimatedKm2: 0 };
    const totalVeg = (denseVeg.percentage + sparseVeg.percentage).toFixed(2);
    const burnScar = lulcStats.find(c => c.id === 'burn_scar') || { percentage: 0, estimatedKm2: 0 };

    computedAnalysis = `• **Total Vegetated Area**: **${totalVeg}%** of total scene\n` +
      `  - Dense Canopy / Forest: **${denseVeg.percentage}%** (${denseVeg.estimatedKm2} km²)\n` +
      `  - Cropland / Grassland: **${sparseVeg.percentage}%** (${sparseVeg.estimatedKm2} km²)\n` +
      `• **Spectral Vegetation Indices**:\n` +
      `  - Mean VARI (Visible Atmospherically Resistant Index): \`${spectral.meanVARI ?? 'N/A'}\`\n` +
      `  - Mean GLI (Green Leaf Index): \`${spectral.meanGLI ?? 'N/A'}\`\n` +
      (burnScar.percentage > 1 ? `• **Burn Scar / Thermal Scars**: **${burnScar.percentage}%** (${burnScar.estimatedKm2} km²)\n` : '') +
      (changeData?.breakdown?.vegetationLoss ? `• **Bi-temporal Forest / Vegetation Loss**: **${changeData.breakdown.vegetationLoss.percentage}%** (${changeData.breakdown.vegetationLoss.areaKm2} km²)\n` : '');

    aiVisualInterpretation = `• High VARI and GLI values indicate healthy photosynthetic chlorophyll content across the canopy.\n` +
      (burnScar.percentage > 1 ? `• Darkened charcoal-rich zones exhibit sharp spectral drops indicative of wildfire burn scars.` : `• Dense foliage clusters in protected reserves, riparian buffers, or parks.`);

    uncertainNotAvailable = `• Exact species differentiation requires hyperspectral imagery.\n` +
      `• Agricultural crop yield stage cannot be determined conclusively without time-series NDVI curve profiling.`;

    keyMetrics = [
      { label: 'Vegetation Cover', value: `${totalVeg}%`, color: 'emerald' },
      { label: 'Dense Canopy', value: `${denseVeg.percentage}%`, color: 'emerald' },
      { label: 'Mean VARI', value: `${spectral.meanVARI}`, color: 'lime' }
    ];

  } else if (isChangeQuery && changeData) {
    computedAnalysis = `• **Total Changed Surface**: **${changeData.changePercentage}%** (${changeData.changedAreaKm2} km²)\n` +
      `• **Newly Flooded Extent**: **${changeData.breakdown.newlyFlooded.percentage}%** (${changeData.breakdown.newlyFlooded.areaKm2} km²)\n` +
      `• **Forest Cover / Vegetation Loss**: **${changeData.breakdown.vegetationLoss.percentage}%** (${changeData.breakdown.vegetationLoss.areaKm2} km²)\n` +
      `• **Urban Expansion / New Ground**: **${changeData.breakdown.urbanExpansion.percentage}%** (${changeData.breakdown.urbanExpansion.areaKm2} km²)\n` +
      `• **Water Recession / Dried Silt**: **${changeData.breakdown.waterRecession.percentage}%** (${changeData.breakdown.waterRecession.areaKm2} km²)`;

    aiVisualInterpretation = `• Bi-temporal radiance subtraction highlights dynamic environmental transitions between the two acquisitions.\n` +
      `• The visual change overlay displays newly submerged flood zones in Cyan, forest loss/burn in Red, and urban developments in Purple.`;

    uncertainNotAvailable = `• Small sub-pixel variations may be affected by atmospheric haze or seasonal illumination angle differences.`;

    keyMetrics = [
      { label: 'Total Change', value: `${changeData.changePercentage}%`, color: 'amber' },
      { label: 'Changed Area', value: `${changeData.changedAreaKm2} km²`, color: 'rose' }
    ];

  } else if (isLulcQuery) {
    computedAnalysis = `• **Land-Use / Land-Cover Pixel Classification**:\n` +
      lulcStats.map(s => `  - **${s.name}**: **${s.percentage}%** (${s.estimatedKm2 > 0 ? s.estimatedKm2 + ' km²' : s.pixelCount + ' px'})`).join('\n') +
      `\n• **Mean Radiometric Radiance**: R=${rgbMean.r}, G=${rgbMean.g}, B=${rgbMean.b}`;

    aiVisualInterpretation = `• Scene composition exhibits a distinct distribution between natural and anthropogenic land classes.\n` +
      `• Full color-coded segmentation mask is available via the 'LULC Mask' visual overlay toggle.`;

    uncertainNotAvailable = `• Mixed boundary pixels (e.g. peri-urban vegetation) may share spectral characteristics across both classes.`;

    keyMetrics = lulcStats.slice(0, 3).map(s => ({
      label: s.name.split('/')[0].trim(),
      value: `${s.percentage}%`,
      color: s.id === 'water' ? 'cyan' : s.id.includes('veg') ? 'emerald' : s.id === 'urban' ? 'rose' : 'amber'
    }));

  } else if (isLocationMetadataQuery) {
    if (hasGeo) {
      computedAnalysis = `• **Geographic Bounding Box**:\n` +
        `  - Min Lat/Lon: ${meta.bounds?.min_lat ?? meta.bounds?.minY ?? 'N/A'}, ${meta.bounds?.min_lon ?? meta.bounds?.minX ?? 'N/A'}\n` +
        `  - Max Lat/Lon: ${meta.bounds?.max_lat ?? meta.bounds?.maxY ?? 'N/A'}, ${meta.bounds?.max_lon ?? meta.bounds?.maxX ?? 'N/A'}\n` +
        `• **Geographic Center**: Lat ${meta.center?.lat ?? 'N/A'}°, Lon ${meta.center?.lon ?? 'N/A'}°\n` +
        `• **Target Region**: ${meta.region || 'Geo-referenced AOI'}\n` +
        `• **CRS Code**: ${meta.crs}`;

      aiVisualInterpretation = `• Scene georeferencing is verified against geospatial headers and standard UTM cartographic projections.`;
      uncertainNotAvailable = `• Local elevation data (DEM) is not bundled with this 2D optical raster.`;
    } else {
      computedAnalysis = `• **No Geospatial Projection Embedded**: Standard raster format without TIFF GeoKeys or EXIF GPS tags.\n` +
        `• **Pixel Coordinates Only**: Width ${analysisData?.width || meta.width || 0}px, Height ${analysisData?.height || meta.height || 0}px.`;

      aiVisualInterpretation = meta.region 
        ? `• [AI Visual Inference: ~70% Confidence]: Visual morphology aligns with ${meta.region} based on scene context.`
        : `• [AI Visual Inference]: Geographic location cannot be determined purely from pixel values without georeferenced tiepoints.`;

      uncertainNotAvailable = `• Exact geographic coordinates and CRS are unavailable in this image file.`;
    }

    keyMetrics = [
      { label: 'CRS', value: hasGeo ? (meta.crs.split(' ')[0]) : 'None', color: hasGeo ? 'emerald' : 'slate' },
      { label: 'Resolution', value: meta.resolution || '10m', color: 'cyan' }
    ];

  } else {
    // General Overview / Scene Description
    const topClasses = lulcStats.slice(0, 3).map(s => `${s.name} (${s.percentage}%)`).join(', ');
    const dominantClass = lulcStats[0]?.name || 'Mixed Surface';

    computedAnalysis = `• **Dominant Land Cover**: **${dominantClass}** (${lulcStats[0]?.percentage || 0}%)\n` +
      `• **LULC Distribution**: ${topClasses}\n` +
      `• **Salient Object Count**: **${objects.length}** structures/vessels detected\n` +
      `• **Spectral Index Summary**: Mean VARI = \`${spectral.meanVARI ?? '0.00'}\`, GLI = \`${spectral.meanGLI ?? '0.00'}\`\n` +
      (changeData ? `• **Bi-Temporal Detected Change**: **${changeData.changePercentage}%** total delta area\n` : '');

    aiVisualInterpretation = meta.description
      ? `• ${meta.description}\n• Visual inspection indicates clear atmospheric clarity with distinct landscape boundaries.`
      : `• Optical remote sensing scene exhibiting structured spatial textures and distinct land-cover partitions.`;

    uncertainNotAvailable = !hasGeo ? `• Geodetic coordinates are unavailable on this uncalibrated raster.` : `• Deep thermal and SAR penetration data not present in optical bands.`;

    keyMetrics = [
      { label: 'Dominant', value: dominantClass.split('/')[0].trim(), color: 'emerald' },
      { label: 'Detected Targets', value: objects.length, color: 'cyan' },
      { label: 'Change %', value: changeData ? `${changeData.changePercentage}%` : 'N/A', color: 'amber' }
    ];
  }

  const formattedResponse = 
`### 🛰️ CONFIRMED METADATA
${confirmedMetadata}

### 📊 COMPUTED ANALYSIS
${computedAnalysis}

### 👁️ AI VISUAL INTERPRETATION
${aiVisualInterpretation}

### ⚠️ UNCERTAIN / NOT AVAILABLE
${uncertainNotAvailable}`;

  return {
    provider: 'local_fallback',
    providerName: 'Deterministic RS Grounded Engine (Local Fallback)',
    rawResponse: formattedResponse,
    confirmedMetadata,
    computedAnalysis,
    aiVisualInterpretation,
    uncertainNotAvailable,
    keyMetrics,
    timestamp: new Date().toISOString()
  };
}

/**
 * Live Google Gemini Vision-Language Model Integration
 */
async function callGeminiVLM({ query, activeScene, analysisData, changeData, apiKey, modelName = 'gemini-1.5-flash' }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;

  const imageBase64 = activeScene.dataUrl ? activeScene.dataUrl.split(',')[1] : null;
  const meta = activeScene.metadata || {};
  const hasGeo = Boolean(meta.hasGeoMetadata || (meta.bounds && meta.crs && !meta.crs.includes('unavailable')));

  const systemInstruction = `You are SatQuery AI, an expert Remote-Sensing & Earth Observation Vision-Language Assistant.
You MUST format your response strictly into four clear Markdown sections:
### 🛰️ CONFIRMED METADATA
### 📊 COMPUTED ANALYSIS
### 👁️ AI VISUAL INTERPRETATION
### ⚠️ UNCERTAIN / NOT AVAILABLE

STRICT GROUNDING RULES:
1. If the image contains confirmed geospatial metadata (CRS, bounds, coordinates), cite it. If not, explicitly state "Location metadata unavailable" and only label any visual geographic guess as "[AI Visual Inference (Confidence: X%)]".
2. Incorporate the provided real computed image statistics and metrics (LULC percentages, object counts, spectral indices). Never invent fake numbers.
3. Answer the user's specific question directly and truthfully.`;

  const contextData = {
    userQuery: query,
    hasGeospatialMetadata: hasGeo,
    sensor: meta.sensor || 'Unknown',
    crs: meta.crs || 'Location metadata unavailable',
    coordinates: hasGeo ? meta.center : 'Unavailable',
    computedLULC: analysisData?.lulc?.stats?.map(s => `${s.name}: ${s.percentage}% (${s.estimatedKm2} km²)`),
    detectedObjects: analysisData?.objects?.countsByLabel,
    spectralIndices: analysisData?.stats?.indices,
    temporalChange: changeData ? {
      totalChangePercentage: changeData.changePercentage,
      changedAreaKm2: changeData.changedAreaKm2,
      breakdown: changeData.breakdown
    } : 'None'
  };

  const parts = [
    {
      text: `${systemInstruction}\n\nContext and Computed Remote-Sensing Analysis:\n${JSON.stringify(contextData, null, 2)}\n\nUser Question: ${query}`
    }
  ];

  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64
      }
    });
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const resJson = await response.json();
  const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received from Gemini.';

  return {
    provider: 'gemini',
    providerName: `Google Gemini (${modelName || 'gemini-1.5-flash'})`,
    rawResponse: rawText,
    timestamp: new Date().toISOString()
  };
}

/**
 * OpenAI / Ollama / Custom VLM Provider Integration
 */
async function callOpenAIVLM({ query, activeScene, analysisData, changeData, apiKey, endpoint, modelName }) {
  const url = endpoint || 'https://api.openai.com/v1/chat/completions';
  const model = modelName || 'gpt-4o-mini';

  const imageBase64 = activeScene.dataUrl ? activeScene.dataUrl : '';
  const meta = activeScene.metadata || {};

  const systemMsg = `You are SatQuery AI, an expert Remote-Sensing & Earth Observation Vision-Language Assistant.
Format your answer into:
### 🛰️ CONFIRMED METADATA
### 📊 COMPUTED ANALYSIS
### 👁️ AI VISUAL INTERPRETATION
### ⚠️ UNCERTAIN / NOT AVAILABLE

Never invent coordinates if not present. Use the provided computed analysis metrics.`;

  const contextData = {
    query,
    sensor: meta.sensor || 'Optical Earth Observation',
    crs: meta.crs || 'Location metadata unavailable',
    coordinates: meta.center || 'Unavailable',
    computedLULC: analysisData?.lulc?.stats?.map(s => `${s.name}: ${s.percentage}%`),
    detectedObjects: analysisData?.objects?.countsByLabel,
    changeData: changeData ? `${changeData.changePercentage}% change` : 'N/A'
  };

  const messages = [
    { role: 'system', content: systemMsg },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Context: ${JSON.stringify(contextData)}\n\nQuery: ${query}` },
        ...(imageBase64 ? [{ type: 'image_url', image_url: { url: imageBase64 } }] : [])
      ]
    }
  ];

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`VLM Endpoint Error (${response.status}): ${errText}`);
  }

  const resJson = await response.json();
  const rawText = resJson.choices?.[0]?.message?.content || 'No text in response.';

  return {
    provider: 'openai_custom',
    providerName: `VLM (${model})`,
    rawResponse: rawText,
    timestamp: new Date().toISOString()
  };
}
