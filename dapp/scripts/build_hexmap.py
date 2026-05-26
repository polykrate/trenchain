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
    "balkans": {"name": "Heretic Balkans", "faction": "HERETIC"},
    "plc": {"name": "Polish-Lithuanian Commonwealth", "faction": "FAITHFUL_CHRISTIAN"},
    "kyiv": {"name": "Principality of Kyiv", "faction": "FAITHFUL_CHRISTIAN"},
    "novgorod": {"name": "Czardom of Novgorod", "faction": "FAITHFUL_CHRISTIAN"},
    "anatolia": {"name": "Heretic Anatolia", "faction": "HERETIC"},
    "golden_khanate": {"name": "Golden Khanate", "faction": "NEUTRAL"},
    "caucasus": {"name": "Heretic Caucasus", "faction": "HERETIC"},
    "new_antioch": {"name": "Principality of New Antioch", "faction": "FAITHFUL_CHRISTIAN"},
    "levant": {"name": "The Levant", "faction": "HERETIC"},
    "iron_sultanate": {"name": "Sultanate of the Iron Wall", "faction": "FAITHFUL_ISLAMIC"},
    "morocco": {"name": "Kingdom of Morocco", "faction": "NEUTRAL"},
    "numidia": {"name": "Kingdom of Numidia", "faction": "FAITHFUL_ISLAMIC"},
    "libya": {"name": "Libya", "faction": "HERETIC"},
    "domain_mammon": {"name": "Domain of Mammon", "faction": "HERETIC"},
    "arabia": {"name": "Heretic Arabia", "faction": "HERETIC"},
    # Heretic enclaves within faithful territories
    "heretic_avignon": {"name": "Heretic Avignon", "faction": "HERETIC"},
    "heretic_cordoba": {"name": "Heretic Córdoba", "faction": "HERETIC"},
    "heretic_finland": {"name": "Heretic Finland", "faction": "HERETIC"},
    "heretic_scotland": {"name": "Heretic Scotland", "faction": "HERETIC"},
    "heretic_tanger": {"name": "Heretic Tanger", "faction": "HERETIC"},
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
                     "Harghita", "Hunedoara", "Mures", "Salaj", "Sibiu",
                     "Arad", "Caras-Severin", "Timis", "Bihor", "Satu Mare",
                     "Maramures"],
}

HU_REGION_GROUPS = {
    "Hungary": ["Central Hungary", "Central Transdanubia", "Great Southern Plain",
                "Northern Great Plain", "Northern Hungary", "Southern Transdanubia",
                "Western Transdanubia"],
}

SK_ISO_REGION = "Slovakia"

IR_REGION_GROUPS = {
    "Tehran": ["Tehran", "Alborz", "Qom", "Markazi", "Semnan", "Qazvin"],
    "Azerbaijan": ["East Azerbaijan", "West Azerbaijan", "Ardabil", "Zanjan"],
    "Western Iran": ["Kurdistan", "Kermanshah", "Ilam", "Hamadan", "Lorestan"],
    "Fars": ["Fars", "Bushehr", "Kohgiluyeh and Boyer-Ahmad", "Chahar Mahaal and Bakhtiari"],
    "Isfahan": ["Isfahan", "Yazd", "Kerman"],
    "Khorasan": ["Razavi Khorasan", "North Khorasan", "South Khorasan",
                 "Golestan", "Mazandaran", "Gilan", "Hormozgan", "Sistan and Baluchestan"],
}

IQ_ISO_REGION = "Iraq"

# Balkans: group all admin regions per country into one region
BALKANS_ISO_REGIONS = {
    "HR": "Croatia",
    "BA": "Bosnia",
    "RS": "Serbia",
    "ME": "Montenegro",
    "AL": "Albania",
    "MK": "North Macedonia",
    "XK": "Kosovo",
    "SI": "Slovenia",
    "BG": "Bulgaria",
    "GR": "Greece",
    "CY": "Cyprus",
}

# Caucasus: one region per country
CAUCASUS_ISO_REGIONS = {
    "GE": "Georgia",
    "AM": "Armenia",
    "AZ": "Azerbaijan",
}

# Germany -> ~8 game regions
DE_REGION_GROUPS = {
    "Bavaria": ["Bayern"],
    "Rhineland": ["Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland"],
    "Saxony": ["Sachsen", "Sachsen-Anhalt", "Thüringen", "Thuringen"],
    "Brandenburg": ["Brandenburg", "Berlin", "Mecklenburg-Vorpommern"],
    "Lower Saxony": ["Niedersachsen", "Bremen", "Hamburg", "Schleswig-Holstein"],
    "Hesse": ["Hessen"],
    "Swabia": ["Baden-Württemberg"],
}

# Austria/Switzerland/Netherlands/Belgium/Czechia -> one region each (they're in HRE)
HRE_MINOR_ISO_REGIONS = {
    "AT": "Austria",
    "CH": "Switzerland",
    "NL": "Netherlands",
    "BE": "Flanders",
    "LU": "Luxembourg",
    "CZ": "Bohemia",
}

# Poland -> ~5 game regions
PL_REGION_GROUPS = {
    "Greater Poland": ["Greater Poland", "Kuyavian-Pomeranian", "Łódź", "Lodz"],
    "Pomerania": ["Pomeranian", "West Pomeranian"],
    "Masovia": ["Masovian", "Lublin", "Podlaskie", "Świętokrzyskie", "Swietokrzyskie"],
    "Silesia": ["Lower Silesian", "Opole", "Silesian"],
    "Prussia": ["Warmian-Masurian", "Lesser Poland", "Subcarpathian"],
}

# Lithuania/Latvia/Estonia -> one region each
PLC_BALTIC_ISO_REGIONS = {
    "LT": "Lithuania",
    "LV": "Latvia",
    "EE": "Estonia",
}

# Ukraine/Belarus/Moldova -> historical governorates (early 20th century)
UA_REGION_GROUPS = {
    "Galicia": ["L'viv", "Ternopil", "Ivano-Frankivs", "Transcarpathia", "Chernivtsi"],
    "Volhynia": ["Volyn", "Rivne", "Khmel'nyts"],
    "Kyiv": ["Kiev", "Zhytomyr"],
    "Podolia": ["Vinnytsya", "Cherkasy"],
    "Poltava": ["Poltava", "Kirovohrad"],
    "Sloboda": ["Kharkiv", "Sumy", "Dnipropetrovs"],
    "Donbass": ["Donets'k", "Luhans'k"],
    "Novorossiya": ["Odessa", "Mykolayiv", "Kherson", "Zaporizhzh"],
    "Chernigov": ["Chernihiv"],
}

BY_REGION_GROUPS = {
    "Minsk": ["Minsk", "Gomel", "Mogilev"],
    "Grodno": ["Vitebsk", "Grodno", "Brest"],
}

MD_ISO_REGION = "Moldova"

# Britain -> game regions (mapped from shapefile region field)
GB_SF_REGION_MAP = {
    "South East": "Southern England",
    "South West": "Southern England",
    "Greater London": "Southern England",
    "East": "Eastern England",
    "East Midlands": "Eastern England",
    "North East": "Northern England",
    "North West": "Northern England",
    "Yorkshire and the Humber": "Northern England",
    "West Midlands": "Northern England",
    "East Wales": "Wales",
    "West Wales and the Valleys": "Wales",
    "Eastern": "Scottish Lowlands",
    "North Eastern": "Scottish Lowlands",
    "South Western": "Scottish Lowlands",
    "Highlands and Islands": "Highlands and Islands",
    "Northern Ireland": "Northern Ireland",
}

IE_ISO_REGION = "Ireland"

# France -> historical provinces (early 20th century names)
FR_SF_REGION_MAP = {
    "Île-de-France": "Île-de-France",
    "Centre-Val de Loire": "Touraine",
    "Bourgogne-Franche-Comté": "Bourgogne",
    "Normandie": "Normandie",
    "Hauts-de-France": "Picardie",
    "Grand Est": "Lorraine",
    "Pays de la Loire": "Anjou",
    "Bretagne": "Bretagne",
    "Nouvelle-Aquitaine": "Aquitaine",
    "Occitanie": "Languedoc",
    "Auvergne-Rhône-Alpes": "Dauphiné",
    "Provence-Alpes-Côte d'Azur": "Provence",
    "Corse": "Corse",
}

# Scandinavia -> historical lands
SE_REGION_GROUPS = {
    "Götaland": ["Skåne", "Blekinge", "Kronoberg", "Kalmar", "Jönköping",
                 "Halland", "Västra Götaland", "Östergötland", "Gotland"],
    "Svealand": ["Stockholm", "Uppsala", "Södermanland", "Västmanland",
                 "Örebro", "Värmland", "Dalarna", "Gävleborg"],
    "Norrland": ["Västernorrland", "Jämtland", "Västerbotten", "Norrbotten"],
}

NO_REGION_GROUPS = {
    "Østlandet": ["Oslo", "Akershus", "Østfold", "Buskerud", "Vestfold",
                  "Telemark", "Aust-Agder", "Vest-Agder", "Rogaland"],
    "Vestlandet": ["Hordaland", "Sogn og Fjordane", "Møre og Romsdal"],
    "Trøndelag": ["Sør-Trøndelag", "Nord-Trøndelag", "Oppland", "Hedmark"],
    "Nordland": ["Nordland", "Troms", "Finnmark"],
}

DK_ISO_REGION = "Denmark"
IS_ISO_REGION = "Iceland"

# Algeria (Numidia) -> ~4 game regions
DZ_REGION_GROUPS = {
    "Tell Atlas": ["Alger", "Oran", "Constantine", "Annaba", "Tizi Ouzou",
                   "Blida", "Béjaïa", "Tlemcen", "Sétif", "Skikda", "Chlef",
                   "Mostaganem", "Jijel", "Médéa", "Mascara", "Tipaza",
                   "Boumerdès", "Aïn Defla", "Souk Ahras", "Mila", "Bordj Bou Arréridj",
                   "El Tarf", "Guelma", "Relizane", "Aïn Témouchent", "Tissemsilt",
                   "Bouira"],
    "Highlands": ["Djelfa", "M'sila", "Batna", "Biskra", "Saïda", "Tiaret",
                  "El Bayadh", "Tébessa", "Naâma", "Khenchela", "Oum el Bouaghi",
                  "Laghouat", "Sidi Bel Abbès"],
    "Sahara": ["Tamanghasset", "Adrar", "Ouargla", "Illizi", "Béchar",
               "Ghardaïa", "Tindouf", "El Oued"],
}

TN_ISO_REGION = "Tunisia"

# Libya -> 3 game regions
LY_REGION_GROUPS = {
    "Tripolitania": ["Tripoli", "Misratah", "Al Khums", "Az Zawiyah", "Gharyan",
                     "Yafran", "Nalut", "Sabratah", "Ghadamis", "Zlitan",
                     "Tarhunah", "Bani Walid", "Mizdah", "Sawfajjin"],
    "Cyrenaica": ["Banghazi", "Al Bayda", "Al Marj", "Darnah", "Tubruq",
                  "Ajdabiya", "Al Butnan", "Al Kufrah", "Al Wahat"],
    "Fezzan": ["Sabha", "Murzuq", "Wadi al Hayat", "Ash Shati'", "Al Jufrah",
               "Ghat", "Ubari"],
}

# Russia (Novgorod) -> historical governorates
RU_REGION_GROUPS = {
    "Novgorod": ["Leningrad", "Novgorod", "Pskov", "Kaliningrad",
                 "City of St. Petersburg"],
    "Karelia": ["Murmansk", "Karelia"],
    "Archangel": ["Arkhangel'sk", "Vologda", "Komi", "Nenets"],
    "Muscovy": ["Moskva", "Moskovskaya", "Tver'", "Kaluga", "Tula", "Ryazan'",
                "City of Moscow"],
    "Smolensk": ["Smolensk", "Bryansk"],
    "Vladimir": ["Vladimir", "Ivanovo", "Kostroma", "Yaroslavl'"],
    "Voronezh": ["Orel", "Kursk", "Belgorod", "Lipetsk", "Tambov", "Voronezh"],
    "Kazan": ["Tatarstan", "Chuvash", "Mariy-El", "Mordovia", "Udmurt"],
    "Nizhny Novgorod": ["Nizhegorod", "Kirov", "Perm'"],
    "Ural": ["Sverdlovsk", "Chelyabinsk", "Orenburg", "Bashkortostan"],
    "Don": ["Rostov", "Krasnodar", "Stavropol'", "Volgograd", "Astrakhan'",
            "Crimea", "Sevastopol"],
    "Samara": ["Samara", "Saratov", "Ul'yanovsk", "Penza"],
}

# Saudi Arabia -> 3 game regions
SA_REGION_GROUPS = {
    "Northern Arabia": ["Al Hudud ash Shamaliyah", "Al Jawf", "Ha'il", "Tabuk", "Al Quassim"],
    "Central Arabia": ["Ar Riyad", "Al Madinah", "Makkah"],
    "Eastern Arabia": ["Ash Sharqiyah"],
}

# Egypt/Sudan -> 3 game regions
EG_REGION_GROUPS = {
    "Lower Egypt": ["Al Qahirah", "Al Jizah", "Al Qalyubiyah", "Al Gharbiyah",
                    "Al Minufiyah", "Ad Daqahliyah", "Ash Sharqiyah", "Al Buhayrah",
                    "Al Iskandariyah", "Dumyat", "Kafr ash Shaykh", "Bur Sa'id"],
    "Upper Egypt": ["Al Minya", "Asyut", "Suhaj", "Qina", "Al Uqsur", "Aswan",
                    "Al Fayyum", "Bani Suwayf"],
    "Sinai & Desert": ["Shamal Sina'", "Janub Sina'", "Al Bahr al Ahmar",
                       "As Suways", "Al Ismailiyah", "Al Wadi at Jadid", "Matruh"],
}

SD_ISO_REGION = "Sudan"

# Italy: consolidate small regions
IT_SF_REGION_MAP = {
    "Lombardia": "Lombardia",
    "Piemonte": "Piedmont",
    "Valle d'Aosta": "Piedmont",
    "Liguria": "Piedmont",
    "Veneto": "Veneto",
    "Friuli-Venezia Giulia": "Friuli-Venezia Giulia",
    "Trentino-Alto Adige": "Lombardia",
    "Emilia-Romagna": "Emilia-Romagna",
    "Toscana": "Toscana",
    "Umbria": "Toscana",
    "Marche": "Toscana",
    "Lazio": "Lazio",
    "Abruzzo": "Southern Italy",
    "Molise": "Southern Italy",
    "Campania": "Southern Italy",
    "Apulia": "Mezzogiorno",
    "Basilicata": "Mezzogiorno",
    "Calabria": "Mezzogiorno",
    "Sicily": "Sicily",
    "Sardegna": "Sardegna",
}

# Levant: group by country
SY_REGION_GROUPS = {
    "Northern Syria": ["Aleppo", "Idlib", "Hasaka", "Raqqah", "Ar Raqqah", "Al Haksa"],
    "Southern Syria": ["Homs", "Hims", "Hamah", "Rif Dimashq", "Damascus",
                       "Dayr Az Zawr", "As Suwayda", "Dar'a", "Quneitra", "Tartus", "Lattakia"],
}

JO_ISO_REGION = "Jordan"
IL_ISO_REGION = "Holy Land"
PS_ISO_REGION = "Holy Land"

# Morocco -> 4 game regions (Tanger separate for heretic enclave)
MA_REGION_GROUPS = {
    "Tanger - Tétouan": ["Tanger"],
    "Northern Morocco": ["Oriental", "Taza", "Fès", "Al Hoceima", "Taounate"],
    "Central Morocco": ["Chaouia", "Rabat", "Doukkala", "Tadla", "Marrakech", "Tensift"],
    "Southern Morocco": ["Souss", "Massa", "Guelmim", "Semara", "Meknès", "Tafilalet"],
}

# Spain: map sf_region to game regions (consolidate small ones)
ES_SF_REGION_MAP = {
    "Castilla y León": "Castilla y León",
    "Castilla-La Mancha": "Castilla-La Mancha",
    "Madrid": "Castilla-La Mancha",
    "Aragón": "Aragón",
    "Cataluña": "Cataluña",
    "Islas Baleares": "Cataluña",
    "Galicia": "Galicia",
    "Asturias": "Northern Coast",
    "Cantabria": "Northern Coast",
    "País Vasco": "Northern Coast",
    "Foral de Navarra": "Northern Coast",
    "La Rioja": "Northern Coast",
    "Valenciana": "Valenciana",
    "Murcia": "Valenciana",
    "Extremadura": "Extremadura",
    "Andalucía": "Andalucía",
    "Canary Is.": "Canary Islands",
    "Ceuta": "Ceuta",
    "Melilla": "Melilla",
}

PT_ISO_REGION = "Portugal"

# Finland -> 2 game regions
FI_REGION_GROUPS = {
    "Southern Finland": ["Uusimaa", "Finland Proper", "Satakunta", "Tavastia Proper",
                         "Päijät-Häme", "Kymenlaakso", "South Karelia", "Pirkanmaa"],
    "Savonia": ["Northern Savonia", "Southern Savonia", "North Karelia",
                "Central Finland", "Kainuu"],
    "Ostrobothnia": ["Ostrobothnia", "Southern Ostrobothnia", "Central Ostrobothnia",
                     "Northern Ostrobothnia"],
}

# Maritime passages: force specific tiles to sea for straits
FORCE_SEA_TILES = {
    (15, 24),  # English Channel (Calais) - creates passage between Dover and France
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
    {"id": "rijeka", "name": "Rijeka", "lon": 14.44, "lat": 45.33, "type": "heretic_fortress",
     "lore": "Stormed 1872. Beachhead for Heretic conquest of the Balkans and expansion to Italy."},
    {"id": "palace_antipope", "name": "Palace of the Antipope", "lon": 4.81, "lat": 44.9, "type": "heretic_outpost",
     "lore": "Seat of the Antipope. Heretical schismatic enclave defying the Supreme Pontiff."},
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
    {"id": "alexandria", "name": "Alexandria", "lon": 29.92, "lat": 31.2, "type": "heretic_landmark",
     "lore": "Razed by Mammon's forces. Once the jewel of Egypt, now a blasted ruin."},
    {"id": "mecca", "name": "Mecca", "lon": 39.82, "lat": 21.42, "type": "heretic_landmark",
     "lore": "Holiest city of Islam, now behind enemy lines. Held by Heretic Arabia."},
    {"id": "nessebar", "name": "Nessebar", "lon": 27.73, "lat": 42.66, "type": "heretic_landmark",
     "lore": "Coastal Bulgarian city destroyed in the Heretic advance. Now a blasted ruin."},
    {"id": "helsinki", "name": "Helsinki", "lon": 24.94, "lat": 60.17, "type": "heretic_outpost",
     "lore": "Capital of Heretic Finland. Fallen to the forces of Hell."},
    {"id": "edinburgh", "name": "Edinburgh", "lon": -3.19, "lat": 55.95, "type": "faithful_city",
     "lore": "Capital of the Kingdom of Alba. The Lowlands hold against the Heretic Highlands."},
    # Iron Wall Gates (4 Great Gates)
    {"id": "north_gate", "name": "Gate of the North", "lon": 51.4, "lat": 36.5, "type": "wall_gate",
     "lore": "Northern Great Gate of the Iron Wall, near Tehran. Guards the Caspian approach."},
    {"id": "west_gate", "name": "Gate of the West", "lon": 36.8, "lat": 34.0, "type": "wall_gate",
     "lore": "Western Great Gate. Main passage between the Sultanate and the Faithful Levant."},
    {"id": "south_gate", "name": "Gate of the South", "lon": 34.0, "lat": 29.5, "type": "wall_gate",
     "lore": "Southern Great Gate. Guards the passage between Sinai and Arabia."},
    # Carcass Front sub-locations
    {"id": "nineveh_novus", "name": "Nineveh Novus", "lon": 36.3, "lat": 36.0, "type": "battlefield",
     "lore": "Lost wonders rebuilt on ancient Nineveh. Key objective on the Carcass Front."},
    {"id": "carrion_coast", "name": "Carrion Coast", "lon": 35.6, "lat": 35.8, "type": "battlefield",
     "lore": "Where the wreckage of the Supply Fleet washed ashore. Haunted shore of war."},
    # Additional lore locations
    {"id": "cairo", "name": "Cairo", "lon": 31.24, "lat": 30.04, "type": "heretic_landmark",
     "lore": "Fallen to Mammon's domain. Once the greatest city of Africa."},
    {"id": "axum", "name": "Axum", "lon": 38.72, "lat": 14.12, "type": "faithful_city",
     "lore": "Holy city of Abyssinia. The Faithful hold East Africa."},
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


def _match_group(admin_name, groups, default):
    for group_name, provinces in groups.items():
        for p in provinces:
            if p.lower() in admin_name.lower() or admin_name.lower() in p.lower():
                return group_name
    return default


def get_region_name(iso, admin_name, shapefile_region):
    # Balkans: one region per country
    if iso in BALKANS_ISO_REGIONS:
        return BALKANS_ISO_REGIONS[iso]

    # Caucasus: one region per country
    if iso in CAUCASUS_ISO_REGIONS:
        return CAUCASUS_ISO_REGIONS[iso]

    # HRE minor countries: one region each
    if iso in HRE_MINOR_ISO_REGIONS:
        return HRE_MINOR_ISO_REGIONS[iso]

    # PLC Baltic: one region per country
    if iso in PLC_BALTIC_ISO_REGIONS:
        return PLC_BALTIC_ISO_REGIONS[iso]

    # Single-region ISO overrides
    if iso == "IE":
        return IE_ISO_REGION
    if iso == "DK":
        return DK_ISO_REGION
    if iso == "IS":
        return IS_ISO_REGION
    if iso == "MD":
        return MD_ISO_REGION
    if iso == "TN":
        return TN_ISO_REGION
    if iso == "SD":
        return SD_ISO_REGION
    if iso == "JO":
        return JO_ISO_REGION
    if iso in ("IL", "PS"):
        return IL_ISO_REGION
    if iso == "PT":
        return PT_ISO_REGION

    # Group-based mappings
    if iso == "TR":
        return _match_group(admin_name, TR_REGION_GROUPS, "Central Anatolia")
    if iso == "SK":
        return SK_ISO_REGION
    if iso == "HU":
        return _match_group(admin_name, HU_REGION_GROUPS, "Hungary")
    if iso == "RO":
        return _match_group(admin_name, RO_REGION_GROUPS, "Wallachia")
    if iso == "IQ":
        return IQ_ISO_REGION
    if iso == "IR":
        return _match_group(admin_name, IR_REGION_GROUPS, "Tehran")
    if iso == "DE":
        return _match_group(admin_name, DE_REGION_GROUPS, "Bavaria")
    if iso == "PL":
        return _match_group(admin_name, PL_REGION_GROUPS, "Greater Poland")
    if iso == "UA":
        return _match_group(admin_name, UA_REGION_GROUPS, "Kyiv")
    if iso == "BY":
        return _match_group(admin_name, BY_REGION_GROUPS, "Belarus")
    if iso == "GB":
        return GB_SF_REGION_MAP.get(shapefile_region.strip() if shapefile_region else "", "Southern England")
    if iso == "SE":
        return _match_group(admin_name, SE_REGION_GROUPS, "Svealand")
    if iso == "NO":
        return _match_group(admin_name, NO_REGION_GROUPS, "Østlandet")
    if iso == "DZ":
        return _match_group(admin_name, DZ_REGION_GROUPS, "Tell Atlas")
    if iso == "LY":
        return _match_group(admin_name, LY_REGION_GROUPS, "Tripolitania")
    if iso == "RU":
        return _match_group(admin_name, RU_REGION_GROUPS, "Muscovy")
    if iso == "SA":
        return _match_group(admin_name, SA_REGION_GROUPS, "Central Arabia")
    if iso == "EG":
        return _match_group(admin_name, EG_REGION_GROUPS, "Lower Egypt")
    if iso == "FI":
        return _match_group(admin_name, FI_REGION_GROUPS, "Ostrobothnia")
    if iso == "IT":
        sf = shapefile_region.strip() if shapefile_region else ""
        return IT_SF_REGION_MAP.get(sf, "Southern Italy")
    if iso == "SY":
        return _match_group(admin_name, SY_REGION_GROUPS, "Southern Syria")
    if iso == "MA":
        return _match_group(admin_name, MA_REGION_GROUPS, "Central Morocco")
    if iso == "ES":
        sf = shapefile_region.strip() if shapefile_region else ""
        return ES_SF_REGION_MAP.get(sf, "Castilla y León")
    if iso == "FR":
        sf = shapefile_region.strip() if shapefile_region else ""
        return FR_SF_REGION_MAP.get(sf, sf if sf else admin_name)

    # Default: use shapefile region or admin name
    if shapefile_region and shapefile_region.strip():
        return shapefile_region.strip()
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
        # Unify region_id prefix for merged countries
        rid_prefix = {"PS": "il", "SD": "eg"}.get(iso, iso.lower())
        region_id = f"{rid_prefix}_{slugify(region_name)}"

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

            if (q, r) in FORCE_SEA_TILES:
                found = None

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

    # Split PACA into Avignon (heretic enclave) and Côte d'Azur
    # Avignon radiates from (19,32) over several tiles
    AVIGNON_TILES = {(19, 32), (19, 33), (18, 33), (20, 33), (18, 32)}
    if "fr_provence_alpes_cote_dazur" in regions_found:
        paca = regions_found.pop("fr_provence_alpes_cote_dazur")
        paca_avignon = [t for t in paca["tiles"] if tuple(t) in AVIGNON_TILES]
        cote_tiles = [t for t in paca["tiles"] if tuple(t) not in AVIGNON_TILES]
        if cote_tiles:
            regions_found["fr_cote_dazur"] = {
                "name": "Côte d'Azur",
                "country": "france",
                "tiles": cote_tiles,
            }
        for tile in tiles:
            if tile.get("g") == "fr_provence_alpes_cote_dazur":
                if (tile["q"], tile["r"]) in AVIGNON_TILES:
                    tile["g"] = "fr_avignon"
                else:
                    tile["g"] = "fr_cote_dazur"

    # Also grab tiles from other French regions that fall in Avignon zone
    avignon_all_tiles = []
    for tile in tiles:
        if (tile["q"], tile["r"]) in AVIGNON_TILES and tile.get("g"):
            old_region = tile["g"]
            if old_region != "fr_avignon":
                tile["g"] = "fr_avignon"
                if old_region in regions_found:
                    regions_found[old_region]["tiles"] = [
                        t for t in regions_found[old_region]["tiles"]
                        if tuple(t) != (tile["q"], tile["r"])
                    ]
            avignon_all_tiles.append([tile["q"], tile["r"]])

    regions_found["fr_avignon"] = {
        "name": "Avignon",
        "country": "heretic_avignon",
        "tiles": avignon_all_tiles,
    }
    country_tiles.setdefault("heretic_avignon", []).extend(avignon_all_tiles)
    print(f"  Avignon enclave: {len(avignon_all_tiles)} tiles")

    # Split Azerbaijan into North (heretic) and South (loyal, behind Iron Wall)
    # Wall runs through AZ at: (78,39),(79,38),(80,38),(81,37),(82,37)
    # South tiles (higher row than wall at that col) → loyal
    AZ_WALL_LINE = {77: 39, 78: 39, 79: 38, 80: 38, 81: 37, 82: 37, 83: 37}
    if "az_azerbaijan" in regions_found:
        az = regions_found.pop("az_azerbaijan")
        az_north = []
        az_south = []
        for t in az["tiles"]:
            q, r = t[0], t[1]
            wall_r = AZ_WALL_LINE.get(q, 38)
            if r > wall_r:
                az_south.append(t)
            else:
                az_north.append(t)
        if az_north:
            regions_found["az_northern_azerbaijan"] = {
                "name": "Northern Azerbaijan",
                "country": "caucasus",
                "tiles": az_north,
            }
        if az_south:
            regions_found["az_southern_azerbaijan"] = {
                "name": "Southern Azerbaijan",
                "country": "iron_sultanate",
                "tiles": az_south,
            }
            country_tiles.setdefault("iron_sultanate", []).extend(az_south)
        for tile in tiles:
            if tile.get("g") == "az_azerbaijan":
                q, r = tile["q"], tile["r"]
                wall_r = AZ_WALL_LINE.get(q, 38)
                if r > wall_r:
                    tile["g"] = "az_southern_azerbaijan"
                else:
                    tile["g"] = "az_northern_azerbaijan"
        print(f"  Azerbaijan split: North={len(az_north)} tiles (heretic), South={len(az_south)} tiles (loyal)")

    # Reassign heretic regions to their own heretic countries
    REGION_TO_HERETIC_COUNTRY = {
        # Adriatic Italian regions fall to Balkans heretic bloc
        "it_friuli_venezia_giulia": "balkans",
        "it_veneto": "balkans",
        # Córdoba: Andalucia
        "es_andalucia": "heretic_cordoba",
        # Finland: 3 regions
        "fi_southern_finland": "heretic_finland",
        "fi_savonia": "heretic_finland",
        "fi_ostrobothnia": "heretic_finland",
        # Scotland: Highlands
        "gb_highlands_and_islands": "heretic_scotland",
        # Tanger: northern Morocco coast
        "ma_tanger_tetouan": "heretic_tanger",
    }

    # Marmara stays in Anatolia (heretic) - no change needed
    # All Balkans regions stay in "balkans" (heretic) per lore

    for rid, new_country in REGION_TO_HERETIC_COUNTRY.items():
        if rid in regions_found:
            regions_found[rid]["country"] = new_country
            country_tiles.setdefault(new_country, []).extend(regions_found[rid]["tiles"])

    print(f"  Reassigned {len(REGION_TO_HERETIC_COUNTRY)} regions to heretic countries")

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

    # Control status per country (heretic countries get heretic, faithful get faithful)
    COUNTRY_CONTROL = {
        "kalmar_union": "faithful",
        "crown_england": "faithful",
        "france": "faithful",
        "holy_roman_empire": "faithful",
        "iberia": "faithful",
        "papal_states": "faithful",
        "hungary": "faithful",
        "balkans": "heretic",
        "plc": "faithful",
        "kyiv": "faithful",
        "novgorod": "faithful",
        "anatolia": "heretic",
        "golden_khanate": "neutral",
        "caucasus": "heretic",
        "new_antioch": "faithful",
        "levant": "heretic",
        "iron_sultanate": "faithful",
        "morocco": "neutral",
        "numidia": "faithful",
        "libya": "heretic",
        "domain_mammon": "heretic",
        "arabia": "heretic",
        "heretic_avignon": "heretic",
        "heretic_cordoba": "heretic",
        "heretic_finland": "heretic",
        "heretic_scotland": "heretic",
        "heretic_tanger": "heretic",
    }

    def get_region_control(region_id, country_id):
        return COUNTRY_CONTROL.get(country_id, "neutral")

    # Add control field to each region
    for rid, rdef in regions_found.items():
        rdef["control"] = get_region_control(rid, rdef["country"])

    # Compute country label tiles (centroid of tiles)
    LABEL_OVERRIDES = {
        "heretic_avignon": [19, 31],
    }
    countries_output = {}
    for cid, cdef in COUNTRIES_DEF.items():
        if cid in LABEL_OVERRIDES:
            label_tile = LABEL_OVERRIDES[cid]
        else:
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
