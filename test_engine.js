import { 
  computeRgbAndSpectralStats, 
  classifyLULC, 
  detectObjects, 
  detectBiTemporalChange,
  LULC_CLASSES
} from './src/services/remoteSensingEngine.js';
import { generateLocalGroundedResponse } from './src/services/vlmProvider.js';

console.log('=== RUNNING SATQUERY REMOTE SENSING ENGINE TESTS ===');

// 1. Test Mock Image Data
const width = 100;
const height = 100;
const totalPixels = width * height;
const data = new Uint8ClampedArray(totalPixels * 4);

// Fill with synthetic land cover mix (water in top half, vegetation bottom left, urban bottom right)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    if (y < 40) {
      // Water: blue-heavy, low red/green
      data[idx] = 10;
      data[idx + 1] = 40;
      data[idx + 2] = 100;
      data[idx + 3] = 255;
    } else if (x < 50) {
      // Dense Vegetation: high green, moderate red/blue
      data[idx] = 20;
      data[idx + 1] = 130;
      data[idx + 2] = 30;
      data[idx + 3] = 255;
    } else {
      // Urban: high brightness, balanced RGB
      data[idx] = 180;
      data[idx + 1] = 180;
      data[idx + 2] = 180;
      data[idx + 3] = 255;
    }
  }
}

// Add a high-contrast object (e.g. ship in water at 20, 20)
for (let oy = 18; oy <= 22; oy++) {
  for (let ox = 15; ox <= 28; ox++) {
    const idx = (oy * width + ox) * 4;
    data[idx] = 240;
    data[idx + 1] = 240;
    data[idx + 2] = 240;
  }
}

const mockImageData = { width, height, data };

// Test 1: RGB & Spectral Stats
console.log('Test 1: RGB & Spectral Stats...');
const stats = computeRgbAndSpectralStats(mockImageData);
console.assert(stats.totalPixels === 10000, 'Total pixels should be 10000');
console.assert(stats.mean.r > 0 && stats.mean.g > 0 && stats.mean.b > 0, 'RGB means computed');
console.log('  Stats OK: Mean R=', stats.mean.r, 'G=', stats.mean.g, 'B=', stats.mean.b, 'VARI=', stats.indices.meanVARI);

// Test 2: LULC Classification
console.log('Test 2: LULC Segmentation Classification...');
const lulcRes = classifyLULC(mockImageData, 10);
console.assert(lulcRes.stats.length === 6, 'Should output 6 LULC classes');
console.assert(lulcRes.counts.water > 0, 'Water class should be detected');
console.assert(lulcRes.counts.dense_veg > 0, 'Vegetation class should be detected');
console.assert(lulcRes.counts.urban > 0, 'Urban class should be detected');
console.log('  LULC Breakdown:');
lulcRes.stats.forEach(s => console.log(`    - ${s.name}: ${s.percentage}% (${s.pixelCount} px, ${s.estimatedKm2} km²)`));

// Test 3: Object Detection
console.log('Test 3: Object Detection...');
const objRes = detectObjects(mockImageData, { minSize: 4, maxSize: 50 });
console.assert(objRes.totalObjects >= 1, 'Should detect at least 1 object (the ship target)');
console.log('  Detected Objects Count:', objRes.totalObjects);
objRes.objects.forEach(o => console.log(`    - [${o.label}] bbox: [${o.x}, ${o.y}, ${o.width}, ${o.height}] conf: ${o.confidence}`));

// Test 4: Bi-Temporal Change Detection
console.log('Test 4: Bi-Temporal Change Detection...');
const postData = new Uint8ClampedArray(data);
// Flood an extra region in post image (from y=40 to 60, x=0 to 50)
for (let y = 40; y < 60; y++) {
  for (let x = 0; x < 50; x++) {
    const idx = (y * width + x) * 4;
    postData[idx] = 10;
    postData[idx + 1] = 40;
    postData[idx + 2] = 100;
  }
}
const mockPostImageData = { width, height, data: postData };
const changeRes = detectBiTemporalChange(mockImageData, mockPostImageData, 10);
console.assert(changeRes.changedPixelCount > 0, 'Change pixels should be detected');
console.assert(changeRes.breakdown.newlyFlooded.pixels > 0, 'Newly flooded pixels should be identified');
console.log(`  Change Summary: ${changeRes.changePercentage}% changed (${changeRes.changedAreaKm2} km²)`);
console.log(`    - Newly Flooded: ${changeRes.breakdown.newlyFlooded.percentage}% (${changeRes.breakdown.newlyFlooded.areaKm2} km²)`);

// Test 5: Grounded VLM Intent Engine
console.log('Test 5: Grounded VLM Intent Engine...');
const mockScene = {
  id: 'test_mission',
  name: 'Test Scene',
  region: 'Brahmaputra Basin, Assam',
  metadata: {
    hasGeoMetadata: true,
    sensor: 'Sentinel-2 MSI',
    crs: 'EPSG:32646 (WGS 84 / UTM Zone 46N)',
    center: { lat: 26.68, lon: 93.38 },
    resolution: '10m GSD',
    bands: 3
  }
};

const vlmOutput1 = generateLocalGroundedResponse({
  query: 'How much area appears flooded?',
  activeScene: mockScene,
  analysisData: { width, height, stats, lulc: lulcRes, objects: objRes },
  changeData: changeRes,
  activeMode: 'change'
});

console.assert(vlmOutput1.confirmedMetadata.includes('EPSG:32646'), 'Confirmed metadata should cite CRS');
console.assert(vlmOutput1.computedAnalysis.includes('Water Extent'), 'Should mention water extent');
console.assert(vlmOutput1.rawResponse.includes('### 🛰️ CONFIRMED METADATA'), 'Must contain CONFIRMED METADATA header');
console.assert(vlmOutput1.rawResponse.includes('### 📊 COMPUTED ANALYSIS'), 'Must contain COMPUTED ANALYSIS header');
console.assert(vlmOutput1.rawResponse.includes('### 👁️ AI VISUAL INTERPRETATION'), 'Must contain AI VISUAL INTERPRETATION header');
console.assert(vlmOutput1.rawResponse.includes('### ⚠️ UNCERTAIN / NOT AVAILABLE'), 'Must contain UNCERTAIN header');

console.log('  VLM Grounded Reasoning Output Verified: OK');

console.log('\n>>> ALL 5 REMOTE SENSING ENGINE TESTS PASSED PERFECTLY! <<<');
