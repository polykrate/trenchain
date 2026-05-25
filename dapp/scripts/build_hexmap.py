#!/usr/bin/env python3
"""
Generate hex grid map v3: Tile -> Region -> Country hierarchy.
Bounds: lon -15..60, lat 20..65 (Mediterranean focus)
Grid: 90x60 (~5400 tiles)
Outputs: hex_map.json, hex_countries.json, hex_regions.json, hex_poi.json
"""

import json
import math
import os
import re
import unicodedata

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "..", "src", "data", "rules")
SHAPEFILE_PATH = "/tmp/ne_admin1/ne_10m_admin_1_states_provinces"
TERRAIN_LOOKUP_PATH = os.path.join(SCRIPT_DIR, "terrain_lookup.json")

# --- Map parameters ---
COLS = 90
ROWS = 60
SVG_W = 1200
SVG_H = 800
LON_MIN, LON_MAX = -15, 60
LAT_MIN, LAT_MAX = 20, 65

# Mercator projection
LAT_MIN_RAD = math.radians(LAT_MIN)
LAT_MAX_RAD = math.radians(LAT_MAX)
MERC_MIN = math.log(math.tan(math.pi / 4 + LAT_MIN_RAD / 2))
MERC_MAX = math.log(math.tan(math.pi / 4 + LAT_MAX_RAD / 2))

HEX_SIZE = min(SVG_W / (COLS * 1.5 + 0.5), SVG_H / (ROWS * math.sqrt(3))) * 0.97

# --- Country -> Game country mapping ---
COUNTRY_MAPPING = {
    "IS": "kalmar_union", "NO": "kalmar_union", "SE": "kalmar_union",
    "FI": "kalmar_union", "DK": "kalmar_union",
    "GB": "crown_england", "IE": "crown_england",
    "FR": "france",
    "DE": "holy_roman_empire", "AT": "holy_roman_empire", "CH": "holy_roman_empire",
    "NL": "holy_roman_empire", "BE": "holy_roman_empire", "LU": "holy_roman_empire",
    "CZ": "holy_roman_empire",
    "PT": "iberia", "ES": "iberia",
    "IT": "papal_states",
    "HU": "hungary", "RO": "hungary", "SK": "hungary",
    "HR": "balkans", "BA": "balkans", "RS": "balkans", "ME": "balkans",
    "AL": "balkans", "MK": "balkans", "XK": "balkans", "SI": "balkans",
    "BG": "balkans", "GR": "balkans", "CY": "balkans",
    "PL": "plc", "LT": "plc", "EE": "plc", "LV": "plc",
    "UA": "kyiv", "MD": "kyiv", "BY": "kyiv",
    "RU": "novgorod",
    "TR": "anatolia",
    "KZ": "golden_khanate", "UZ": "golden_khanate", "TM": "golden_khanate",
    "GE": "caucasus", "AM": "caucasus", "AZ": "caucasus",
    "LB": "new_antioch",
    "SY": "levant", "IL": "levant", "PS": "levant", "JO": "levant",
    "IR": "iron_sultanate", "IQ": "iron_sultanate",
    "SA": "arabia",
    "MA": "morocco",
    "DZ": "numidia", "TN": "numidia",
    "LY": "libya",
    "EG": "domain_mammon", "SD": "domain_mammon",
}

COUNTRIES_DEF = {
    "kalmar_union": {"name": "Kalmar Union", "faction": "FAITHFUL_CHRISTIAN"},
    "crown_england": {"name": "Crown of England", "faction": "FAITHFUL_CHRISTIAN"},
    "france": {"name": "Kingdom of France", "faction": "FAITHFUL_CHRISTIAN"},
    "holy_roman_empire": {"name": "Holy Roman Empire", "faction": "FAITHFUL_CHRISTIAN"},
    "iberia": {"name": "Castille-Aragon & Portugal", "faction": "FAITHFUL_CHRISTIAN"},
    "papal_states": {"name": "Papal States", "faction": "FAITHFUL_CHRISTIAN"},
    "hungary": {"name": "Kingdom of Hungary", "faction": "FAITHFUL_CHRISTIAN"},
    "balkans": {"name": "The Balkans", "faction": "FAITHFUL_CHRISTIAN"},
    "plc": {"name": "Polish-Lithuanian Commonwealth", "faction": "FAITHFUL_CHRISTIAN"},
    "kyiv": {"name": "Principality of Kyiv", "faction": "FAITHFUL_CHRISTIAN"},
    "novgorod": {"name": "Czardom of Novgorod", "faction": "FAITHFUL_CHRISTIAN"},
    "anatolia": {"name": "Heretic Anatolia", "faction": "HERETIC"},
    "golden_khanate": {"name": "Golden Khanate", "faction": "NEUTRAL"},
    "caucasus": {"name": "Alamut & Caucasus", "faction": "NEUTRAL"},
    "new_antioch": {"name": "Principality of New Antioch", "faction": "FAITHFUL_CHRISTIAN"},
    "levant": {"name": "The Levant", "faction": "HERETIC"},
    "iron_sultanate": {"name": "Sultanate of the Iron Wall", "faction": "FAITHFUL_ISLAMIC"},
    "morocco": {"name": "Kingdom of Morocco", "faction": "NEUTRAL"},
    "numidia": {"name": "Kingdom of Numidia", "faction": "FAITHFUL_ISLAMIC"},
    "libya": {"name": "Libya", "faction": "HERETIC"},
    "domain_mammon": {"name": "Domain of Mammon", "faction": "HERETIC"},
    "arabia": {"name": "Heretic Arabia", "faction": "HERETIC"},
}

# Turkey grouping (81 provinces -> 7 regions)
TR_REGION_GROUPS = {
    "Marmara": ["Istanbul", "Edirne", "Kirklareli", "Tekirdag", "Canakkale",
                "Balikesir", "Bursa", "Yalova", "Kocaeli", "Sakarya", "Bilecik"],
    "Aegean": ["Izmir", "Aydin", "Mugla", "Denizli", "Manisa", "Afyon", "Usak", "Kutahya"],
    "Mediterranean": ["Antalya", "Burdur", "Isparta", "Mersin", "Adana", "Hatay", "Osmaniye", "K. Maras"],
    "Central Anatolia": ["Ankara", "Konya", "Eskisehir", "Aksaray", "Karaman",
                         "Nevsehir", "Nigde", "Kirsehir", "Kirikkale", "Kayseri",
                         "Sivas", "Yozgat", "Cankiri", "Corum", "Amasya", "Tokat"],
    "Black Sea": ["Zonguldak", "Bartin", "Karabuk", "Kastamonu", "Sinop",
                  "Samsun", "Ordu", "Giresun", "Trabzon", "Rize", "Artvin",
                  "Gumushane", "Bayburt", "Bolu", "Duzce"],
    "Eastern Anatolia": ["Erzurum", "Erzincan", "Kars", "Agri", "Igdir",
                         "Ardahan", "Van", "Mus", "Bitlis", "Hakkari", "Bingol",
                         "Tunceli", "Elazig", "Malatya"],
    "Southeastern": ["Gaziantep", "Sanliurfa", "Diyarbakir", "Mardin",
                     "Batman", "Sirnak", "Siirt", "Adiyaman", "Kilis"],
}

RO_REGION_GROUPS = {
    "Wallachia": ["Arges", "Buzau", "Calarasi", "Dambovita", "Giurgiu",
                  "Ialomita", "Prahova", "Teleorman", "Ilfov", "Bucuresti"],
    "Oltenia": ["Dolj", "Gorj", "Mehedinti", "Olt", "Valcea"],
    "Muntenia": ["Braila", "Constanta", "Galati", "Tulcea", "Vrancea"],
    "Moldova": ["Bacau", "Botosani", "Iasi", "Neamt", "Suceava", "Vaslui"],
    "Transylvania": ["Alba", "Bistrita-Nasaud", "Brasov", "Cluj", "Covasna",
                     "Harghita", "Hunedoara", "Mures", "Salaj", "Sibiu"],
    "Banat": ["Arad", "Caras-Severin", "Timis"],
    "Crisana": ["Bihor", "Satu Mare"],
    "Maramures": ["Maramures"],
}

IR_REGION_GROUPS = {
    "Tehran": ["Tehran", "Alborz", "Qom", "Markazi", "Semnan", "Qazvin"],
    "Azerbaijan": ["East Azerbaijan", "West Azerbaijan", "Ardabil", "Zanjan"],
    "Kurdistan": ["Kurdistan", "Kermanshah", "Ilam", "Hamadan", "Lorestan"],
    "Fars": ["Fars", "Bushehr", "Kohgiluyeh and Boyer-Ahmad", "Chahar Mahaal and Bakhtiari"],
    "Isfahan": ["Isfahan", "Yazd", "Kerman"],
    "Khorasan": ["Razavi Khorasan", "North Khorasan", "South Khorasan",
                 "Golestan", "Mazandaran", "Gilan", "Hormozgan", "Sistan and Baluchestan"],
}

# Iron Wall tiles: crescent from Caspian to Persian Gulf
# North arm (NE toward Caspian Sea)
# Sultanate-Heretic border (Anatolia, Levant, Arabia)
IRON_WALL_TILES = {
    # North arm - Caspian to border (going SW from sea)
    (82,37),(81,37),(80,38),(79,38),(78,39),(77,39),
    # Border tiles (Sultanate touching Heretics)
    (76,40),(76,41),(77,41),(75,42),(77,42),
    (73,43),(74,43),(76,43),(72,44),(72,45),
    (69,46),(70,46),(71,46),(72,46),(68,47),
    (69,47),(70,48),(71,48),(72,49),(73,49),
    (74,50),(75,50),(77,50),(76,51),(78,51),
}

# --- Points of Interest ---
POIS = [
    {"id": "gate_of_hell", "name": "Gate of Hell", "lon": 35.23, "lat": 31.77, "type": "heretic_landmark",
     "lore": "Opened by the Knights Templar in 1099. Jerusalem destroyed in the ensuing cataclysm."},
    {"id": "new_antioch", "name": "New Antioch", "lon": 36.15, "lat": 36.2, "type": "faithful_fortress",
     "lore": "Home of All Our Hopes. Duke Constantine commands. 77 towers. Walls completed 1595."},
    {"id": "heretic_gibraltar", "name": "Sea Fortress of Gibraltar", "lon": -5.35, "lat": 36.14, "type": "heretic_fortress",
     "lore": "Captured 1666 (Year of Six Woes). Heretic base of operations against Europe."},
    {"id": "heretic_rijeka", "name": "Heretic Rijeka", "lon": 14.44, "lat": 45.33, "type": "heretic_fortress",
     "lore": "Stormed 1872. Fortified as launching point for European mainland invasion."},
    {"id": "heretic_avignon", "name": "Heretic Avignon", "lon": 4.81, "lat": 43.95, "type": "heretic_outpost",
     "lore": "Seat of the Antipope. Heretical schismatic enclave in southern France."},
    {"id": "alamut", "name": "Fortress of Alamut", "lon": 50.56, "lat": 36.43, "type": "neutral_fortress",
     "lore": "The Old Man in the Mountain. Besieged since 1165, never fallen. Outside the Iron Wall."},
    {"id": "breach_cordoba", "name": "Breach of Cordoba", "lon": -4.78, "lat": 37.88, "type": "battlefield",
     "lore": "Battle of 1910. Bloody stalemate. Heretic artillery devastates the city."},
    {"id": "britannia", "name": "Fortress of Britannia", "lon": -0.12, "lat": 51.5, "type": "faithful_fortress",
     "lore": "Completed 1907. Moving fortress, unrivalled artillery."},
    {"id": "white_cliffs", "name": "Fortress of the White Cliffs", "lon": 1.31, "lat": 51.13, "type": "faithful_fortress",
     "lore": "Dover. Begun 1670 after Gibraltar fell. Coastal defence against Heretic fleet."},
    {"id": "constantinople", "name": "Constantinople", "lon": 28.97, "lat": 41.0, "type": "heretic_landmark",
     "lore": "Fell to Kimaris, Marquis of Hell. Byzantium destroyed 1573."},
    {"id": "damascus_gate", "name": "Damascus Gate", "lon": 36.3, "lat": 33.5, "type": "wall_gate",
     "lore": "One of the Four Great Gates of the Iron Wall. Guarded by Buraq takwin."},
    {"id": "carcass_front", "name": "Carcass Front", "lon": 35.8, "lat": 35.5, "type": "battlefield",
     "lore": "1905: Supply Fleet wreckage creates the Carcass Front north of New Antioch."},
    {"id": "baghdad", "name": "Baghdad", "lon": 44.4, "lat": 33.3, "type": "faithful_city",
     "lore": "Capital of the Sultanate of the Iron Wall. Seat of the Sultan."},
    {"id": "new_damascus", "name": "New Damascus", "lon": 37.5, "lat": 34.5, "type": "faithful_city",
     "lore": "Major city of the Iron Sultanate, rebuilt within the Wall."},
    {"id": "tehran", "name": "Tehran", "lon": 51.4, "lat": 35.7, "type": "faithful_city",
     "lore": "Northern anchor of the Iron Wall. Great Sultanate fortress-city."},
    {"id": "vienna", "name": "Vienna", "lon": 16.37, "lat": 48.21, "type": "faithful_city",
     "lore": "Sword Congress of 1559. Decreed all Faithful nations tithe for New Antioch."},
    {"id": "wallachia", "name": "Wallachia", "lon": 26.1, "lat": 44.4, "type": "battlefield",
     "lore": "1573: Sacred Order of the Dragon halts heretics. A million impaled."},
    {"id": "acre", "name": "Acre", "lon": 35.08, "lat": 32.92, "type": "faithful_fortress",
     "lore": "1703: Hebrew Knights destroy the Templar stronghold."},
    {"id": "argos", "name": "City of Argos", "lon": 22.72, "lat": 37.63, "type": "divine_site",
     "lore": "1477: Taken by God. The city is no more."},
    {"id": "rome", "name": "Rome", "lon": 12.49, "lat": 41.9, "type": "faithful_city",
     "lore": "Seat of the Supreme Pontiff. Heart of the Papal States."},
    {"id": "paris", "name": "Paris", "lon": 2.35, "lat": 48.86, "type": "faithful_city",
     "lore": "Capital of the Kingdom of France."},
    {"id": "dis", "name": "Iron City of Dis", "lon": 35.23, "lat": 30.5, "type": "heretic_landmark",
     "lore": "Hell's war council. The Court of the Seven-Headed Serpent commands from here."},
]


def slugify(text):
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[-\s]+", "_", text).strip("_")
    return text


def project_to_svg(lon, lat):
    x = (lon - LON_MIN) / (LON_MAX - LON_MIN) * SVG_W
    lat_clamped = max(LAT_MIN + 0.01, min(LAT_MAX - 0.01, lat))
    lat_rad = math.radians(lat_clamped)
    merc = math.log(math.tan(math.pi / 4 + lat_rad / 2))
    y = SVG_H - (merc - MERC_MIN) / (MERC_MAX - MERC_MIN) * SVG_H
    return x, y


def hex_center(q, r):
    x = HEX_SIZE * (3.0 / 2 * q)
    y = HEX_SIZE * (math.sqrt(3) * (r + 0.5 * (q % 2)))
    x_offset = (SVG_W - HEX_SIZE * 1.5 * (COLS - 1)) / 2
    y_offset = (SVG_H - HEX_SIZE * math.sqrt(3) * ROWS) / 2
    return x + x_offset, y + y_offset


def point_in_polygon(px, py, polygon):
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def get_region_name(iso, admin_name, shapefile_region):
    if shapefile_region and shapefile_region.strip():
        return shapefile_region.strip()
    if iso == "TR":
        admin_lower = admin_name.lower()
        for group_name, provinces in TR_REGION_GROUPS.items():
            for p in provinces:
                if p.lower() in admin_lower or admin_lower in p.lower():
                    return group_name
        return "Central Anatolia"
    if iso == "RO":
        for group_name, provinces in RO_REGION_GROUPS.items():
            for p in provinces:
                if p.lower() in admin_name.lower() or admin_name.lower() in p.lower():
                    return group_name
        return "Wallachia"
    if iso == "IR":
        for group_name, provinces in IR_REGION_GROUPS.items():
            for p in provinces:
                if p.lower() in admin_name.lower() or admin_name.lower() in p.lower():
                    return group_name
        return "Tehran"
    return admin_name






def main():
    import shapefile as shp

    print("Reading shapefile...")
    sf = shp.Reader(SHAPEFILE_PATH)
    fields = [f[0] for f in sf.fields[1:]]
    name_idx = fields.index("name")
    iso_idx = fields.index("iso_a2")
    region_idx = fields.index("region")

    # Load terrain lookup
    terrain_lookup = {}
    if os.path.exists(TERRAIN_LOOKUP_PATH):
        with open(TERRAIN_LOOKUP_PATH, "r") as f:
            terrain_lookup = json.load(f)

    # Build province polygons
    print("Processing shapefile records...")
    game_isos = set(COUNTRY_MAPPING.keys())
    province_polygons = []

    for sr in sf.iterShapeRecords():
        rec = sr.record
        iso = rec[iso_idx]
        if iso == "-1" or iso not in game_isos:
            continue

        name = rec[name_idx] or ""
        sf_region = rec[region_idx] or ""
        region_name = get_region_name(iso, name, sf_region)
        country_id = COUNTRY_MAPPING[iso]
        region_id = f"{iso.lower()}_{slugify(region_name)}"

        # Terrain
        country_terrain = terrain_lookup.get(iso, {})
        terrain = country_terrain.get(name, None)
        if not terrain:
            name_lower = name.lower()
            for lname, lterrain in country_terrain.items():
                if lname.lower() in name_lower or name_lower in lname.lower():
                    terrain = lterrain
                    break
        if not terrain:
            terrain = "plains"

        shape = sr.shape
        if not shape.points:
            continue

        for part_idx in range(len(shape.parts)):
            start = shape.parts[part_idx]
            end_val = shape.parts[part_idx + 1] if part_idx + 1 < len(shape.parts) else len(shape.points)
            part_points = shape.points[start:end_val]
            if len(part_points) < 3:
                continue

            svg_polygon = []
            for lon, lat in part_points:
                if LON_MIN - 1 <= lon <= LON_MAX + 1 and LAT_MIN - 1 <= lat <= LAT_MAX + 1:
                    sx, sy = project_to_svg(lon, lat)
                    svg_polygon.append((sx, sy))

            if len(svg_polygon) < 3:
                continue

            province_polygons.append({
                "polygon": svg_polygon,
                "iso": iso,
                "terrain": terrain,
                "region_id": region_id,
                "region_name": region_name,
                "country_id": country_id,
            })

    print(f"Processed {len(province_polygons)} polygon parts")

    # Spatial index
    GRID_CELLS = 80
    cell_w = SVG_W / GRID_CELLS
    cell_h = SVG_H / GRID_CELLS
    spatial_grid = {}

    for idx, pp in enumerate(province_polygons):
        xs = [p[0] for p in pp["polygon"]]
        ys = [p[1] for p in pp["polygon"]]
        if not xs:
            continue
        min_gx = max(0, int(min(xs) / cell_w))
        max_gx = min(GRID_CELLS - 1, int(max(xs) / cell_w))
        min_gy = max(0, int(min(ys) / cell_h))
        max_gy = min(GRID_CELLS - 1, int(max(ys) / cell_h))
        for gx in range(min_gx, max_gx + 1):
            for gy in range(min_gy, max_gy + 1):
                spatial_grid.setdefault((gx, gy), []).append(idx)

    # Generate hex grid
    print(f"Generating {COLS}x{ROWS} hex grid...")
    tiles = []
    regions_found = {}
    country_tiles = {}  # country_id -> list of (q,r)
    land_count = 0

    for q in range(COLS):
        for r in range(ROWS):
            cx, cy = hex_center(q, r)
            if cx < -HEX_SIZE or cx > SVG_W + HEX_SIZE or cy < -HEX_SIZE or cy > SVG_H + HEX_SIZE:
                continue

            gx = min(GRID_CELLS - 1, max(0, int(cx / cell_w)))
            gy = min(GRID_CELLS - 1, max(0, int(cy / cell_h)))

            found = None
            candidates = spatial_grid.get((gx, gy), [])
            for idx in candidates:
                pp = province_polygons[idx]
                if point_in_polygon(cx, cy, pp["polygon"]):
                    found = pp
                    break

            is_wall = (q, r) in IRON_WALL_TILES

            if found:
                region_id = found["region_id"]
                if region_id not in regions_found:
                    regions_found[region_id] = {
                        "name": found["region_name"],
                        "country": found["country_id"],
                        "tiles": [],
                    }
                regions_found[region_id]["tiles"].append([q, r])
                country_tiles.setdefault(found["country_id"], []).append([q, r])

                tiles.append({
                    "q": q, "r": r,
                    "t": "iron_wall" if is_wall else found["terrain"],
                    "g": region_id,
                    "w": is_wall,
                })
                land_count += 1
            else:
                tiles.append({"q": q, "r": r, "t": "sea", "g": None, "w": False})

    print(f"Generated {len(tiles)} hexes ({land_count} land, {len(tiles) - land_count} sea)")
    print(f"Found {len(regions_found)} distinct regions")

    # Assign POIs to tiles
    poi_output = []
    for poi in POIS:
        px, py = project_to_svg(poi["lon"], poi["lat"])
        best_tile = None
        best_dist = float('inf')
        for tile in tiles:
            if tile["t"] == "sea" and poi["type"] != "heretic_fortress":
                continue
            tcx, tcy = hex_center(tile["q"], tile["r"])
            d = math.sqrt((px - tcx) ** 2 + (py - tcy) ** 2)
            if d < best_dist:
                best_dist = d
                best_tile = tile
        poi_entry = {
            "id": poi["id"],
            "name": poi["name"],
            "tile": [best_tile["q"], best_tile["r"]] if best_tile else None,
            "type": poi["type"],
            "lore": poi["lore"],
        }
        poi_output.append(poi_entry)

    # Control status per country based on lore
    COUNTRY_CONTROL = {
        "kalmar_union": "faithful",
        "crown_england": "faithful",
        "france": "contested",        # Avignon heretic enclave, coastal raids
        "holy_roman_empire": "faithful",
        "iberia": "contested",         # Cordoba front, Gibraltar threat
        "papal_states": "faithful",
        "hungary": "faithful",
        "balkans": "contested",        # Rijeka heretic base, Wallachia frontline
        "plc": "faithful",
        "kyiv": "faithful",
        "novgorod": "faithful",
        "anatolia": "heretic",
        "golden_khanate": "neutral",
        "caucasus": "neutral",
        "new_antioch": "faithful",
        "levant": "heretic",
        "iron_sultanate": "faithful",
        "morocco": "neutral",
        "numidia": "faithful",
        "libya": "heretic",
        "domain_mammon": "heretic",
        "arabia": "heretic",
    }

    # Compute country label tiles (centroid of tiles)
    countries_output = {}
    for cid, cdef in COUNTRIES_DEF.items():
        ctiles = country_tiles.get(cid, [])
        if ctiles:
            avg_q = sum(t[0] for t in ctiles) / len(ctiles)
            avg_r = sum(t[1] for t in ctiles) / len(ctiles)
            best = min(ctiles, key=lambda t: (t[0] - avg_q) ** 2 + (t[1] - avg_r) ** 2)
            label_tile = best
        else:
            label_tile = [0, 0]
        region_ids = [rid for rid, rdef in regions_found.items() if rdef["country"] == cid]
        countries_output[cid] = {
            "name": cdef["name"],
            "faction": cdef["faction"],
            "control": COUNTRY_CONTROL.get(cid, "neutral"),
            "label_tile": label_tile,
            "regions": region_ids,
        }

    # Write outputs
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # hex_map.json
    hex_map = {
        "meta": {
            "cols": COLS, "rows": ROWS,
            "hex_size": round(HEX_SIZE, 2),
            "svg_width": SVG_W, "svg_height": SVG_H,
            "bounds": [LON_MIN, LON_MAX, LAT_MIN, LAT_MAX],
        },
        "tiles": tiles,
    }
    path = os.path.join(OUTPUT_DIR, "hex_map.json")
    with open(path, "w") as f:
        json.dump(hex_map, f, separators=(",", ":"))
    print(f"  hex_map.json: {os.path.getsize(path) / 1024:.0f} KB")

    # hex_countries.json
    path = os.path.join(OUTPUT_DIR, "hex_countries.json")
    with open(path, "w") as f:
        json.dump(countries_output, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  hex_countries.json: {os.path.getsize(path) / 1024:.0f} KB")

    # hex_regions.json
    path = os.path.join(OUTPUT_DIR, "hex_regions.json")
    with open(path, "w") as f:
        json.dump(regions_found, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  hex_regions.json: {os.path.getsize(path) / 1024:.0f} KB")

    # hex_poi.json
    path = os.path.join(OUTPUT_DIR, "hex_poi.json")
    with open(path, "w") as f:
        json.dump(poi_output, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  hex_poi.json: {os.path.getsize(path) / 1024:.0f} KB")

    # Stats
    wall_tiles = sum(1 for t in tiles if t.get("w"))
    print(f"\nIron Wall tiles: {wall_tiles}")
    print(f"POIs placed: {len(poi_output)}")

    from collections import Counter
    cc = Counter()
    for rid, rdef in regions_found.items():
        cc[rdef["country"]] += 1
    print("\nRegions per country:")
    for cid, count in cc.most_common():
        name = COUNTRIES_DEF.get(cid, {}).get("name", cid)
        tiles_n = len(country_tiles.get(cid, []))
        print(f"  {name:35} {count:>3} regions, {tiles_n:>4} tiles")


if __name__ == "__main__":
    main()
