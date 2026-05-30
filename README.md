<div align="center">

<img src="public/icons/hikr-logo.png" alt="HIKR Enhancements" width="80" />

# HIKR Enhancements

**A Chrome extension that turns [hikr.org](https://www.hikr.org) into a full-featured hiking tour planner.**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-f97316)](LICENSE)

</div>

---

HIKR Enhancements supercharges the hikr.org website with features that should have been built-in — inline tour stats, interactive maps, driving time estimates, hover previews, smart search presets, and one-click Excel exports. Everything runs locally in your browser with intelligent caching, so pages feel instant after the first load.

<br />

## ✨ Features

### 📋 Inline Tour Details
Stop clicking into every tour to find out the basics. The extension fetches duration, elevation gain/loss, route length, highest point, and waypoints — and shows them **directly in the listing** without leaving the page. Loads up to 4 tours in parallel, caches results permanently so repeat visits are instant.

> Auto-loads on home, region, search, and waypoint pages — fully configurable per page type.

---

### 🗺️ Interactive Start-Point Map
One click opens a **Leaflet map** with markers for every visible tour's starting point. Hover a marker to see the tour name, stats, and route info. Supports OpenStreetMap and Mapy.cz tiles. Fits all points into view automatically.

---

### 🚗 Driving Time Estimates
Enter your starting location (coordinates, place name, or use your browser's GPS) and the extension calculates **driving distance and duration** to every tour's start point — right in the listing. Results appear as `🚗 12.5 km · 2 h 15 min` inline on each tour card.

Supports two routing backends:
| Provider | Notes |
|---|---|
| **OpenRouteService** | Default. Free API key. Smart snap-radius retry for tricky mountain roads. |
| **Google Routes API** | Requires a Google Cloud key. |

Routes are cached for 7 days. Unroutable locations are negative-cached to avoid burning API quota.

---

### 🔍 Hover Previews
Hover over any tour link, waypoint link, or user profile and a **floating preview modal** appears — complete with the gallery, minimap, and external map links. Configurable delay (0 – 1500 ms). No extra clicks needed.

---

### 📄 Search Pagination Auto-Load
HIKR paginates aggressively. This extension **auto-fetches extra result pages** and appends them seamlessly to the current view. Configure how many extra pages to load per context (search results, home page, regional listings).

---

### 💾 Search Presets & Saved Locations
Never re-type your search filters again.

- **Search Presets** — save the entire explore form state under a name, restore with one click.
- **Saved Locations** — store frequently-used center coordinates (your home valley, usual parking spots) and apply them to the search form instantly via a dropdown.

Place names are geocoded via Photon/OpenStreetMap with live suggestions as you type.

---

### 📸 Gallery Lightbox
Tour images open in a clean **full-screen lightbox** with keyboard navigation (← → to browse, Esc to close). No more fighting with HIKR's native gallery layout.

---

### 📊 Excel Export
Export all visible tours to an **.xls file** with one button click. The file goes straight to your Downloads folder and includes:

| Column | Description |
|---|---|
| Title | Tour name with link |
| Date | Date of hike |
| Hiking / Climbing grade | Difficulty |
| Duration | Tour duration |
| Elevation gain | Ascent in meters |
| Highest point | Max elevation in meters |
| Route length | Distance |
| Start waypoint | Name, latitude, longitude |
| Driving distance / time | If routes were calculated |

---

### ❄️ Snow Conditions Research
Available on **search result pages**, the "❄ Schneelagen" button scrapes every visible tour's photo gallery for annotated peaks and collects their elevations — giving you a real-time picture of where snow was recently documented.

**How it works:**
1. For each visible tour, the gallery is scanned for all photos
2. Each photo page is fetched and parsed for peak/waypoint annotations (marked by other users directly on the image)
3. All annotated points are aggregated, **sorted by elevation (highest first)**, and displayed with thumbnails

**Results panel shows:**
- `▲ 2379m – Großer Wilder` *(with clickable thumbnail strip)*
- Each thumbnail opens a **lightbox** with the full photo and annotation markers overlaid at their exact positions (relative x/y coordinates from the hikr.org annotation system)
- Tour source links included

**Export:** A `📥 JSON` button downloads `HIKR_Schneelagen.json` with all peaks, elevations, photo URLs and tour links — so you can revisit the results later or process them externally.

**Caching:** Photo annotations are cached for 30 days in the browser. Repeat runs are near-instant.

---

### 🗂️ Smart Caching
All fetched data lives in an **IndexedDB cache** in your browser — no external servers involved.

- Tour & waypoint data: cached permanently (re-fetched only on manual clear)
- Route calculations: configurable TTL (default 7 days)
- Geocoding results: 30-day cache for exact queries, 7-day cache for suggestions
- One-click **cache clear** from the options page (all data or routes only)

---

## 🎛️ The Panel

Every HIKR page with tours gets a persistent side panel:

```
┌──────────────────────────────────┐
│ 🏔  HIKR Enhancements            │
├──────────────────────────────────┤
│ Detected: home · 20 tours        │
│                                  │
│ Start point                      │
│ ┌──────────────────────────────┐ │
│ │ City, address or 47.1, 8.2  │ │
│ └──────────────────────────────┘ │
│                                  │
│ ☑  Calculate routes automatically │
│                                  │
│ [Details] [Routes] [Map] [Excel] │
│         [Options ⚙]              │
└──────────────────────────────────┘
```

---

## ⚙️ Options

Open the options page via the panel button or the extension icon. Configure:

- **Feature toggles** — enable or disable any feature individually
- **Route provider** — OpenRouteService or Google Routes, with API keys
- **Map provider** — OpenStreetMap or Mapy.cz
- **External map links** — open waypoints in Google Maps, OSM, Swisstopo, Bergfex, OpenTopoMap, or a custom URL template
- **Autoload per page type** — choose on which page types tour details load automatically
- **Extra pages to load** — tune pagination depth
- **Hover preview delay** — or disable previews entirely
- **Saved locations** — manage your favorite search centers
- **Search presets** — view and delete saved filter configurations
- **Cache management** — view stats, clear all or routes only

---

## 🚀 Installation

> The extension is not published to the Chrome Web Store. Install it manually as an unpacked extension.

**Prerequisites:** Node.js 18+

```bash
# Clone the repository
git clone https://github.com/your-username/hikr-enhancements.git
cd hikr-enhancements

# Install dependencies
npm install

# Build
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

Open [hikr.org](https://www.hikr.org) and the panel will appear on any page with tours.

---

## 🛠️ Development

```bash
# Build once
npm run build

# Type-check without building
npx tsc --noEmit
```

After each build, reload the extension in `chrome://extensions` (click the refresh icon on the extension card).

**Project structure:**

```
src/
├── background/       # Service worker (routing, geocoding, Excel, downloads)
├── content/
│   ├── features/     # One file per feature
│   └── index.ts      # Feature runner & context setup
└── shared/           # Types, settings, cache, parser, i18n, Excel generation
```

---

## 🌍 Languages

The UI is fully translated in **German**, **English**, and **Italian**. The extension auto-detects your browser language and falls back to English.

---

## 📄 License

MIT — do whatever you want with it.

---

<div align="center">

Made for hikers who want more out of hikr.org.

</div>
