(function () {
  if (window.__hikrExtMiniMapBound) return;
  window.__hikrExtMiniMapBound = true;
  var state = { mapDone: false, profileDone: false };
  var deadline = Date.now() + 15000;
  function mapAlreadyOpen() {
    var map = document.getElementById("map");
    if (!map) return false;
    if (map.querySelector("canvas, .leaflet-container, iframe")) return true;
    var height = parseInt(map.style.height || "0", 10);
    return height >= 300;
  }
  function tryOpenMap() {
    if (state.mapDone) return true;
    if (mapAlreadyOpen()) {
      state.mapDone = true;
      return true;
    }
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
    return state.mapDone || mapAlreadyOpen();
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
  var interval;
  var observer;
  function tick() {
    var mapOk = tryOpenMap();
    var profileOk = tryOpenProfile();
    if ((mapOk && profileOk) || Date.now() > deadline) {
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
