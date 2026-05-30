(function () {
  if (window.__hikrExtGalleryBridge) return;
  window.__hikrExtGalleryBridge = true;
  var imgs = [];
  function collect() {
    imgs = [];
    document.querySelectorAll('a[href*="f.hikr.org/files/"], a[href*="hikr.org/gallery/photo"]').forEach(function (a) {
      var img = a.querySelector("img");
      if (!img) return;
      var fileMatch = (a.href || "").match(/f\.hikr\.org\/files\/\d+\.(jpg|jpeg|png|gif)/i);
      var large = fileMatch ? a.href : (img.src || "").replace(/s(\.[a-z]+)$/i, "$1");
      if (large) imgs.push({ href: a.href, src: large, title: img.title || img.alt || "" });
    });
    document.querySelectorAll('img[src*="f.hikr.org/files/"]').forEach(function (img) {
      var src = img.src.replace(/s(\.[a-z]+)$/i, "$1");
      if (!imgs.some(function (e) { return e.src === src; })) {
        imgs.push({ href: src, src: src, title: img.alt || "" });
      }
    });
  }
  function ensureOverlay() {
    var existing = document.getElementById("hikrExtPreviewOverlay");
    if (existing) return existing;
    var overlay = document.createElement("div");
    overlay.id = "hikrExtPreviewOverlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(42,36,34,0.86);display:none;z-index:2147482700;color:#fff;align-items:center;justify-content:center;flex-direction:column;padding:18px;";
    overlay.innerHTML =
      '<button id="hikrExtPreviewClose" style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.25);padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:600">x</button>' +
      '<img id="hikrExtPreviewImg" style="max-width:96%;max-height:84vh;object-fit:contain;border-radius:4px" />' +
      '<div id="hikrExtPreviewCaption" style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.7)"></div>' +
      '<div style="margin-top:10px;display:flex;gap:10px">' +
      '<button id="hikrExtPreviewPrev" style="background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.25);padding:8px 14px;border-radius:6px;cursor:pointer;font-weight:600">&lsaquo;</button>' +
      '<button id="hikrExtPreviewNext" style="background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.25);padding:8px 14px;border-radius:6px;cursor:pointer;font-weight:600">&rsaquo;</button>' +
      "</div>";
    document.body.appendChild(overlay);
    return overlay;
  }
  var index = 0;
  function show(i) {
    if (!imgs.length) return;
    index = (i + imgs.length) % imgs.length;
    var overlay = ensureOverlay();
    overlay.style.display = "flex";
    overlay.querySelector("#hikrExtPreviewImg").src = imgs[index].src;
    overlay.querySelector("#hikrExtPreviewCaption").textContent = index + 1 + "/" + imgs.length + " " + (imgs[index].title || "");
  }
  function close() {
    var overlay = document.getElementById("hikrExtPreviewOverlay");
    if (overlay) overlay.style.display = "none";
  }
  document.addEventListener(
    "click",
    function (event) {
      var anchor = event.target.closest && event.target.closest('a[href*="f.hikr.org/files/"], a[href*="hikr.org/gallery/photo"]');
      if (!anchor) return;
      collect();
      var i = imgs.findIndex(function (e) { return e.href === anchor.href; });
      if (i < 0) return;
      event.preventDefault();
      event.stopPropagation();
      show(i);
    },
    true
  );
  document.addEventListener("click", function (event) {
    if (event.target && event.target.id === "hikrExtPreviewClose") close();
    if (event.target && event.target.id === "hikrExtPreviewPrev") show(index - 1);
    if (event.target && event.target.id === "hikrExtPreviewNext") show(index + 1);
  });
  document.addEventListener("keydown", function (event) {
    var overlay = document.getElementById("hikrExtPreviewOverlay");
    if (!overlay || overlay.style.display !== "flex") return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowRight") show(index + 1);
    if (event.key === "ArrowLeft") show(index - 1);
  });
})();
