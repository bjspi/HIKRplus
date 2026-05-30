import type { HikrFeature } from "../feature-types";
import { sendMessage } from "../../shared/messages";
import { annotateWaypointAnchors } from "./waypoint-gmaps-links";

export const hoverPreviewFeature: HikrFeature = {
  id: "hoverPreview",
  title: "Hover Preview",
  defaultEnabled: true,
  matchesPage: (context) => context.isTopFrame,
  run({ root, settings }) {
    if (document.querySelector(".hikr-ext-preview-overlay")) return;

    // Overlay goes directly in document.body so backdrop-filter blurs the real page
    const overlay = document.createElement("div");
    overlay.className = "hikr-ext-preview-overlay";
    overlay.setAttribute("hidden", "");
    overlay.innerHTML = `
      <div class="hikr-ext-preview-frame">
        <button class="hikr-ext-preview-close" type="button" aria-label="Schließen">✕</button>
        <iframe sandbox="allow-same-origin allow-scripts"></iframe>
      </div>
    `;
    document.body.appendChild(overlay);

    const iframe = overlay.querySelector("iframe")!;

    window.addEventListener("message", (event) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { type?: string; href?: string } | undefined;
      if (data?.type !== "HIKR_EXT_OPEN_EXTERNAL_MAP" || !data.href) return;
      try {
        const url = new URL(data.href);
        if (!["http:", "https:"].includes(url.protocol)) return;
        void sendMessage({ type: "OPEN_EXTERNAL_URL", url: url.href }).catch(() => {
          window.open(url.href, "_blank", "noopener,noreferrer");
        });
      } catch {
        return;
      }
    });

    const enableGallery = settings.features.hoverPreviewGallery;
    const galleryUrl = chrome.runtime.getURL("inject/gallery-bridge.js");
    const enableMinimap = settings.ui.alwaysOpenMiniMaps;
    const minimapUrl = chrome.runtime.getURL("inject/minimap-bridge.js");

    function inject(doc: Document, key: string, src: string) {
      if (doc.querySelector(`script[data-hikr-ext-bridge="${key}"]`)) return;
      const script = doc.createElement("script");
      script.dataset.hikrExtBridge = key;
      script.src = src;
      script.async = false;
      doc.documentElement.appendChild(script);
    }
    function bridgeExternalMapLinks(doc: Document) {
      if (doc.documentElement.dataset.hikrExtExternalMapBridge) return;
      doc.documentElement.dataset.hikrExtExternalMapBridge = "true";
      doc.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : undefined;
        const anchor = target?.closest<HTMLAnchorElement>("a.hikr-ext-external-map-link[href]");
        if (!anchor) return;
        event.preventDefault();
        event.stopPropagation();
        window.parent.postMessage({ type: "HIKR_EXT_OPEN_EXTERNAL_MAP", href: anchor.href }, location.origin);
      }, true);
    }
    const GMAPS_LINK_CSS = `
      .hikr-ext-gmaps-link {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 15px !important;
        height: 15px !important;
        margin-left: 5px !important;
        border: 1px solid #ccc !important;
        border-radius: 3px !important;
        color: #999 !important;
        text-decoration: none !important;
        font-size: 10px !important;
        vertical-align: middle !important;
        line-height: 1 !important;
        opacity: 0.85;
      }
      .hikr-ext-gmaps-link:hover {
        border-color: #888 !important;
        color: #555 !important;
        opacity: 1;
      }
    `;

    function injectGmapsLinkStyle(doc: Document) {
      if (doc.getElementById("hikr-ext-gmaps-style")) return;
      const style = doc.createElement("style");
      style.id = "hikr-ext-gmaps-style";
      style.textContent = GMAPS_LINK_CSS;
      doc.documentElement.appendChild(style);
    }

    const enableGmapsLinks = settings.ui.waypointGmapsLinks;
    iframe.addEventListener("load", () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        if (enableGallery) inject(doc, "gallery", galleryUrl);
        if (enableMinimap) inject(doc, "minimap", minimapUrl);
        bridgeExternalMapLinks(doc);
        if (enableGmapsLinks) {
          injectGmapsLinkStyle(doc);
          void annotateWaypointAnchors(doc, settings).then(() => bridgeExternalMapLinks(doc)).catch(() => undefined);
        }
      } catch (error) {
        console.warn("HIKR hover preview bridges failed", error);
      }
    });

    let currentDelay = Math.max(0, settings.ui.hoverPreviewDelay ?? 750);

    // Live-Update wenn der User den Slider in den Optionen ändert (kein Reload nötig)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      const newVal = (changes["hikr.settings"]?.newValue as { ui?: { hoverPreviewDelay?: number } } | undefined)?.ui?.hoverPreviewDelay;
      if (typeof newVal === "number") currentDelay = Math.max(0, newVal);
    });

    let showTimer: number | undefined;
    let hideTimer: number | undefined;
    let activeAnchor: HTMLAnchorElement | undefined;

    const show = (anchor: HTMLAnchorElement) => {
      clearTimeout(hideTimer);
      activeAnchor = anchor;
      if (currentDelay === 0) {
        iframe.src = anchor.href;
        overlay.removeAttribute("hidden");
        return;
      }
      showTimer = window.setTimeout(() => {
        if (activeAnchor !== anchor) return;
        iframe.src = anchor.href;
        overlay.removeAttribute("hidden");
      }, currentDelay);
    };

    const hide = () => {
      clearTimeout(showTimer);
      hideTimer = window.setTimeout(() => {
        overlay.setAttribute("hidden", "");
        activeAnchor = undefined;
      }, 80);
    };

    const forceHide = () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      overlay.setAttribute("hidden", "");
      activeAnchor = undefined;
    };

    // Close when clicking the dark backdrop (not the frame)
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) forceHide();
    });
    overlay.querySelector(".hikr-ext-preview-close")?.addEventListener("click", forceHide);

    // Keep alive when mouse is anywhere inside overlay
    overlay.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    overlay.addEventListener("mouseleave", hide);

    document.addEventListener("mouseover", (event) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
        'a[href*="hikr.org/dir/"], a[href*="hikr.org/tour/"], a[href*="hikr.org/user/"]'
      );
      if (!anchor || anchor.closest("#header")) return;
      show(anchor);
    });

    document.addEventListener("mouseout", (event) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
        'a[href*="hikr.org/dir/"], a[href*="hikr.org/tour/"], a[href*="hikr.org/user/"]'
      );
      if (!anchor) return;
      const related = event.relatedTarget as Node | null;
      if (related && (anchor.contains(related) || overlay.contains(related))) return;
      activeAnchor = undefined;
      hide();
    });

    // Escape key closes preview
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hasAttribute("hidden")) forceHide();
    });

    // Keep backward-compat: also attach to ext root for cleanup check
    const sentinel = document.createElement("span");
    sentinel.className = "hikr-ext-tooltip";
    sentinel.hidden = true;
    root.append(sentinel);
  }
};
