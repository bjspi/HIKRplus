<div align="center">

<img src="public/icons/hikr-logo-wide.png" alt="HikrPlus" width="320" />

# HikrPlus

**Extended features for [hikr.org](https://www.hikr.org) — tour search, listing filters, snow research, driving times, fuel costs, and more.**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-f97316)](LICENSE)

</div>

---

[hikr.org](https://www.hikr.org) has one of the most detailed collections of Alpine tour reports on the web — real accounts from real hikers, with photos, peak annotations, snow observations, and exact starting coordinates. A genuinely useful resource for anyone planning trips in the Alps.

HikrPlus is a browser extension that adds research tools on top: inline tour stats, listing filters, driving time estimates, an interactive start-point map, snow conditions analysis, hover previews, and one-click Excel exports. Everything runs locally in your browser with smart caching.

<br />

## 🚀 Installation

> The extension is not on any browser store — install it as an unpacked extension directly from a release ZIP.

**1. Download the latest release**

Go to [Releases](https://github.com/bjspi/HIKRplus/releases) and download the ZIP for your browser:
- `hikr-chrome-vX.X.X.zip` → Chrome, Edge, Opera (and any Chromium-based browser)
- `hikr-firefox-vX.X.X.zip` → Firefox

**2. Unpack the ZIP** into a folder of your choice.

**3. Load the extension**

**Chrome / Edge / Opera** (Chromium-based):
1. Open `chrome://extensions` (or `edge://extensions` / `opera://extensions`)
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the unpacked folder

**Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` inside the unpacked folder

> Firefox temporary add-ons are removed on browser restart. For a permanent install, a signed XPI is required.

Open [hikr.org](https://www.hikr.org) — the panel will appear on any page with tours.

---

## ✨ Features

### 📋 Inline Tour Details
Stop clicking into every tour to find the basics. The extension fetches duration, elevation gain/loss, route length, highest point, and waypoints — and shows them **directly in the listing** without leaving the page. Loads up to 4 tours in parallel, caches results permanently so repeat visits are instant.

<div align="center">
<img src="screenshots/inline-tour-details.jpg" alt="Inline tour details with stats, expandable waypoint list, driving time, and a Google Maps route link" width="720" />
</div>

Each tour card shows duration, elevation gain/loss, route length, highest point, route type, and driving distance/time — plus an **expandable waypoint list** and a one-click **Google Maps route link** for the exact route.

The same inline stats are also added to your personal **watchlists** ("Merklisten") on hikr.org:

<div align="center">
<img src="screenshots/inline-details-watchlist.jpg" alt="Inline tour stats added to entries in a personal watchlist" width="720" />
</div>

> Auto-loads on home, region, tour-list, search, and waypoint pages — fully configurable per page type.

---

### 🗺️ Interactive Start-Point Map
One click opens a **Leaflet map** with markers for every visible tour's starting point. Hover a marker to see the tour name, stats, and route info. Supports OpenStreetMap and Mapy.cz tiles. Fits all points into view automatically.

---

### 🧭 External Map Links
Every waypoint gets a small **↗ button** to open its exact coordinates in an external map service with all kinds of layers — nakarte.me, ppete (hybrid map), Google Maps, OpenStreetMap, Mapy.cz, swisstopo, BergFex, OpenTopoMap, or your own custom URL template. Pick your preferred service in the options.

<div align="center">
<img src="screenshots/waypoint-external-map-links.jpg" alt="Each waypoint has an arrow button to open it in an external map service such as nakarte.me" width="720" />
</div>

---

### 🚗 Driving Time Estimates
Enter your starting location and the extension calculates **driving distance and duration** to every tour's start point — shown inline on each tour card as `🚗 12.5 km · 2 h 15 min`. Distances are based on **real calculated routes**, using the coordinates of the tour's first waypoint as the destination. On tour detail pages, driving distance and duration are added straight into the info table.

<div align="center">
<img src="screenshots/driving-time-on-tour-page.jpg" alt="Driving distance and duration added to a tour's detail table, computed from a real route to the first waypoint" width="720" />
</div>

**Fuel cost (€).** Enter your fuel price (€/L) and consumption (L/100 km) once in the options and the extension shows an estimated **fuel cost next to every driving distance** — one-way *and* round-trip, with a `⇄` arrow, e.g. `3,4 € ⇄ 6,8 €`. It appears on the tour cards, the short-info list cells, and as a dedicated **Spritkosten** row in the single-tour detail table. The cost only shows once both values are set; amounts are rounded to one decimal.

Supports two routing backends:
| Provider | Notes |
|---|---|
| **OpenRouteService** | Default. Free API key. Smart snap-radius retry for mountain roads. |
| **Google Routes API** | Requires a Google Cloud key. |

Routes are cached for 7 days. Unroutable locations are negative-cached to avoid burning API quota.

---

### 🎚️ Listing Filters
Filter the visible HIKR tour listings directly from the side panel by hiking difficulty, climbing difficulty, geodata availability, and calculated driving time. The filter runs as a post-processing step on the listing HTML: original HIKR badges are used for difficulty, the tour footer is used for `Geodaten:N`, and driving-time filters become active once HikrPlus has calculated route durations.

Entries with missing values stay visible by default, with optional checkboxes to hide listings without hiking grade, climbing grade, or driving time. Filters can be temporary for the current page load or saved so the panel opens and reapplies them automatically.

---

### 🔍 Hover Previews
Hover over any tour link, waypoint link, or user profile and a **floating preview modal** appears — complete with gallery, minimap, and external map links. Configurable delay (0 – 1500 ms). Close it with **Esc** or by clicking outside.

<div align="center">
<img src="screenshots/hover-tour-preview.jpg" alt="Floating preview overlay shown when hovering over a tour link, with region, difficulty grades, and waypoints" width="720" />
</div>

---

### 📄 Search Pagination Auto-Load
HIKR paginates aggressively. This extension **auto-fetches extra result pages** and appends them seamlessly to the current view. Configure how many extra pages to load per context (search results, home page, regional listings).

---

### 🔎 Radius Search Enhancements
The coordinate field in HIKR's radius search is extended with **address autocomplete**: type any place name into the coordinate field and get live suggestions powered by Photon/OpenStreetMap. Clicking a suggestion automatically fills in the correct coordinates.

<div align="center">
<img src="screenshots/radius-search-address-autocomplete.jpg" alt="Typing a place name into the radius-search coordinate field shows live address suggestions" width="640" />
</div>

**Search settings are saved automatically** — all field inputs (location, radius, filters) are remembered between sessions, so your last search state is always restored.

---

### 💾 Search Presets & Saved Locations
- **Search Presets** — save the entire explore form state under a name, restore with one click. Perfect for recurring searches (e.g. *"everything from the last 7 days for snow research"*).
- **Saved Locations** — store frequently-used center coordinates (home valley, parking spots) and apply them to the search form instantly via a dropdown.

<div align="center">
<img src="screenshots/search-presets.jpg" alt="Search preset dropdown with save and delete buttons on the explore form" width="640" />
</div>

---

### 📸 Gallery Lightbox
Click any tour photo to open a slick **full-screen lightbox** right inside the tour report — no page reload, no leaving the page. A **thumbnail strip** lets you jump straight to any shot, and you can browse with the **← → arrow keys** (or **Esc** to close). Each photo shows its **original caption as the title**, an image counter (e.g. `15 / 32`), and an **↗ Originalbild** button that links straight to the full-resolution source image. **Ctrl + Click** falls back to hikr.org's classic photo view.

---

### 📊 Excel Export
Export all visible tours to an **.xls file** with one button click — straight to your Downloads folder.

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
Available on search result pages, the "❄ Schneelagen" button scans every visible tour's photo gallery for annotated peaks and collects their elevations — giving you a real-time picture of where snow was recently documented. Combine it with a radius search around a location over the last X days to pull every annotated summit photo from all matching tour reports into one place.

<div align="center">
<img src="screenshots/snow-conditions-research.jpg" alt="Snow conditions research panel listing annotated peaks sorted high to low, each with photo thumbnails and a JSON export button" width="720" />
</div>

**How it works:**
1. Each visible tour's gallery is scanned for all photos
2. Photo pages are fetched and parsed for peak/waypoint annotations (marked by users directly on the image)
3. All annotated points are aggregated, **sorted by elevation (highest first)**, and displayed with thumbnails

**Results panel shows:**
- `▲ 2379m – Großer Wilder` *(with clickable thumbnail strip)*
- Each thumbnail opens a lightbox with the full photo and annotation markers overlaid at their exact positions
- Tour source links included

**Export:** A `📥 JSON` button downloads `HIKR_Schneelagen.json` with all peaks, elevations, photo URLs, and tour links.

**Caching:** Photo annotations are cached for 30 days. Repeat runs are near-instant.

---

### 🗂️ Smart Caching
All data lives in an **IndexedDB cache** in your browser — no external servers involved.

- Tour & waypoint data: cached permanently (re-fetched only on manual clear)
- Route calculations: configurable TTL (default 7 days)
- Geocoding results: 30-day cache for exact queries, 7-day cache for suggestions
- One-click **cache clear** from the options page (all data or routes only)

---

## 🎛️ The Panel

Every HIKR page with tours gets a persistent side panel:

```
┌──────────────────────────────────┐
│ 🏔  HikrPlus                  –  │
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
│ [Details] [Routes] [Filter] [Map] │
│ [Excel]   [Options ⚙]            │
└──────────────────────────────────┘
```

**Move it, collapse it, keep it.** Grab the panel by its header and drag it anywhere — it snaps to the nearest screen edge and stays glued there when you resize the window, so it never strands mid-screen or off-screen. Hit the **–** button to collapse it down to a small draggable icon (📍), and click the icon — or press **Enter** while it's focused — to expand it again, growing back out toward wherever there's room. Your position *and* collapsed/expanded state are remembered across page loads, and an open filter re-opens together with the panel.

---

## ⚙️ Options

Open the options page via the panel button or the extension icon. Configure:

- **Feature toggles** — enable or disable any feature individually
- **Route provider** — OpenRouteService or Google Routes, with API keys (section *Provider / Fahrtberechnungen*)
- **Fuel cost** — fuel price (€/L) and consumption (L/100 km); set both to show estimated driving costs next to distances (accepts `1,85` or `1.85`)
- **Map provider** — OpenStreetMap or Mapy.cz
- **External map links** — open waypoints in nakarte.me, ppete, Google Maps, OpenStreetMap, Mapy.cz, swisstopo, BergFex, OpenTopoMap, or a custom URL template
- **Autoload per page type** — choose on which page types tour details load automatically
- **Extra pages to load** — tune pagination depth
- **Hover preview delay** — or disable previews entirely
- **Saved locations** — manage your favorite search centers
- **Search presets** — view and delete saved filter configurations
- **Cache management** — view stats, clear all or routes only

---

## 🛠️ Development

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/bjspi/HIKRplus.git
cd HIKRplus
npm install
npm run build
```

Load the `dist/` folder as an unpacked extension (see Installation above), then after each change:

```bash
npm run build
# reload the extension in chrome://extensions (refresh icon)
```

```bash
# Type-check without building
npx tsc --noEmit
```

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

The UI is fully translated in **German**, **English**, **Italian**, and **French**. The extension auto-detects your browser language and falls back to English.

---

## 📄 License

MIT — do whatever you want with it.

---

<div align="center">

Made for hikers who want more out of hikr.org.

</div>
