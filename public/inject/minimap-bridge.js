(function () {
  if (window.__hikrExtMiniMapBound) return;
  window.__hikrExtMiniMapBound = true;
  var cfg = (document.currentScript && document.currentScript.dataset) || {};
  var mapyKey = (cfg.mapyKey || "").trim();
  var state = { mapDone: false, profileDone: false, layersDone: false };
  var deadline = Date.now() + 15000;
  var warned = false;

  function buildBaseLayers(L) {
    var layers = {};
    layers["OpenTopoMap"] = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      subdomains: "abc",
      maxNativeZoom: 17,
      maxZoom: 19,
      attribution: "Kartendaten: © OpenStreetMap-Mitwirkende, SRTM | Darstellung: © OpenTopoMap (CC-BY-SA)"
    });
    layers["OpenStreetMap"] = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxNativeZoom: 19,
      maxZoom: 19,
      attribution: "© OpenStreetMap-Mitwirkende"
    });
    if (mapyKey) {
      layers["Mapy Outdoor"] = L.tileLayer("https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=" + encodeURIComponent(mapyKey), {
        maxNativeZoom: 19,
        maxZoom: 19,
        attribution: "© Seznam.cz a.s., © OpenStreetMap-Mitwirkende"
      });
    }
    return layers;
  }

  // Reliably capture hikr's Leaflet map by hooking the L.Map constructor as soon
  // as Leaflet is defined (before hikr builds the minimap) — independent of hikr's
  // internal property names.
  function patchMapCapture(L) {
    if (!L || !L.Map || L.Map.__hikrCapture) return;
    var proto = L.Map.prototype;
    var origInit = proto.initialize;
    proto.initialize = function () {
      try { window.__hikrCapturedMap = this; } catch (_) {}
      return origInit.apply(this, arguments);
    };
    L.Map.__hikrCapture = true;
  }
  if (window.L) {
    patchMapCapture(window.L);
  } else {
    try {
      var _L;
      Object.defineProperty(window, "L", {
        configurable: true,
        enumerable: true,
        get: function () { return _L; },
        set: function (value) { _L = value; try { patchMapCapture(value); } catch (_) {} }
      });
    } catch (_) {}
  }

  function mapAlreadyOpen() {
    var map = document.getElementById("map");
    if (!map) return false;
    if (map.querySelector("canvas, .leaflet-container, iframe")) return true;
    var height = parseInt(map.style.height || "0", 10);
    return height >= 300;
  }
  function tryOpenMap() {
    if (state.mapDone) return true;
    if (mapAlreadyOpen()) { state.mapDone = true; return true; }
    try {
      if (typeof r4miniMapInit === "function") {
        r4miniMapInit();
        state.mapDone = mapAlreadyOpen();
        if (state.mapDone) return true;
      }
    } catch (_) {}
    var anchor = document.querySelector(
      'a[href*="r4miniMapInit"], a[onclick*="r4miniMapInit"], a[onclick*="r4miniopen"]'
    );
    if (anchor) {
      try { anchor.click(); } catch (_) {}
    }
    return mapAlreadyOpen();
  }
  function tryOpenProfile() {
    if (state.profileDone) return true;
    var anchors = document.querySelectorAll('a[onclick*="show_profile"]');
    if (!anchors.length) return false;
    if (typeof show_profile !== "function") return false;
    var fired = false;
    anchors.forEach(function (anchor) {
      var match = (anchor.getAttribute("onclick") || "").match(/show_profile\(([^)]+)\)/);
      if (!match) return;
      try {
        show_profile.apply(null, match[1].split(",").map(Number));
        fired = true;
      } catch (_) {}
    });
    state.profileDone = fired;
    return state.profileDone;
  }
  // Captured instance first; fall back to walking hikr's controller object.
  function findLeafletMap(L) {
    var cap = window.__hikrCapturedMap;
    try { if (cap && L.Map && cap instanceof L.Map) return cap; } catch (_) {}
    var root = window.hmap;
    if (!root || !L.Map) return null;
    var seen = new Set();
    var stack = [root];
    var steps = 0;
    while (stack.length && steps < 8000) {
      steps++;
      var o = stack.pop();
      if (!o || typeof o !== "object" || seen.has(o)) continue;
      seen.add(o);
      try { if (o instanceof L.Map) return o; } catch (_) {}
      for (var k in o) {
        try {
          var v = o[k];
          if (v && typeof v === "object" && !seen.has(v)) stack.push(v);
        } catch (_) {}
      }
    }
    return null;
  }
  // Add our OWN, extension-branded base-layer switcher — deliberately separate from
  // hikr's control, so both can be active at once (handy when hikr's Google tiles
  // fail without an API key).
  function tryEnhanceLayers() {
    if (state.layersDone) return true;
    var L = window.L;
    if (L) patchMapCapture(L);
    if (!L || !L.tileLayer || !L.control) return false;
    var map = findLeafletMap(L);
    if (!map) return false;

    var off = L.layerGroup();
    try { off.addTo(map); } catch (_) {}
    var bases = { "Aus": off };
    var mine = buildBaseLayers(L);
    Object.keys(mine).forEach(function (name) { bases[name] = mine[name]; });

    var control;
    try {
      control = L.control.layers(bases, {}, { position: "topright", collapsed: false });
      control.addTo(map);
    } catch (err) {
      try { console.warn("[HIKR] Layer-Control konnte nicht hinzugefügt werden:", err); } catch (_) {}
      return false;
    }

    try {
      var container = control.getContainer();
      if (container) {
        container.classList.add("hikr-ext-leaflet-layers");
        container.title = "HIKR Karten-Layer (Erweiterung)";
        var list = container.querySelector(".leaflet-control-layers-list");
        if (list && !list.querySelector(".hikr-ext-leaflet-layers-title")) {
          var heading = document.createElement("div");
          heading.className = "hikr-ext-leaflet-layers-title";
          heading.textContent = "⛰ HIKR Karten";
          list.insertBefore(heading, list.firstChild);
        }
      }
    } catch (_) {}

    state.layersDone = true;
    try {
      console.log("[HIKR] Eigenes Karten-Layer-Control hinzugefügt (OpenTopoMap/OpenStreetMap" + (mapyKey ? "/Mapy" : "") + ").");
    } catch (_) {}
    return true;
  }
  var interval;
  var observer;
  function tick() {
    var mapOk = tryOpenMap();
    var profileOk = tryOpenProfile();
    if (mapOk) tryEnhanceLayers();
    var stop = (mapOk && profileOk && state.layersDone) || Date.now() > deadline;
    if (stop) {
      if (!state.layersDone && !warned) {
        warned = true;
        try {
          console.warn(mapOk
            ? "[HIKR] Leaflet-Karte nicht gefunden – eigenes Layer-Control nicht hinzugefügt."
            : "[HIKR] Minimap nicht geöffnet – eigenes Layer-Control nicht hinzugefügt.");
        } catch (_) {}
      }
      if (observer) observer.disconnect();
      clearInterval(interval);
    }
  }
  interval = setInterval(tick, 400);
  observer = new MutationObserver(tick);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "complete" || document.readyState === "interactive") tick();
  else window.addEventListener("DOMContentLoaded", tick, { once: true });
})();
