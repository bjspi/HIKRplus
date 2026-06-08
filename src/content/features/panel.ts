import { t } from "../../shared/i18n";
import { isAutoRoutePageType } from "../../shared/url";
import type { HikrFeature } from "../feature-types";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

export const panelFeature: HikrFeature = {
  id: "siteStyles",
  title: "HIKR Action Panel",
  defaultEnabled: true,
  matchesPage: (context) => context.isTopFrame && (context.tourUrls.length > 0 || context.pageType === "searchResults" || context.hasListings),
  run({ root, page, settings }) {
    if (root.querySelector(".hikr-ext-panel")) return;
    // Excel / tour-details / map are listing tools — hide them on a single tour page.
    const isTour = page.pageType === "tour";
    const autoloadEnabled = page.pageType in settings.tourDetailsAutoload
      ? Boolean(settings.tourDetailsAutoload[page.pageType as keyof typeof settings.tourDetailsAutoload])
      : false;
    const detailsButton = (autoloadEnabled || isTour)
      ? ""
      : `<button class="hikr-ext-btn" data-hikr-action="enrich">${t("panel_btn_details")}</button>`;
    const savedRouteStart = localStorage.getItem("hikr.ext.route.start") ?? "";
    // The "auto travel-time" toggle only makes sense on search results and single tour
    // pages, so it is shown there only. Everywhere else the manual "Fahrtzeiten" button
    // must stay visible regardless of the persisted auto setting (otherwise the page
    // would have no routing control at all).
    const showAutoRoutes = isAutoRoutePageType(page.pageType);
    const autoRoutes = localStorage.getItem("hikr.ext.route.auto") === "true";
    const autoRoutesActive = autoRoutes && showAutoRoutes;
    const panel = document.createElement("section");
    panel.className = "hikr-ext-panel";
    panel.innerHTML = `
      <header>
        <img class="hikr-ext-panel-icon" src="${chrome.runtime.getURL("icons/hikr-icon-48.png")}" alt="" aria-hidden="true" draggable="false" />
        <img class="hikr-ext-panel-logo" src="${chrome.runtime.getURL("icons/hikr-logo-wide.png")}" alt="HIKR Enhancements" draggable="false" />
        <button class="hikr-ext-panel-collapse" type="button" aria-expanded="true" aria-label="${esc(t("panel_collapse"))}" title="${esc(t("panel_collapse"))}">–</button>
      </header>
      <main>
        <div class="hikr-ext-status">${t("panel_detected", { page: page.pageType, tours: page.tourUrls.length, waypoints: page.waypointUrls.length })}</div>
        <div class="hikr-ext-route-start">
          <label for="hikr-ext-route-start-input">${t("route_start_label")}</label>
          <div class="hikr-ext-suggest-wrap">
            <input id="hikr-ext-route-start-input" type="text" autocomplete="off" placeholder="${esc(t("route_start_placeholder"))}" value="${esc(savedRouteStart)}" />
            <button class="hikr-ext-input-clear" id="hikr-ext-route-start-clear" type="button" title="${esc(t("route_start_clear"))}" aria-label="${esc(t("route_start_clear"))}" ${savedRouteStart ? "" : "hidden"}>✕</button>
            <ul class="hikr-ext-suggest-list" id="hikr-ext-route-start-suggestions" hidden></ul>
          </div>
          <small>${t("route_start_hint")}</small>
        </div>
        ${showAutoRoutes
          ? `<label class="hikr-ext-panel-toggle">
          <input id="hikr-ext-route-auto" type="checkbox" ${autoRoutes ? "checked" : ""} />
          <span>${t("route_auto_label")}</span>
          <span class="hikr-ext-route-auto-count" id="hikr-ext-route-auto-count" aria-hidden="true" hidden></span>
          <span class="hikr-ext-route-auto-spinner" id="hikr-ext-route-auto-spinner" aria-hidden="true" hidden></span>
        </label>`
          : ""}
        <div class="hikr-ext-button-row">
          ${detailsButton}
          <button class="hikr-ext-btn" data-hikr-action="routes"${autoRoutesActive ? " hidden" : ""}>${t("panel_btn_routes")}</button>
          ${isTour ? "" : `<button class="hikr-ext-btn" data-hikr-action="map">${t("panel_btn_map")}</button>`}
          ${isTour ? "" : `<button class="hikr-ext-btn" data-hikr-action="excel">${t("panel_btn_excel")}</button>`}
          ${page.pageType === "searchResults"
            ? `<button class="hikr-ext-btn" data-hikr-action="sort">↕ Sortieren</button>`
            : ""}
          ${page.hasListings && !isTour
            ? `<button class="hikr-ext-btn" data-hikr-action="filter">Filter</button>`
            : ""}
          ${page.pageType === "searchResults" && settings.features.snowResearch
            ? `<button class="hikr-ext-btn" data-hikr-action="snow">❄ Schneelagen</button>`
            : ""}
        </div>
        <button class="hikr-ext-btn hikr-ext-btn-wide" data-hikr-action="options">${t("btn_options")}</button>
      </main>
    `;
    root.append(panel);
    setupPanelLayout(panel);
  }
};

// ---------------------------------------------------------------------------
// Draggable + collapsible panel
//
// The panel ships anchored via CSS `right/top`. Once the user drags it (or a
// stored layout is restored) we switch to inline `left/top` viewport coordinates.
// Layout (position + collapsed) is persisted synchronously in localStorage under a
// single key so a fresh `run()` can restore it before paint — matching the existing
// `hikr.ext.*` synchronous-read pattern used elsewhere in the panel (no flicker).
// `chrome.storage.sync` is deliberately avoided: it is async (would paint at the
// default spot then jump) and a position valid on one screen is wrong on another.
// ---------------------------------------------------------------------------

const LAYOUT_KEY = "hikr.ext.panel.layout";
const DRAG_THRESHOLD = 4; // px of movement before a press becomes a drag (vs a click)
const VIEWPORT_MARGIN = 8; // keep at least this much of the panel on-screen

// The panel is positioned by EDGE-ANCHORED offsets, not absolute left/top: it is pinned
// to whichever horizontal + vertical viewport edge its centre is nearest, storing the gap
// from that edge. Applied as CSS right/left + top/bottom, the browser then keeps the panel
// glued to that edge across viewport resizes — narrow the window and a right-anchored panel
// tracks inward, widen it again and it tracks back out (instead of stranding in the middle).
// It also makes collapse<->expand inherently corner-stable: the anchored edge stays put
// while the box shrinks to an icon or grows back, so the icon always tucks into — and
// expands out of — the same corner, with no extra re-anchor maths.
interface PanelPos {
  anchorRight: boolean;  // horizontal: anchored to the right edge (else left)
  anchorBottom: boolean; // vertical: anchored to the bottom edge (else top)
  offsetX: number;       // gap from the anchored horizontal edge to the panel's matching edge
  offsetY: number;       // gap from the anchored vertical edge to the panel's matching edge
}

interface PanelLayout {
  collapsed: boolean;
  pos: PanelPos | null;  // null = still on the default CSS anchor (never positioned)
}

let resizeListenerInstalled = false;
// The panel's current edge-anchored position, or null while it still uses the default CSS
// anchor. Module-scoped: there is only ever one panel (the run() guard), re-derived from
// localStorage on each fresh page load.
let panelPos: PanelPos | null = null;

function readLayout(): PanelLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return { collapsed: false, pos: null };
    const parsed = JSON.parse(raw) as Partial<PanelLayout>;
    const collapsed = Boolean(parsed.collapsed);
    const p = parsed.pos ?? undefined;
    const offsetX = Number(p?.offsetX);
    const offsetY = Number(p?.offsetY);
    if (!p || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return { collapsed, pos: null };
    return {
      collapsed,
      pos: { anchorRight: Boolean(p.anchorRight), anchorBottom: Boolean(p.anchorBottom), offsetX, offsetY }
    };
  } catch {
    return { collapsed: false, pos: null };
  }
}

function writeLayout(panel: HTMLElement): void {
  const layout: PanelLayout = {
    collapsed: panel.classList.contains("hikr-ext-panel-collapsed"),
    pos: panelPos
  };
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* localStorage can fail in private / restricted contexts */
  }
}

// Derive an edge-anchored position from a rendered rect: anchor to the nearer horizontal
// and vertical edges, recording the gap to each.
function posFromRect(rect: DOMRect): PanelPos {
  const anchorRight = rect.left + rect.width / 2 > window.innerWidth / 2;
  const anchorBottom = rect.top + rect.height / 2 > window.innerHeight / 2;
  return {
    anchorRight,
    anchorBottom,
    offsetX: anchorRight ? window.innerWidth - rect.right : rect.left,
    offsetY: anchorBottom ? window.innerHeight - rect.bottom : rect.top
  };
}

// Clamp the offsets so the whole panel stays on-screen. The opposite-edge bound uses the
// panel's own width/height (so it can never be pushed past the far edge); the vertical
// bound prefers keeping the whole panel visible but falls back to keeping at least the
// header (drag handle) reachable when the panel is taller than the viewport.
function clampPos(panel: HTMLElement, pos: PanelPos): PanelPos {
  const rect = panel.getBoundingClientRect();
  const header = panel.querySelector<HTMLElement>("header");
  const headerHeight = header ? header.getBoundingClientRect().height : rect.height;
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
  const fitY = window.innerHeight - rect.height - VIEWPORT_MARGIN;
  const maxY = fitY >= VIEWPORT_MARGIN
    ? fitY
    : Math.max(VIEWPORT_MARGIN, window.innerHeight - headerHeight - VIEWPORT_MARGIN);
  return {
    anchorRight: pos.anchorRight,
    anchorBottom: pos.anchorBottom,
    offsetX: Math.min(Math.max(pos.offsetX, VIEWPORT_MARGIN), maxX),
    offsetY: Math.min(Math.max(pos.offsetY, VIEWPORT_MARGIN), maxY)
  };
}

function applyEdgePosition(panel: HTMLElement, pos: PanelPos): void {
  panel.style.left = pos.anchorRight ? "auto" : `${pos.offsetX}px`;
  panel.style.right = pos.anchorRight ? `${pos.offsetX}px` : "auto";
  panel.style.top = pos.anchorBottom ? "auto" : `${pos.offsetY}px`;
  panel.style.bottom = pos.anchorBottom ? `${pos.offsetY}px` : "auto";
}

// Clamp + store (module) + apply an edge-anchored position.
function setPanelPos(panel: HTMLElement, pos: PanelPos): void {
  panelPos = clampPos(panel, pos);
  applyEdgePosition(panel, panelPos);
}

// Absolute left/top used only DURING a drag for smooth pointer-following; the drag end
// snaps back to an edge-anchored position via posFromRect/setPanelPos.
function applyAbsolute(panel: HTMLElement, left: number, top: number): void {
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

// Re-clamp the current position against the live viewport/size (after a resize or a
// collapse/expand size change). CSS edge anchoring already tracks the edge; this only
// pulls the panel back if it would now overflow the opposite edge or exceed the height.
function reclamp(panel: HTMLElement): void {
  if (panelPos) setPanelPos(panel, panelPos);
}

function setCollapsed(panel: HTMLElement, collapsed: boolean): void {
  // Seed an explicit edge-anchored position from the current (default-CSS-anchored) rect
  // on the very first collapse, then keep the panel edge-anchored so the size change tucks
  // the icon into / grows the panel out of the same corner automatically (CSS does it).
  if (!panelPos) panelPos = clampPos(panel, posFromRect(panel.getBoundingClientRect()));
  applyEdgePosition(panel, panelPos);
  const button = panel.querySelector<HTMLButtonElement>(".hikr-ext-panel-collapse");
  const hadButtonFocus = document.activeElement === button;
  panel.classList.toggle("hikr-ext-panel-collapsed", collapsed);
  applyCollapsedAria(panel, collapsed);
  // Keep keyboard focus on a still-operable control across the toggle: the collapse
  // button is hidden when collapsed (the header becomes the expand control), so move
  // focus from one to the other instead of dropping it.
  const header = panel.querySelector<HTMLElement>("header");
  if (collapsed && hadButtonFocus) header?.focus();
  else if (!collapsed && document.activeElement === header) button?.focus();
  // An open sort/filter submenu is intentionally left mounted: while collapsed it is
  // hidden along with `main` (display:none) and on expand it reappears exactly as the
  // user left it — so a filter that was open re-opens immediately. (The applied filter
  // classes on the cards persist regardless; collapsing hides the control, not its effect.)
  reclamp(panel); // edge anchoring keeps the corner; re-clamp guards the new size
  writeLayout(panel);
}

function setupPanelLayout(panel: HTMLElement): void {
  const header = panel.querySelector<HTMLElement>("header");
  const collapseButton = panel.querySelector<HTMLButtonElement>(".hikr-ext-panel-collapse");
  if (!header) return;

  // Restore persisted layout synchronously, before the browser paints the panel.
  const layout = readLayout();
  if (layout.collapsed) setCollapsedSilently(panel);
  if (layout.pos) setPanelPos(panel, layout.pos);

  collapseButton?.addEventListener("click", (event) => {
    event.preventDefault();
    setCollapsed(panel, !panel.classList.contains("hikr-ext-panel-collapsed"));
  });

  // When collapsed, the dedicated collapse button is hidden and the header itself is the
  // expand control (role=button, tabindex=0 via applyCollapsedAria). Make it keyboard
  // operable; pointer drag still works because dragging is handled on pointer events.
  header.addEventListener("keydown", (event) => {
    if (!panel.classList.contains("hikr-ext-panel-collapsed")) return;
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      setCollapsed(panel, false);
    }
  });

  let drag: {
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    moved: boolean;
  } | null = null;

  header.addEventListener("pointerdown", (event) => {
    // Never start a drag from an interactive header control (the collapse button).
    if ((event.target as HTMLElement).closest("button, a, input, label")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      moved: false
    };
    header.setPointerCapture(event.pointerId);
  });

  header.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      panel.classList.add("hikr-ext-panel-dragging");
      // Seed absolute left/top from the rendered rect so converting from edge anchoring
      // causes no visual jump; the drag end snaps back to an edge-anchored position.
      applyAbsolute(panel, drag.originLeft, drag.originTop);
    }
    event.preventDefault();
    applyAbsolute(panel, drag.originLeft + dx, drag.originTop + dy);
  });

  // `allowClick` distinguishes a real release (pointerup) from an interruption
  // (pointercancel). Only a genuine click on the collapsed puck re-opens it; a cancel
  // must simply abort the gesture, otherwise an interrupted drag would expand the panel.
  const endDrag = (event: PointerEvent, allowClick: boolean): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const moved = drag.moved;
    try { header.releasePointerCapture(drag.pointerId); } catch { /* already released */ }
    drag = null;
    panel.classList.remove("hikr-ext-panel-dragging");
    if (moved) {
      // Snap to the nearest edges so the panel sticks to them across later resizes.
      setPanelPos(panel, posFromRect(panel.getBoundingClientRect()));
      writeLayout(panel);
    } else if (allowClick && panel.classList.contains("hikr-ext-panel-collapsed")) {
      // A click (no drag) on the collapsed puck re-opens the panel.
      setCollapsed(panel, false);
    }
  };
  header.addEventListener("pointerup", (event) => endDrag(event, true));
  header.addEventListener("pointercancel", (event) => endDrag(event, false));

  // Module-level listeners that keep a positioned panel glued to its edge and on-screen.
  // `resize` re-clamps live; `pageshow` covers returning to a hikr tab that was resized
  // while in the background (e.g. shrink the window on another site, then come back).
  // Guarded so repeated run() calls never stack listeners.
  if (!resizeListenerInstalled) {
    resizeListenerInstalled = true;
    const reclampPanel = (): void => {
      const current = document.querySelector<HTMLElement>(".hikr-ext-panel");
      if (current) reclamp(current);
    };
    window.addEventListener("resize", reclampPanel);
    window.addEventListener("pageshow", reclampPanel);
  }
}

// Keep the accessible state in sync with the collapsed class. Expanded: the collapse
// <button> carries aria-expanded/label and the header is a plain drag handle. Collapsed:
// the button is visually hidden, so the header becomes the expand control (role=button,
// focusable, labelled) — otherwise a keyboard/SR user could collapse but never re-expand.
function applyCollapsedAria(panel: HTMLElement, collapsed: boolean): void {
  const button = panel.querySelector<HTMLButtonElement>(".hikr-ext-panel-collapse");
  if (button) {
    button.setAttribute("aria-expanded", String(!collapsed));
    const label = collapsed ? t("panel_expand") : t("panel_collapse");
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  }
  const header = panel.querySelector<HTMLElement>("header");
  if (!header) return;
  if (collapsed) {
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-label", t("panel_expand"));
    header.setAttribute("aria-expanded", "false");
  } else {
    header.removeAttribute("role");
    header.removeAttribute("tabindex");
    header.removeAttribute("aria-label");
    header.removeAttribute("aria-expanded");
  }
}

// Apply the collapsed class + aria during synchronous restore without persisting or
// re-clamping (the caller clamps once after position is applied).
function setCollapsedSilently(panel: HTMLElement): void {
  panel.classList.add("hikr-ext-panel-collapsed");
  applyCollapsedAria(panel, true);
}
