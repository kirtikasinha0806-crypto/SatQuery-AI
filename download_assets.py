import os
import urllib.request
import json
from PIL import Image

PUBLIC_DATA_DIR = os.path.join(os.path.dirname(__file__), "public", "data", "scenarios")
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

# Define the 4 authentic remote sensing scenarios
SCENARIO_DEFS = [
    {
        "id": "assam_flood",
        "name": "Assam Brahmaputra Flood Inundation",
        "region": "Kaziranga & Brahmaputra Basin, Assam, India",
        "sensor": "Sentinel-2 MSI / MODIS Terra",
        "resolution": "10m / 250m Multispectral",
        "date_pre": "2021-03-15",
        "date_post": "2021-09-17",
        "crs": "EPSG:32646 (WGS 84 / UTM Zone 46N)",
        "bounds": {
            "min_lon": 92.80,
            "min_lat": 26.30,
            "max_lon": 93.90,
            "max_lat": 27.10
        },
        "center": {"lat": 26.70, "lon": 93.35},
        "description": "Massive seasonal monsoon flooding along the Brahmaputra river channel and surrounding Kaziranga floodplains. Shows dramatic inundation extent, sediment-laden floodwaters, and riverbed morphometry changes.",
        "tasks": ["change_detection", "lulc", "water_segmentation", "general_summary"],
        "urls": {
            "post": "https://upload.wikimedia.org/wikipedia/commons/6/6f/Flooding_along_the_Brahmaputra_River_%28MODIS_2021-09-17%29.jpg",
            "pre": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Floods_in_India_and_Bangladesh.jpg"
        }
    },
    {
        "id": "mumbai_port",
        "name": "Mumbai / JNPT Port & Maritime Activity",
        "region": "Jawaharlal Nehru Port & Mumbai Harbour, Maharashtra, India",
        "sensor": "Cartosat-2 / Sentinel-2 High-Res Optical",
        "resolution": "10m Optical (RGB)",
        "date": "2024-03-24",
        "crs": "EPSG:32643 (WGS 84 / UTM Zone 43N)",
        "bounds": {
            "min_lon": 72.80,
            "min_lat": 18.85,
            "max_lon": 73.05,
            "max_lat": 19.10
        },
        "center": {"lat": 18.95, "lon": 72.95},
        "description": "Jawaharlal Nehru Port (JNPT) container terminal docks, coastal shipping lanes, anchored vessels in Mumbai offshore anchorages, tidal mudflats, and urban industrial zones.",
        "tasks": ["object_counting", "lulc", "general_summary"],
        "urls": {
            "main": "https://upload.wikimedia.org/wikipedia/commons/d/de/Mumbai%2C_aerial_view%2C_satellite_image%2C_India_March_2004.jpg"
        }
    },
    {
        "id": "bengaluru_lulc",
        "name": "Bengaluru Urban Expansion & LULC Dynamics",
        "region": "Greater Bengaluru Metropolitan Region, Karnataka, India",
        "sensor": "Landsat-8 OLI / Sentinel-2 MSI",
        "resolution": "15m / 30m Multispectral",
        "date_pre": "2011-02-14",
        "date_post": "2018-03-20",
        "date": "2018-03-20",
        "crs": "EPSG:32643 (WGS 84 / UTM Zone 43N)",
        "bounds": {
            "min_lon": 77.40,
            "min_lat": 12.80,
            "max_lon": 77.80,
            "max_lat": 13.15
        },
        "center": {"lat": 12.9716, "lon": 77.5946},
        "description": "Multi-temporal urban sprawl across the Bengaluru tech corridor. Highlights built-up density growth, depletion of green vegetation canopy, and water body shrinkage across lakes.",
        "tasks": ["lulc", "change_detection", "object_counting", "general_summary"],
        "urls": {
            "pre": "https://upload.wikimedia.org/wikipedia/commons/a/aa/A_satellite_image_of_Bangalore%2C_India_%282011%29.jpg",
            "post": "https://upload.wikimedia.org/wikipedia/commons/8/8a/A_satellite_image_of_Bangalore%2C_India_%282018%29.jpg",
            "main": "https://upload.wikimedia.org/wikipedia/commons/8/8a/A_satellite_image_of_Bangalore%2C_India_%282018%29.jpg"
        }
    },
    {
        "id": "uttarakhand_wildfire",
        "name": "Uttarakhand Wildfire & Forest Cover Loss",
        "region": "Garhwal & Kumaon Himalayan Forests, Uttarakhand, India",
        "sensor": "Sentinel-2A MSI / Landsat-8",
        "resolution": "10m / 20m SWIR & Optical",
        "date_pre": "2024-03-01",
        "date_post": "2024-05-15",
        "crs": "EPSG:32644 (WGS 84 / UTM Zone 44N)",
        "bounds": {
            "min_lon": 78.80,
            "min_lat": 29.80,
            "max_lon": 79.90,
            "max_lat": 30.80
        },
        "center": {"lat": 30.30, "lon": 79.25},
        "description": "Severe spring wildfire outbreaks across pine and montane forest reserves in Uttarakhand. Burn scar propagation, smoke plume dispersion, and loss of dense canopy biomass.",
        "tasks": ["change_detection", "lulc", "vegetation_loss", "general_summary"],
        "urls": {
            "main": "https://upload.wikimedia.org/wikipedia/commons/a/a6/Wildfire_in_India_imaged_by_Sentinel-2A_at_night_ESA516826.jpg",
            "post": "https://upload.wikimedia.org/wikipedia/commons/a/a6/Wildfire_in_India_imaged_by_Sentinel-2A_at_night_ESA516826.jpg"
        }
    }
]

headers = {
    'User-Agent': 'SatQueryBot/1.0 (Earth Observation Academic; contact: satquery@isro-hackathon.org)'
}

manifest = []

for sc in SCENARIO_DEFS:
    sc_id = sc["id"]
    target_dir = os.path.join(PUBLIC_DATA_DIR, sc_id)
    os.makedirs(target_dir, exist_ok=True)
    
    local_images = {}
    for key, url in sc["urls"].items():
        ext = ".jpg"
        local_name = f"{key}{ext}"
        local_path = os.path.join(target_dir, local_name)
        
        print(f"Downloading [{sc_id}] {key} from {url}...")
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                with open(local_path, "wb") as f:
                    f.write(data)
            
            # Verify and optimize image format if needed
            with Image.open(local_path) as img:
                w, h = img.size
                print(f"  Downloaded: {w}x{h}, mode={img.mode}, {len(data)} bytes")
                # If image is very huge (> 2500px), resize slightly for lightweight laptop performance
                if max(w, h) > 2048:
                    ratio = 2048 / max(w, h)
                    new_size = (int(w * ratio), int(h * ratio))
                    resized = img.resize(new_size, Image.Resampling.LANCZOS)
                    resized.save(local_path, quality=90, optimize=True)
                    print(f"  Optimized for web viewer: {new_size[0]}x{new_size[1]}")
            
            local_images[key] = f"/data/scenarios/{sc_id}/{local_name}"
        except Exception as e:
            print(f"  Error downloading {key}: {e}")

    # Set default main image
    if "main" not in local_images and "post" in local_images:
        local_images["main"] = local_images["post"]
    elif "main" not in local_images and "pre" in local_images:
        local_images["main"] = local_images["pre"]
        
    sc_entry = {
        "id": sc["id"],
        "name": sc["name"],
        "region": sc["region"],
        "sensor": sc["sensor"],
        "resolution": sc["resolution"],
        "date": sc.get("date", sc.get("date_post", "2024-03-01")),
        "date_pre": sc.get("date_pre"),
        "date_post": sc.get("date_post"),
        "crs": sc["crs"],
        "bounds": sc["bounds"],
        "center": sc["center"],
        "description": sc["description"],
        "tasks": sc["tasks"],
        "images": local_images
    }
    
    with open(os.path.join(target_dir, "metadata.json"), "w") as f:
        json.dump(sc_entry, f, indent=2)
    manifest.append(sc_entry)

with open(os.path.join(PUBLIC_DATA_DIR, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2)

print("\nManifest updated successfully with", len(manifest), "scenarios!")
