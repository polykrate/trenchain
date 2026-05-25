"""
Build world_map.json from Natural Earth Admin 1 shapefile.

Requirements:
  pip install pyshp

Usage:
  python scripts/build_worldmap.py

Input: /tmp/ne_admin1/ne_10m_admin_1_states_provinces.shp
Output: src/data/rules/world_map.json
"""

import shapefile
import json
import math
import os

# --- Configuration ---

SHAPEFILE_PATH = "/tmp/ne_admin1/ne_10m_admin_1_states_provinces"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "data", "rules", "world_map.json")

LON_MIN, LON_MAX = -25, 70
LAT_MIN, LAT_MAX = 12, 72
SVG_W, SVG_H = 1200, 850
SIMPLIFY_EPSILON = 1.2
MAX_SCALERANK = 99

GAME_COUNTRIES = {
    'ES', 'PT', 'FR', 'GB', 'IE', 'BE', 'NL', 'LU', 'DE', 'AT', 'CH', 'CZ',
    'IT', 'HR', 'BA', 'RS', 'ME', 'AL', 'MK', 'XK', 'SI', 'BG',
    'GR', 'CY', 'HU', 'SK', 'RO', 'UA', 'MD', 'BY',
    'RU', 'EE', 'LT', 'LV', 'PL', 'NO', 'SE', 'FI', 'IS', 'DK',
    'TR', 'KZ', 'UZ', 'TM', 'GE', 'AM', 'AZ',
    'SY', 'LB', 'IL', 'PS', 'JO', 'IQ', 'IR', 'SA',
    'MA', 'DZ', 'TN', 'LY', 'EG', 'SD',
}

REGION_MAPPING = {
    "kalmar_union": {
        "name": "Kalmar Union",
        "biome": "snow",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["IS", "NO", "SE", "FI", "DK"]
    },
    "crown_england": {
        "name": "Crown of England",
        "biome": "forest",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["GB", "IE"]
    },
    "france": {
        "name": "Kingdom of France",
        "biome": "plains",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["FR"]
    },
    "holy_roman_empire": {
        "name": "Holy Roman Empire",
        "biome": "plains",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["DE", "AT", "CH", "NL", "BE", "LU", "CZ"]
    },
    "iberia": {
        "name": "Castille-Aragon & Portugal",
        "biome": "hills",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["PT", "ES"]
    },
    "papal_states": {
        "name": "Papal States",
        "biome": "hills",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["IT"]
    },
    "hungary": {
        "name": "Kingdom of Hungary",
        "biome": "plains",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["HU", "RO", "SK"]
    },
    "balkans": {
        "name": "The Balkans",
        "biome": "mountain",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["HR", "BA", "RS", "ME", "AL", "MK", "XK", "SI", "BG", "GR", "CY"]
    },
    "plc": {
        "name": "Polish-Lithuanian Commonwealth",
        "biome": "plains",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["PL", "LT", "EE", "LV"]
    },
    "kyiv": {
        "name": "Principality of Kyiv",
        "biome": "plains",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["UA", "MD", "BY"]
    },
    "novgorod": {
        "name": "Czardom of Novgorod",
        "biome": "forest",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["RU"]
    },
    "anatolia": {
        "name": "Anatolia",
        "biome": "steppe",
        "faction": "HERETIC",
        "corrupted": True,
        "countries": ["TR"]
    },
    "golden_khanate": {
        "name": "Golden Khanate",
        "biome": "steppe",
        "faction": None,
        "corrupted": False,
        "countries": ["KZ", "UZ", "TM"]
    },
    "caucasus": {
        "name": "Alamut & Caucasus",
        "biome": "mountain",
        "faction": None,
        "corrupted": False,
        "countries": ["GE", "AM", "AZ"]
    },
    "new_antioch": {
        "name": "New Antioch",
        "biome": "mediterranean",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["LB"]
    },
    "levant": {
        "name": "The Levant",
        "biome": "desert",
        "faction": "HERETIC",
        "corrupted": True,
        "countries": ["SY", "IL", "PS", "JO"]
    },
    "iron_sultanate": {
        "name": "Iron Sultanate",
        "biome": "steppe",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["IR", "IQ", "SA"]
    },
    "morocco": {
        "name": "Kingdom of Morocco",
        "biome": "desert",
        "faction": None,
        "corrupted": False,
        "countries": ["MA"]
    },
    "numidia": {
        "name": "Kingdom of Numidia",
        "biome": "desert",
        "faction": "FAITHFUL",
        "corrupted": False,
        "countries": ["DZ", "TN"]
    },
    "libya": {
        "name": "Libya",
        "biome": "desert",
        "faction": "HERETIC",
        "corrupted": True,
        "countries": ["LY"]
    },
    "domain_mammon": {
        "name": "Domain of Mammon",
        "biome": "volcanic",
        "faction": "HERETIC",
        "corrupted": True,
        "countries": ["EG", "SD"]
    },
}
BIOMES = {
    "sea": {"name": "Sea", "color": "#1e3a5f"},
    "tundra": {"name": "Tundra", "color": "#c8dce6"},
    "taiga": {"name": "Taiga", "color": "#2e5040"},
    "temperate_forest": {"name": "Temperate Forest", "color": "#3a6b3a"},
    "plains": {"name": "Plains", "color": "#6a9a4a"},
    "mediterranean": {"name": "Mediterranean", "color": "#7aaa4a"},
    "mountain": {"name": "Mountain", "color": "#7a7068"},
    "steppe": {"name": "Steppe", "color": "#b0a060"},
    "semi_arid": {"name": "Semi-Arid", "color": "#c8b050"},
    "desert": {"name": "Desert", "color": "#e0c840"},
    "marsh": {"name": "Marsh", "color": "#4a7a5a"},
    "volcanic": {"name": "Hellfire Waste", "color": "#3a0a0a"},
}

# --- Terrain assignment via lookup ---

_terrain_lookup = {}
_LOOKUP_PATHS = [
    os.path.join(os.path.dirname(__file__), "terrain_lookup.json"),
    "/tmp/terrain_lookup.json",
]
for _path in _LOOKUP_PATHS:
    if os.path.exists(_path):
        with open(_path, "r", encoding="utf-8") as _f:
            _terrain_lookup = json.load(_f)
        break


def assign_terrain(iso, lat, lon, name):
    """Assign terrain from research lookup, with lat/lon fallback."""
    # Try exact name match from lookup
    country_data = _terrain_lookup.get(iso, {})
    if name in country_data:
        return country_data[name]

    # Try case-insensitive match
    name_lower = name.lower()
    for lookup_name, terrain in country_data.items():
        if lookup_name.lower() == name_lower:
            return terrain

    # Try partial match (province name contains lookup name or vice versa)
    for lookup_name, terrain in country_data.items():
        if lookup_name.lower() in name_lower or name_lower in lookup_name.lower():
            return terrain

    # Fallback heuristics for unmatched provinces
    if iso == 'IS':
        return "tundra"
    if iso in ('SA', 'SD'):
        if lat > 20:
            return "semi_arid"
        return "desert"
    if iso in ('EG', 'LY'):
        if lat > 31:
            return "mediterranean"
        return "desert"
    if iso in ('DZ', 'MA', 'TN'):
        if lat > 35:
            return "mediterranean"
        if lat > 32:
            return "semi_arid"
        return "desert"
    if iso in ('KZ', 'UZ', 'TM'):
        return "steppe"
    if iso in ('IQ', 'IR', 'SY', 'JO'):
        if lat > 35:
            return "steppe"
        return "desert"
    if iso == 'TR':
        if lat > 40 and lon < 35:
            return "temperate_forest"
        if lat < 37:
            return "mediterranean"
        return "steppe"
    if iso == 'RU':
        if lat > 65:
            return "tundra"
        if lat > 58:
            return "taiga"
        if lat > 52:
            return "temperate_forest"
        return "steppe"
    if lat > 66:
        return "tundra"
    if lat > 60:
        return "taiga"
    if lat > 45:
        return "temperate_forest"
    if lat > 35:
        return "steppe"
    return "desert"

# --- Projection ---

LAT_MIN_RAD = math.radians(LAT_MIN)
LAT_MAX_RAD = math.radians(LAT_MAX)
MERC_MIN = math.log(math.tan(math.pi / 4 + LAT_MIN_RAD / 2))
MERC_MAX = math.log(math.tan(math.pi / 4 + LAT_MAX_RAD / 2))


def project(lon, lat):
    x = (lon - LON_MIN) / (LON_MAX - LON_MIN) * SVG_W
    lat_clamped = max(LAT_MIN + 0.01, min(LAT_MAX - 0.01, lat))
    lat_rad = math.radians(lat_clamped)
    merc = math.log(math.tan(math.pi / 4 + lat_rad / 2))
    y = SVG_H - (merc - MERC_MIN) / (MERC_MAX - MERC_MIN) * SVG_H
    return round(x, 1), round(y, 1)


# --- Douglas-Peucker simplification ---

def point_line_dist(p, a, b):
    x0, y0 = p
    x1, y1 = a
    x2, y2 = b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2)
    t = max(0, min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy)))
    px, py = x1 + t * dx, y1 + t * dy
    return math.sqrt((x0 - px) ** 2 + (y0 - py) ** 2)


def douglas_peucker(points, epsilon):
    if len(points) <= 2:
        return points
    dmax = 0
    index = 0
    end = len(points) - 1
    for i in range(1, end):
        d = point_line_dist(points[i], points[0], points[end])
        if d > dmax:
            index = i
            dmax = d
    if dmax > epsilon:
        left = douglas_peucker(points[: index + 1], epsilon)
        right = douglas_peucker(points[index:], epsilon)
        return left[:-1] + right
    else:
        return [points[0], points[end]]


# --- Shape to SVG path ---

def shape_to_svg_path(shape):
    parts = []
    for part_idx, part_start in enumerate(shape.parts):
        end = shape.parts[part_idx + 1] if part_idx + 1 < len(shape.parts) else len(shape.points)
        raw_points = shape.points[part_start:end]

        projected = []
        for lon, lat in raw_points:
            if LON_MIN - 5 <= lon <= LON_MAX + 5 and LAT_MIN - 5 <= lat <= LAT_MAX + 5:
                projected.append(project(lon, lat))

        if len(projected) < 3:
            continue

        simplified = douglas_peucker(projected, SIMPLIFY_EPSILON)
        if len(simplified) < 3:
            continue

        coords = [f"M{simplified[0][0]},{simplified[0][1]}"]
        for p in simplified[1:]:
            coords.append(f"L{p[0]},{p[1]}")
        coords.append("Z")
        parts.append("".join(coords))

    return " ".join(parts)


# --- Build reverse lookup: country ISO -> region_id ---

def build_country_to_region():
    mapping = {}
    for region_id, region_data in REGION_MAPPING.items():
        for country_iso in region_data["countries"]:
            mapping[country_iso] = region_id
    return mapping


# --- Main ---

def main():
    print("Reading shapefile...")
    sf = shapefile.Reader(SHAPEFILE_PATH)
    fields = [f[0] for f in sf.fields[1:]]
    iso_a2_idx = fields.index("iso_a2")
    name_idx = fields.index("name")
    name_en_idx = fields.index("name_en")
    scalerank_idx = fields.index("scalerank")
    admin_idx = fields.index("admin")

    country_to_region = build_country_to_region()
    lat_idx = fields.index("latitude")
    lon_idx = fields.index("longitude")

    provinces = []
    skipped = 0

    for rec, shape in zip(sf.records(), sf.shapes()):
        iso = rec[iso_a2_idx]
        rank = rec[scalerank_idx]

        if iso not in GAME_COUNTRIES:
            continue
        if rank > MAX_SCALERANK:
            continue

        name = rec[name_en_idx] or rec[name_idx] or "Unknown"
        country_name = rec[admin_idx] or iso
        lat = float(rec[lat_idx]) if rec[lat_idx] else 0
        lon = float(rec[lon_idx]) if rec[lon_idx] else 0

        path = shape_to_svg_path(shape)
        if not path:
            skipped += 1
            continue

        terrain = assign_terrain(iso, lat, lon, name)

        provinces.append({
            "iso": iso,
            "name": name,
            "country": country_name,
            "terrain": terrain,
            "path": path,
        })

    print(f"Processed {len(provinces)} provinces (skipped {skipped} with no visible geometry)")

    output = {
        "meta": {
            "viewBox": f"0 0 {SVG_W} {SVG_H}",
            "description": "Generated from Natural Earth Admin 1 (10m). Mercator projection.",
        },
        "biomes": BIOMES,
        "region_mapping": REGION_MAPPING,
        "provinces": provinces,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"Written to {OUTPUT_PATH} ({size_kb:.0f} KB)")
    print(f"Regions: {len(REGION_MAPPING)}, Provinces: {len(provinces)}")


if __name__ == "__main__":
    main()
