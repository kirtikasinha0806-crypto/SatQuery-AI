import * as GeoTIFF from 'geotiff';

/**
 * Parses an ArrayBuffer or File as a GeoTIFF and extracts all geospatial metadata and raster canvas.
 */
export async function parseGeoTIFF(arrayBufferOrFile) {
  try {
    let tiff;
    if (arrayBufferOrFile instanceof ArrayBuffer) {
      tiff = await GeoTIFF.fromArrayBuffer(arrayBufferOrFile);
    } else if (arrayBufferOrFile instanceof Blob || arrayBufferOrFile instanceof File) {
      const buffer = await arrayBufferOrFile.arrayBuffer();
      tiff = await GeoTIFF.fromArrayBuffer(buffer);
    } else {
      throw new Error('Unsupported GeoTIFF input format');
    }

    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    const fileDirectory = image.getFileDirectory();
    const geoKeys = image.getGeoKeys?.() || {};

    // Extract Tiepoints and Pixel Scale
    const tiePoints = fileDirectory.ModelTiepoint || [];
    const pixelScale = fileDirectory.ModelPixelScale || [];
    const modelTransform = fileDirectory.ModelTransformation || null;

    let crs = 'Unknown / Unspecified';
    let epsg = null;

    if (geoKeys.ProjectedCSTypeGeoKey) {
      epsg = geoKeys.ProjectedCSTypeGeoKey;
      crs = `EPSG:${epsg} (Projected)`;
    } else if (geoKeys.GeographicTypeGeoKey) {
      epsg = geoKeys.GeographicTypeGeoKey;
      crs = `EPSG:${epsg} (Geographic / WGS84)`;
    } else if (fileDirectory.GeoKeyDirectory) {
      // Manual scan of GeoKeyDirectory
      const keys = fileDirectory.GeoKeyDirectory;
      for (let i = 4; i < keys.length; i += 4) {
        const keyId = keys[i];
        const val = keys[i + 3];
        if (keyId === 3072) {
          epsg = val;
          crs = `EPSG:${val} (Projected CRS)`;
        } else if (keyId === 2048 && !epsg) {
          epsg = val;
          crs = `EPSG:${val} (Geographic CRS)`;
        }
      }
    }

    // Check ASCII citations
    if (fileDirectory.GeoAsciiParams) {
      const citation = fileDirectory.GeoAsciiParams.replace(/\|/g, ' ').trim();
      if (citation) crs += ` [${citation}]`;
    }

    // Compute Bounding Box and Resolution
    let bounds = null;
    let center = null;
    let resolution = null;

    if (tiePoints.length >= 6 && pixelScale.length >= 2) {
      const minX = tiePoints[3];
      const maxY = tiePoints[4];
      const scaleX = pixelScale[0];
      const scaleY = pixelScale[1];
      const maxX = minX + width * scaleX;
      const minY = maxY - height * scaleY;

      bounds = { minX, minY, maxX, maxY };
      resolution = `${scaleX.toFixed(2)}m/px`;

      // Approximate lat/lon projection conversion for UTM
      if (epsg && epsg >= 32601 && epsg <= 32660) {
        // UTM Zone North
        const zone = epsg - 32600;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const approxCoords = utmToLatLon(centerX, centerY, zone, false);
        center = { lat: approxCoords.lat, lon: approxCoords.lon };
      } else if (minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90) {
        // Direct geographic degrees
        center = {
          lat: ((minY + maxY) / 2).toFixed(6),
          lon: ((minX + maxX) / 2).toFixed(6)
        };
      }
    }

    // Render Raster to HTML Canvas
    const rasters = await image.readRasters();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const rBand = rasters[0];
    const gBand = rasters[1] || rasters[0];
    const bBand = rasters[2] || rasters[0];

    const len = width * height;
    for (let i = 0; i < len; i++) {
      const idx = i * 4;
      data[idx] = Math.min(255, Math.max(0, rBand[i] || 0));
      data[idx + 1] = Math.min(255, Math.max(0, gBand[i] || 0));
      data[idx + 2] = Math.min(255, Math.max(0, bBand[i] || 0));
      data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    return {
      success: true,
      hasGeoMetadata: !!bounds,
      width,
      height,
      bands: samplesPerPixel || rasters.length || 3,
      crs: bounds ? crs : 'Location metadata unavailable',
      epsg,
      bounds,
      center,
      resolution: resolution || 'Unknown GSD',
      canvas,
      dataUrl: canvas.toDataURL('image/png'),
      rawTags: {
        tiePoints,
        pixelScale,
        geoKeys
      }
    };
  } catch (error) {
    console.error('GeoTIFF parse error:', error);
    return {
      success: false,
      hasGeoMetadata: false,
      error: error.message,
      crs: 'Location metadata unavailable'
    };
  }
}

/**
 * Standard UTM to Lat/Lon conversion helper
 */
function utmToLatLon(easting, northing, zone, southhemi = false) {
  const k0 = 0.9996;
  const a = 6378137.0; // WGS84 major axis
  const e = 0.0818191908426; // WGS84 eccentricity
  const e1sq = 0.00673949674227;

  let x = easting - 500000.0;
  let y = northing;
  if (southhemi) y -= 10000000.0;

  const m = y / k0;
  const mu = m / (a * (1.0 - Math.pow(e, 2) / 4.0 - 3.0 * Math.pow(e, 4) / 64.0 - 5.0 * Math.pow(e, 6) / 256.0));

  const e1 = (1.0 - Math.sqrt(1.0 - Math.pow(e, 2))) / (1.0 + Math.sqrt(1.0 - Math.pow(e, 2)));
  const j1 = 3.0 * e1 / 2.0 - 27.0 * Math.pow(e1, 3) / 32.0;
  const j2 = 21.0 * Math.pow(e1, 2) / 16.0 - 55.0 * Math.pow(e1, 4) / 32.0;
  const j3 = 151.0 * Math.pow(e1, 3) / 96.0;
  const j4 = 1097.0 * Math.pow(e1, 4) / 512.0;

  const fp = mu + j1 * Math.sin(2.0 * mu) + j2 * Math.sin(4.0 * mu) + j3 * Math.sin(6.0 * mu) + j4 * Math.sin(8.0 * mu);

  const c1 = e1sq * Math.pow(Math.cos(fp), 2);
  const t1 = Math.pow(Math.tan(fp), 2);
  const r1 = a * (1.0 - Math.pow(e, 2)) / Math.pow(1.0 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
  const n1 = a / Math.sqrt(1.0 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
  const d = x / (n1 * k0);

  const lat = fp - (n1 * Math.tan(fp) / r1) * (
    Math.pow(d, 2) / 2.0 -
    (5.0 + 3.0 * t1 + 10.0 * c1 - 4.0 * Math.pow(c1, 2) - 9.0 * e1sq) * Math.pow(d, 4) / 24.0 +
    (61.0 + 90.0 * t1 + 298.0 * c1 + 45.0 * Math.pow(t1, 2) - 252.0 * e1sq - 3.0 * Math.pow(c1, 2)) * Math.pow(d, 6) / 720.0
  );

  const lon = (zone - 1) * 6 - 180 + 3 + ((
    d -
    (1.0 + 2.0 * t1 + c1) * Math.pow(d, 3) / 6.0 +
    (5.0 - 2.0 * c1 + 28.0 * t1 - 3.0 * Math.pow(c1, 2) + 8.0 * e1sq + 24.0 * Math.pow(t1, 2)) * Math.pow(d, 5) / 120.0
  ) / Math.cos(fp)) * (180.0 / Math.PI);

  return {
    lat: Number((lat * 180.0 / Math.PI).toFixed(6)),
    lon: Number(lon.toFixed(6))
  };
}
