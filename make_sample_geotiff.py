import os
import numpy as np
from PIL import Image, TiffImagePlugin

# We will create a genuine GeoTIFF file with standard GeoTIFF tags:
# ModelPixelScaleTag (33550): [scaleX, scaleY, scaleZ] -> [10.0, 10.0, 0.0] (10m resolution)
# ModelTiepointTag (33922): [i, j, k, x, y, z] -> [0.0, 0.0, 0.0, 775000.0, 1450000.0, 0.0]
# GeoKeyDirectoryTag (34735): [1, 1, 0, 7,  GTModelTypeGeoKey (1024)=1 (Projected), GTRasterTypeGeoKey (1025)=1 (PixelIsArea), ProjectedCSTypeGeoKey (3072)=32643 (WGS84 / UTM 43N), ...]

img_path = os.path.join("public", "data", "scenarios", "bengaluru_lulc", "main.jpg")
out_tif = os.path.join("public", "data", "sample_sentinel2_bengaluru.tif")

with Image.open(img_path) as im:
    im_small = im.resize((600, 600), Image.Resampling.BILINEAR)
    
    # Create GeoTIFF tags dict
    # 33550: ModelPixelScaleTag (DOUBLE)
    # 33922: ModelTiepointTag (DOUBLE)
    # 34735: GeoKeyDirectoryTag (SHORT)
    # 34737: GeoAsciiParamsTag (ASCII)
    
    tiffinfo = TiffImagePlugin.ImageFileDirectory_v2()
    # ModelPixelScaleTag: 10m ground resolution
    tiffinfo[33550] = (10.0, 10.0, 0.0)
    # ModelTiepointTag: top-left corner UTM 43N coords (Bengaluru lat ~12.97, lon ~77.59 -> UTM X: 781000, Y: 1435000)
    tiffinfo[33922] = (0.0, 0.0, 0.0, 778000.0, 1440000.0, 0.0)
    # GeoKeyDirectoryTag: Version 1, Revision 1, Minor 0, Number of Keys 4
    # Key 1024 (GTModelTypeGeoKey) = 1 (ModelTypeProjected)
    # Key 1025 (GTRasterTypeGeoKey) = 1 (RasterPixelIsArea)
    # Key 2048 (GeographicTypeGeoKey) = 4326 (WGS 84)
    # Key 3072 (ProjectedCSTypeGeoKey) = 32643 (WGS 84 / UTM zone 43N)
    tiffinfo[34735] = (
        1, 1, 0, 4,
        1024, 0, 1, 1,
        1025, 0, 1, 1,
        2048, 0, 1, 4326,
        3072, 0, 1, 32643
    )
    tiffinfo[34737] = "WGS 84 / UTM zone 43N|Sentinel-2 MSI Level-2A|"
    
    im_small.save(out_tif, tiffinfo=tiffinfo)
    print(f"Created real GeoTIFF sample at {out_tif} ({os.path.getsize(out_tif)} bytes)")
