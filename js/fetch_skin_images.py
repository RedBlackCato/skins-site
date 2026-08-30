"""
fetch_skin_images.py
---------------------
Downloads card images from isaac-goldberg/cs2-images
(https://github.com/isaac-goldberg/cs2-images) for every skin in your
skins-data.json, pulling from the repo's "thumbnails/" folder, and saves
them into your project's img folder with the naming convention your site
already expects.

WHY A SCRIPT INSTEAD OF ME JUST DOING IT:
1. I only run in a sandbox — I have no access to your D: drive, so I can't
   write files there directly no matter what.
2. This repo is a ~3.7 GB mirror of Valve's extracted game art. Rather than
   me bulk-downloading and repackaging the whole thing, this script only
   pulls the exact files your project actually needs, run on your own
   machine, from the original public source.

HOW TO USE:
1. Make sure Python 3 is installed.
2. Edit the paths below (DATA_JSON_PATH, IMG_OUTPUT_DIR) for your machine.
3. Open a terminal in this folder and run:
       python fetch_skin_images.py
4. Watch the log — anything it couldn't find (404) is printed clearly at
   the end so you can add it manually or double check the skin name.

NOTE ON THUMBNAILS: the repo's thumbnails only have 3 wear buckets
(Light / Medium / Heavy), not the 5 Steam exteriors. This script maps each
skin's actual Wear Rating float to the closest bucket automatically:
  wear < 0.15  -> Light   (roughly Factory New)
  wear < 0.38  -> Medium  (roughly Minimal Wear / Field-Tested)
  wear >= 0.38 -> Heavy   (roughly Well-Worn / Battle-Scarred)
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

# Windows consoles often default to cp1252, which can't print some skin
# names (emoji, CJK characters, etc.). Force UTF-8 output so the script
# never crashes on the final report.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ---- CONFIG: edit these paths for your machine ----
DATA_JSON_PATH = r"skins-data.json"          # path to your data file
IMG_OUTPUT_DIR = r"D:\All_IT\HTML CODE (VS Code)\Skins\img"                       # card cover images (thumbnails/)
# -----------------------------------------------------

REPO_BASE = "https://raw.githubusercontent.com/isaac-goldberg/cs2-images/main/skins"

# Maps your weapon display names to this repo's internal folder names.
WEAPON_FOLDER_MAP = {
    "AK-47": "ak47", "AUG": "aug", "AWP": "awp", "CZ75-Auto": "cz75",
    "Desert Eagle": "deagle", "Dual Berettas": "dualberettas", "FAMAS": "famas",
    "Five-SeveN": "fiveseven", "G3SG1": "g3sg1", "Galil AR": "galil",
    "Glock-18": "glock", "Kukri": "kukri", "M249": "m249", "M4A1-S": "m4a1s",
    "M4A4": "m4a4", "MAC-10": "mac10", "MAG-7": "mag7", "MP5-SD": "mp5",
    "MP7": "mp7", "MP9": "mp9", "Negev": "negev", "Nova": "nova",
    "P2000": "p2000", "P250": "p250", "P90": "p90", "PP-Bizon": "bizon",
    "R8 Revolver": "r8", "SCAR-20": "scar20", "SG 553": "sg553",
    "SSG 08": "ssg08", "Sawed-Off": "sawedoff", "Tec-9": "tec9",
    "UMP-45": "ump45", "USP-S": "usps", "XM1014": "xm1014", "Zeus x27": "zeus",
    # Knives / gloves (fill in once these rows are complete in your sheet)
    "Karambit": "karambit", "Bayonet": "bayonet", "M9 Bayonet": "m9bayonet",
    "Butterfly Knife": "butterfly", "Falchion Knife": "falchion",
    "Flip Knife": "flip", "Gut Knife": "gut", "Huntsman Knife": "huntsman",
    "Bowie Knife": "bowie", "Navaja Knife": "navaja", "Classic Knife": "classic",
    "Paracord Knife": "paracord", "Shadow Daggers": "shadowdaggers",
    "Skeleton Knife": "skeleton", "Stiletto Knife": "stiletto",
    "Survival Knife": "survival", "Talon Knife": "talon", "Ursus Knife": "ursus",
    "Nomad Knife": "nomad", "Sport Gloves": "sport", "Driver Gloves": "driver",
    "Specialist Gloves": "specialist", "Bloodhound Gloves": "bloodhound",
    "Hydra Gloves": "hydra", "Broken Fang Gloves": "brokenfang",
    "Moto Gloves": "moto", "Hand Wraps": "handwraps", "Moto": "moto",
}


def clean_skin_display_name(full_name):
    """'StatTrak™ AK-47 | Legion of Anubis' -> 'Legion of Anubis'"""
    if "|" in full_name:
        return full_name.split("|", 1)[1].strip()
    return full_name.strip()


def wear_bucket(wear):
    """Maps a Steam wear float to this repo's Light/Medium/Heavy thumbnail bucket."""
    if wear is None:
        return "Medium"
    if wear < 0.15:
        return "Light"
    if wear < 0.38:
        return "Medium"
    return "Heavy"


def build_thumbnail_url(weapon, skin_display, wear):
    folder = WEAPON_FOLDER_MAP.get(weapon)
    if not folder:
        return None, f"No repo folder mapping for weapon '{weapon}'"
    bucket = wear_bucket(wear)
    filename = f"{skin_display} {bucket}.png"
    encoded = urllib.parse.quote(filename)
    url = f"{REPO_BASE}/{folder}/thumbnails/{encoded}"
    return url, None


def download(url, dest_path):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as f:
        f.write(data)


def main():
    with open(DATA_JSON_PATH, encoding="utf-8") as f:
        groups = json.load(f)

    successes = []
    failures = []

    for group in groups:
        weapon = group["weapon"]
        weapon_slug = group["weaponSlug"]
        for skin in group["skins"]:
            skin_display = clean_skin_display_name(skin["name"])
            wear = skin.get("wear")
            skin_slug = skin["skinSlug"]
            dest_path = os.path.join(IMG_OUTPUT_DIR, weapon_slug, f"{skin_slug}.png")

            if os.path.exists(dest_path):
                print(f"SKIP (already exists): {dest_path}")
                continue

            url, err = build_thumbnail_url(weapon, skin_display, wear)
            if err:
                failures.append((weapon, skin["name"], err))
                continue

            try:
                download(url, dest_path)
                print(f"OK: {weapon} | {skin_display} -> {dest_path}")
                successes.append(dest_path)
            except urllib.error.HTTPError as e:
                failures.append((weapon, skin["name"], f"HTTP {e.code} for {url}"))
            except Exception as e:
                failures.append((weapon, skin["name"], str(e)))

            time.sleep(0.3)  # be polite to GitHub's raw CDN

    print("\n----- DONE -----")
    print(f"Downloaded: {len(successes)}")
    print(f"Failed: {len(failures)}")
    if failures:
        print("\nCouldn't fetch these (check name/wear manually):")
        for weapon, name, reason in failures:
            print(f"  - {weapon} | {name} :: {reason}")

        log_path = "fetch_failures.log"
        with open(log_path, "w", encoding="utf-8") as f:
            for weapon, name, reason in failures:
                f.write(f"{weapon} | {name} :: {reason}\n")
        print(f"\n(Full list also saved to {log_path}, in case anything above looked garbled.)")


if __name__ == "__main__":
    main()
