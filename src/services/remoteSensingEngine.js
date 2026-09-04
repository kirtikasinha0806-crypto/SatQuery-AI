/**
 * Remote Sensing Image Analysis & Computer Vision Engine
 * Performs genuine pixel-level radiometric, spectral, LULC segmentation,
 * object contour extraction, and bi-temporal change detection.
 */

export const LULC_CLASSES = {
  water: { id: 'water', name: 'Water Bodies / Inundation', color: '#06b6d4', rgba: [6, 182, 212, 180] },
  dense_veg: { id: 'dense_veg', name: 'Dense Forest / Canopy', color: '#059669', rgba: [5, 150, 105, 180] },
  sparse_veg: { id: 'sparse_veg', name: 'Cropland / Vegetation', color: '#84cc16', rgba: [132, 204, 22, 180] },
  urban: { id: 'urban', name: 'Urban / Built-Up / Infrastructure', color: '#f43f5e', rgba: [244, 63, 94, 180] },
  barren: { id: 'barren', name: 'Barren Soil / Sand / Fallow', color: '#f59e0b', rgba: [245, 158, 11, 180] },
  burn_scar: { id: 'burn_scar', name: 'Burn Scar / Deep Turbid Zone', color: '#7c3aed', rgba: [124, 58, 237, 180] },
};

/**
 * Extract image data from an HTML Image, Canvas, or ImageBitmap
 */
export function getImageDataFromElement(imgElement, maxWidth = 1200, maxHeight = 1200) {
  let w = imgElement.naturalWidth || imgElement.videoWidth || imgElement.width;
  let h = imgElement.naturalHeight || imgElement.videoHeight || imgElement.height;

  if (w > maxWidth || h > maxHeight) {
    const scale = Math.min(maxWidth / w, maxHeight / h);
    w = Math.floor(w * scale);
    h = Math.floor(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imgElement, 0, 0, w, h);
  return {
    imageData: ctx.getImageData(0, 0, w, h),
    width: w,
    height: h,
    canvas
  };
}

/**
 * Compute statistical RGB distributions and spectral index summaries
 */
export function computeRgbAndSpectralStats(imageData) {
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;

  let sumR = 0, sumG = 0, sumB = 0;
  let sumVARI = 0, sumGLI = 0, sumExG = 0;
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    sumR += r;
    sumG += g;
    sumB += b;

    if (r < minR) minR = r; if (r > maxR) maxR = r;
    if (g < minG) minG = g; if (g > maxG) maxG = g;
    if (b < minB) minB = b; if (b > maxB) maxB = b;

    // Visible Atmospherically Resistant Index (VARI) = (G - R) / (G + R - B + 0.001)
    const vari = (g - r) / (g + r - b + 0.0001);
    // Green Leaf Index (GLI) = (2G - R - B) / (2G + R + B + 0.001)
    const gli = (2 * g - r - b) / (2 * g + r + b + 0.0001);
    // Excess Green (ExG) = 2G - R - B
    const exg = (2 * g - r - b) / 255.0;

    sumVARI += vari;
    sumGLI += gli;
    sumExG += exg;
  }

  const meanR = sumR / totalPixels;
  const meanG = sumG / totalPixels;
  const meanB = sumB / totalPixels;

  // Standard Deviation
  let varR = 0, varG = 0, varB = 0;
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    varR += Math.pow(data[idx] - meanR, 2);
    varG += Math.pow(data[idx + 1] - meanG, 2);
    varB += Math.pow(data[idx + 2] - meanB, 2);
  }

  return {
    totalPixels,
    mean: {
      r: Number(meanR.toFixed(2)),
      g: Number(meanG.toFixed(2)),
      b: Number(meanB.toFixed(2))
    },
    stdDev: {
      r: Number(Math.sqrt(varR / totalPixels).toFixed(2)),
      g: Number(Math.sqrt(varG / totalPixels).toFixed(2)),
      b: Number(Math.sqrt(varB / totalPixels).toFixed(2))
    },
    range: {
      r: [minR, maxR],
      g: [minG, maxG],
      b: [minB, maxB]
    },
    indices: {
      meanVARI: Number((sumVARI / totalPixels).toFixed(3)),
      meanGLI: Number((sumGLI / totalPixels).toFixed(3)),
      meanExG: Number((sumExG / totalPixels).toFixed(3))
    }
  };
}

/**
 * Pixel-level LULC Classification & Mask Generation
 */
export function classifyLULC(imageData, gsdMeters = 10) {
  const { width, height, data } = imageData;
  const totalPixels = width * height;

  let maskCanvas = null;
  let maskImgData = null;
  let maskData = null;
  if (typeof document !== 'undefined') {
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');
    maskImgData = maskCtx.createImageData(width, height);
    maskData = maskImgData.data;
  }

  const counts = {
    water: 0,
    dense_veg: 0,
    sparse_veg: 0,
    urban: 0,
    barren: 0,
    burn_scar: 0
  };

  const pixelAreaKm2 = (gsdMeters * gsdMeters) / 1000000.0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const brightness = (r + g + b) / 3.0;
    const vari = (g - r) / (g + r - b + 0.001);
    const gli = (2 * g - r - b) / (2 * g + r + b + 0.001);
    const rgRatio = (r + 1) / (g + 1);
    const bgRatio = (b + 1) / (g + 1);

    let assignedClass = 'barren';

    // Classification Rules
    if ((b > r && b > g * 0.9 && brightness < 120) || (b > 60 && r < 50 && g < 70) || (brightness < 38 && vari < -0.1)) {
      // Water body or flood inundation
      assignedClass = 'water';
    } else if (r > 60 && g < 40 && b < 40 && brightness < 80) {
      // Burn scar / charcoal / severely degraded
      assignedClass = 'burn_scar';
    } else if (gli > 0.12 && vari > 0.08 && g > r && g > b) {
      // Dense forest / canopy
      assignedClass = 'dense_veg';
    } else if (gli > 0.02 && g >= r * 0.85 && brightness > 50 && brightness < 190) {
      // Cropland / Sparse vegetation
      assignedClass = 'sparse_veg';
    } else if (brightness > 130 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25) {
      // High-albedo concrete / built-up / roofs / paved urban
      assignedClass = 'urban';
    } else if (rgRatio > 1.15 && brightness > 90) {
      // Barren / soil / sandy ground
      assignedClass = 'barren';
    } else {
      // Default to urban / mixed impervious
      assignedClass = brightness > 90 ? 'urban' : 'barren';
    }

    counts[assignedClass]++;

    if (maskData) {
      const rgba = LULC_CLASSES[assignedClass].rgba;
      maskData[idx] = rgba[0];
      maskData[idx + 1] = rgba[1];
      maskData[idx + 2] = rgba[2];
      maskData[idx + 3] = rgba[3];
    }
  }

  if (maskCanvas && maskImgData) {
    maskCanvas.getContext('2d').putImageData(maskImgData, 0, 0);
  }

  const stats = Object.entries(counts).map(([key, count]) => {
    const percentage = Number(((count / totalPixels) * 100).toFixed(2));
    const estimatedKm2 = Number((count * pixelAreaKm2).toFixed(2));
    return {
      id: key,
      name: LULC_CLASSES[key].name,
      color: LULC_CLASSES[key].color,
      pixelCount: count,
      percentage,
      estimatedKm2
    };
  });

  stats.sort((a, b) => b.percentage - a.percentage);

  return {
    stats,
    counts,
    totalPixels,
    maskCanvas,
    maskDataUrl: maskCanvas ? maskCanvas.toDataURL('image/png') : null
  };
}

/**
 * Object / Structure / Vessel Detection & Bounding Box Extractor
 */
export function detectObjects(imageData, options = {}) {
  const { width, height, data } = imageData;
  const { targetType = 'all', minSize = 6, maxSize = 120 } = options;

  // Compute grayscale luminance & edge gradients
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = Math.floor(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  // Multi-scale connected component / salient blob scan
  const visited = new Uint8Array(width * height);
  const detectedBoxes = [];
  const step = 2; // sub-sample for speed on large scenes

  // Find local contrast peaks
  for (let y = 10; y < height - 10; y += step) {
    for (let x = 10; x < width - 10; x += step) {
      const idx = y * width + x;
      if (visited[idx]) continue;

      const pVal = gray[idx];
      const r = data[idx * 4];
      const g = data[idx * 4 + 1];
      const b = data[idx * 4 + 2];

      // Surrounding background average
      const bg = (gray[idx - 6] + gray[idx + 6] + gray[idx - 6 * width] + gray[idx + 6 * width]) / 4.0;
      const contrast = Math.abs(pVal - bg);

      // Check if it's a candidate structure / ship / vehicle
      const isWaterBg = (b > r + 15 && bg < 90);
      const isUrbanHighContrast = (contrast > 45);
      const isVesselCandidate = isWaterBg && (contrast > 30 || pVal > 110);

      if (isUrbanHighContrast || isVesselCandidate) {
        // Flood fill to determine bounding extent
        let minX = x, maxX = x, minY = y, maxY = y;
        let blobPixels = 0;
        const queue = [[x, y]];
        visited[idx] = 1;

        while (queue.length > 0 && blobPixels < 2000) {
          const [qx, qy] = queue.pop();
          blobPixels++;

          if (qx < minX) minX = qx;
          if (qx > maxX) maxX = qx;
          if (qy < minY) minY = qy;
          if (qy > maxY) maxY = qy;

          const neighbors = [
            [qx + 2, qy], [qx - 2, qy],
            [qx, qy + 2], [qx, qy - 2]
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (!visited[nIdx]) {
                const nVal = gray[nIdx];
                if (Math.abs(nVal - pVal) < 35) {
                  visited[nIdx] = 1;
                  queue.push([nx, ny]);
                }
              }
            }
          }
        }

        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        const aspect = Math.max(bw / bh, bh / bw);

        if (bw >= minSize && bh >= minSize && bw <= maxSize && bh <= maxSize && blobPixels >= 8) {
          let label = 'Structure / Facility';
          let confidence = Math.min(0.96, Math.max(0.65, 0.5 + (contrast / 120.0)));

          if (isWaterBg && aspect > 1.4) {
            label = 'Maritime Vessel / Ship';
            confidence = Math.min(0.98, confidence + 0.15);
          } else if (bw < 18 && bh < 18) {
            label = 'Vehicle / Unit / Tank';
            confidence = Math.min(0.92, confidence);
          } else if (bw > 25 && bh > 25) {
            label = 'Building Complex';
            confidence = Math.min(0.95, confidence + 0.05);
          }

          if (targetType === 'all' || 
             (targetType === 'ships' && label.includes('Vessel')) ||
             (targetType === 'buildings' && label.includes('Building'))) {
            detectedBoxes.push({
              id: `obj_${detectedBoxes.length + 1}`,
              label,
              confidence: Number(confidence.toFixed(2)),
              x: minX,
              y: minY,
              width: bw,
              height: bh,
              areaPixels: bw * bh
            });
          }
        }
      }
    }
  }

  // Non-maximum suppression / overlap merging
  const filtered = [];
  for (const box of detectedBoxes) {
    let overlap = false;
    for (const ex of filtered) {
      const xOverlap = Math.max(0, Math.min(box.x + box.width, ex.x + ex.width) - Math.max(box.x, ex.x));
      const yOverlap = Math.max(0, Math.min(box.y + box.height, ex.y + ex.height) - Math.max(box.y, ex.y));
      const overlapArea = xOverlap * yOverlap;
      if (overlapArea > (box.width * box.height * 0.4)) {
        overlap = true;
        break;
      }
    }
    if (!overlap && filtered.length < 80) {
      filtered.push(box);
    }
  }

  // Count summaries
  const countsByLabel = {};
  filtered.forEach(b => {
    countsByLabel[b.label] = (countsByLabel[b.label] || 0) + 1;
  });

  return {
    totalObjects: filtered.length,
    objects: filtered,
    countsByLabel
  };
}

/**
 * Bi-Temporal Image Comparison & Change Detection Engine
 */
export function detectBiTemporalChange(preImgData, postImgData, gsdMeters = 10) {
  const width = Math.min(preImgData.width, postImgData.width);
  const height = Math.min(preImgData.height, postImgData.height);
  const totalPixels = width * height;

  const dPre = preImgData.data;
  const dPost = postImgData.data;

  let changeCanvas = null;
  let changeImgData = null;
  let cData = null;
  if (typeof document !== 'undefined') {
    changeCanvas = document.createElement('canvas');
    changeCanvas.width = width;
    changeCanvas.height = height;
    const changeCtx = changeCanvas.getContext('2d');
    changeImgData = changeCtx.createImageData(width, height);
    cData = changeImgData.data;
  }

  let changedPixelCount = 0;
  let floodedCount = 0;
  let vegLossCount = 0;
  let urbanGrowthCount = 0;
  let recededWaterCount = 0;

  const pixelAreaKm2 = (gsdMeters * gsdMeters) / 1000000.0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idxPre = (y * preImgData.width + x) * 4;
      const idxPost = (y * postImgData.width + x) * 4;
      const idxOut = (y * width + x) * 4;

      const r1 = dPre[idxPre], g1 = dPre[idxPre + 1], b1 = dPre[idxPre + 2];
      const r2 = dPost[idxPost], g2 = dPost[idxPost + 1], b2 = dPost[idxPost + 2];

      const diffR = Math.abs(r1 - r2);
      const diffG = Math.abs(g1 - g2);
      const diffB = Math.abs(b1 - b2);
      const deltaMag = (diffR + diffG + diffB) / 3.0;

      // Classify nature of temporal change
      const wasWater = (b1 > r1 && b1 >= g1 * 0.8 && (r1 + g1 + b1) < 260) || ((r1 + g1 + b1) < 45);
      const isWater = (b2 > r2 && b2 >= g2 * 0.8 && (r2 + g2 + b2) < 260) || ((r2 + g2 + b2) < 45);
      const wasGreen = (g1 > r1 + 10 && g1 > b1 + 10);
      const isGreen = (g2 > r2 + 10 && g2 > b2 + 10);

      if (deltaMag > 28) {
        changedPixelCount++;

        if (!wasWater && isWater) {
          // Newly flooded area (Cyan / Blue)
          floodedCount++;
          if (cData) {
            cData[idxOut] = 14;     // R
            cData[idxOut + 1] = 165;// G
            cData[idxOut + 2] = 233;// B
            cData[idxOut + 3] = 200;// Alpha
          }
        } else if (wasGreen && !isGreen) {
          // Forest Loss / Wildfire Burn Scar (Bright Red)
          vegLossCount++;
          if (cData) {
            cData[idxOut] = 239;
            cData[idxOut + 1] = 68;
            cData[idxOut + 2] = 68;
            cData[idxOut + 3] = 200;
          }
        } else if (!wasWater && !wasGreen && (r2 + g2 + b2) > (r1 + g1 + b1 + 40)) {
          // Urban expansion / new construction / ground clearing (Purple)
          urbanGrowthCount++;
          if (cData) {
            cData[idxOut] = 168;
            cData[idxOut + 1] = 85;
            cData[idxOut + 2] = 247;
            cData[idxOut + 3] = 190;
          }
        } else if (wasWater && !isWater) {
          // Water recession / drying (Yellow)
          recededWaterCount++;
          if (cData) {
            cData[idxOut] = 234;
            cData[idxOut + 1] = 179;
            cData[idxOut + 2] = 8;
            cData[idxOut + 3] = 190;
          }
        } else {
          // General high-radiance delta (Orange)
          if (cData) {
            cData[idxOut] = 249;
            cData[idxOut + 1] = 115;
            cData[idxOut + 2] = 22;
            cData[idxOut + 3] = 170;
          }
        }
      } else {
        // No significant change
        if (cData) cData[idxOut + 3] = 0;
      }
    }
  }

  if (changeCanvas && changeImgData) {
    changeCanvas.getContext('2d').putImageData(changeImgData, 0, 0);
  }

  const changePercentage = Number(((changedPixelCount / totalPixels) * 100).toFixed(2));
  const changedAreaKm2 = Number((changedPixelCount * pixelAreaKm2).toFixed(2));

  return {
    totalPixels,
    changedPixelCount,
    changePercentage,
    changedAreaKm2,
    breakdown: {
      newlyFlooded: {
        pixels: floodedCount,
        percentage: Number(((floodedCount / totalPixels) * 100).toFixed(2)),
        areaKm2: Number((floodedCount * pixelAreaKm2).toFixed(2))
      },
      vegetationLoss: {
        pixels: vegLossCount,
        percentage: Number(((vegLossCount / totalPixels) * 100).toFixed(2)),
        areaKm2: Number((vegLossCount * pixelAreaKm2).toFixed(2))
      },
      urbanExpansion: {
        pixels: urbanGrowthCount,
        percentage: Number(((urbanGrowthCount / totalPixels) * 100).toFixed(2)),
        areaKm2: Number((urbanGrowthCount * pixelAreaKm2).toFixed(2))
      },
      waterRecession: {
        pixels: recededWaterCount,
        percentage: Number(((recededWaterCount / totalPixels) * 100).toFixed(2)),
        areaKm2: Number((recededWaterCount * pixelAreaKm2).toFixed(2))
      }
    },
    changeCanvas,
    changeDataUrl: changeCanvas ? changeCanvas.toDataURL('image/png') : null
  };
}
