export const CONTENT_CSS = `
:root {
  --hikr-bg: #fbfaf8;
  --hikr-surface: #ffffff;
  --hikr-surface-soft: #faf6f4;
  --hikr-ink: #2a2422;
  --hikr-ink-soft: #4a3f3c;
  --hikr-muted: #82766f;
  --hikr-line: #ece5e1;
  --hikr-line-strong: #d9cfc9;
  --hikr-accent: #a04f4a;
  --hikr-accent-strong: #8a3f3b;
  --hikr-accent-soft: #c97a74;
  --hikr-accent-pale: #f1dedb;
  --hikr-accent-mist: #faeeeb;
  --hikr-gold: #b88a4a;
}
#hikr-ext-root {
  position: relative;
  z-index: 2147482000;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --hikr-bg: #fbfaf8;
  --hikr-surface: #ffffff;
  --hikr-surface-soft: #faf6f4;
  --hikr-ink: #2a2422;
  --hikr-ink-soft: #4a3f3c;
  --hikr-muted: #82766f;
  --hikr-line: #ece5e1;
  --hikr-line-strong: #d9cfc9;
  --hikr-accent: #a04f4a;
  --hikr-accent-strong: #8a3f3b;
  --hikr-accent-soft: #c97a74;
  --hikr-accent-pale: #f1dedb;
  --hikr-accent-mist: #faeeeb;
  --hikr-gold: #b88a4a;
}
html:has(#hikr-ext-root),
body:has(#hikr-ext-root) {
  overflow-x: clip;
}
body.hikr-ext-wide-layout {
  min-width: 0 !important;
}
body.hikr-ext-wide-layout #page,
body.hikr-ext-wide-layout #wrap,
body.hikr-ext-wide-layout #wrapper,
body.hikr-ext-wide-layout #container,
body.hikr-ext-wide-layout #content,
body.hikr-ext-wide-layout #content_swiss,
body.hikr-ext-wide-layout #contentmain,
body.hikr-ext-wide-layout #contentmain_swiss {
  box-sizing: border-box !important;
}
body.hikr-ext-wide-layout #page,
body.hikr-ext-wide-layout #wrap,
body.hikr-ext-wide-layout #wrapper,
body.hikr-ext-wide-layout #container,
body.hikr-ext-wide-layout #content,
body.hikr-ext-wide-layout #content_swiss,
body.hikr-ext-wide-layout #contentmain {
  width: min(1480px, calc(100vw - 48px)) !important;
  max-width: min(1480px, calc(100vw - 48px)) !important;
}
body.hikr-ext-wide-layout #page {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: flex-start !important;
  gap: 0 14px !important;
}
body.hikr-ext-wide-layout #page > #header,
body.hikr-ext-wide-layout #page > .hr,
body.hikr-ext-wide-layout #page > #cleardiv,
body.hikr-ext-wide-layout #page > #footer,
body.hikr-ext-wide-layout #page > .pnav,
body.hikr-ext-wide-layout #page > .mnav {
  flex: 0 0 100% !important;
  width: 100% !important;
  max-width: 100% !important;
}
body.hikr-ext-wide-layout #page > br { display: none !important; }
body.hikr-ext-wide-layout #page > div[style*="display:flex"],
body.hikr-ext-wide-layout #page > div[style*="display: flex"] {
  flex: 0 0 100% !important;
  width: 100% !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start !important;
  gap: 14px !important;
}
body.hikr-ext-wide-layout #contentmain_swiss {
  flex: 1 1 calc(100% - 334px) !important;
  width: auto !important;
  max-width: none !important;
  min-width: 0 !important;
  float: none !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}
body.hikr-ext-wide-layout #menu_rs_swiss {
  flex: 0 0 320px !important;
  width: 320px !important;
  max-width: 320px !important;
  float: none !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}
body.hikr-ext-wide-layout #contentmain_swiss > div,
body.hikr-ext-wide-layout #contentmain_swiss .content,
body.hikr-ext-wide-layout #contentmain_swiss .content-center,
body.hikr-ext-wide-layout #contentmain_swiss .main_text {
  width: auto !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}
body.hikr-ext-wide-layout #contentmain_swiss table.fiche_rando {
  width: 100% !important;
}
body.hikr-ext-wide-layout .content-list,
body.hikr-ext-wide-layout .content-list-intern_div {
  max-width: 100% !important;
  box-sizing: border-box !important;
}
body.hikr-ext-wide-layout .content-list > div,
body.hikr-ext-wide-layout .content-list-intern_div > div {
  max-width: 100% !important;
  box-sizing: border-box !important;
}
@media (max-width: 980px) {
  body.hikr-ext-wide-layout #page {
    display: block !important;
  }
  body.hikr-ext-wide-layout #contentmain_swiss,
  body.hikr-ext-wide-layout #menu_rs_swiss {
    width: 100% !important;
    max-width: 100% !important;
    float: none !important;
    flex: none !important;
  }
}
.hikr-ext-panel {
  position: fixed;
  right: 16px;
  top: 72px;
  width: 320px;
  max-width: calc(100vw - 32px);
  background: var(--hikr-surface);
  border: 1px solid var(--hikr-line);
  box-shadow: 0 8px 24px rgba(42, 36, 34, 0.08);
  border-radius: 10px;
  color: var(--hikr-ink);
  overflow: hidden;
  box-sizing: border-box;
}
.hikr-ext-panel *,
.hikr-ext-panel *::before,
.hikr-ext-panel *::after {
  box-sizing: border-box;
}
.hikr-ext-panel header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 10px;
  background: var(--hikr-surface-soft);
  color: var(--hikr-ink);
  border-bottom: 1px solid var(--hikr-line);
  position: relative;
}
.hikr-ext-panel header::after {
  content: "";
  position: absolute;
  left: 14px; right: 14px; bottom: -1px;
  height: 2px;
  background: linear-gradient(90deg, var(--hikr-accent) 0%, var(--hikr-gold) 100%);
  opacity: 0.45;
}
.hikr-ext-panel-logo {
  height: 22px;
  width: auto;
  display: block;
  object-fit: contain;
  opacity: 0.92;
}
.hikr-ext-panel strong {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.hikr-ext-panel main {
  padding: 12px 14px;
  display: grid;
  gap: 10px;
}
.hikr-ext-button-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.hikr-ext-route-start {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.hikr-ext-route-start label {
  font-size: 11px;
  font-weight: 650;
  color: var(--hikr-ink-soft);
}
.hikr-ext-route-start input {
  width: 100%;
  min-width: 0;
  min-height: 30px;
  border: 1px solid var(--hikr-line-strong);
  border-radius: 6px;
  padding: 5px 28px 5px 8px;
  background: var(--hikr-surface);
  color: var(--hikr-ink);
  font-size: 12px;
}
.hikr-ext-input-clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 0;
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  font-size: 11px;
  color: var(--hikr-ink-soft);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hikr-ext-input-clear:hover {
  background: var(--hikr-line-strong);
  color: var(--hikr-ink);
}
.hikr-ext-input-clear[hidden] { display: none !important; }
.hikr-ext-route-start input:focus {
  outline: none;
  border-color: var(--hikr-accent-soft);
  box-shadow: 0 0 0 3px rgba(201, 122, 116, 0.15);
}
.hikr-ext-route-start small {
  color: var(--hikr-muted);
  font-size: 10.5px;
  line-height: 1.35;
}
.hikr-ext-panel-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--hikr-ink);
  font-size: 12px;
  cursor: pointer;
}
.hikr-ext-panel-toggle input { flex: 0 0 auto; }
.hikr-ext-route-auto-spinner {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 2px solid rgba(130, 118, 111, 0.3);
  border-top-color: var(--hikr-accent-strong);
  animation: hikr-ext-spin .7s linear infinite;
}
.hikr-ext-route-auto-spinner[hidden] { display: none !important; }
.hikr-ext-route-auto-count {
  flex: 0 0 auto;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--hikr-ink-soft, var(--hikr-ink));
  opacity: 0.75;
}
.hikr-ext-route-auto-count[hidden] { display: none !important; }
.hikr-ext-panel-toggle input {
  appearance: none;
  width: 30px;
  height: 17px;
  margin: 0;
  border-radius: 999px;
  border: 1px solid var(--hikr-line-strong);
  background: #ede5e0;
  position: relative;
  cursor: pointer;
}
.hikr-ext-panel-toggle input::after {
  content: "";
  position: absolute;
  width: 11px;
  height: 11px;
  left: 2px;
  top: 2px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(42, 36, 34, 0.2);
  transition: transform .18s ease;
}
.hikr-ext-panel-toggle input:checked {
  background: var(--hikr-accent);
  border-color: var(--hikr-accent-strong);
}
.hikr-ext-panel-toggle input:checked::after {
  transform: translateX(13px);
}
.hikr-ext-btn {
  border: 1px solid var(--hikr-line-strong);
  background: var(--hikr-surface);
  color: var(--hikr-ink);
  min-height: 30px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: color .12s ease, border-color .12s ease, background .12s ease;
}
.hikr-ext-btn:hover {
  background: var(--hikr-surface-soft);
  border-color: var(--hikr-accent-soft);
  color: var(--hikr-accent-strong);
}
.hikr-ext-btn:disabled {
  opacity: .68;
  cursor: wait;
}
.hikr-ext-btn-loading {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.hikr-ext-btn-loading::before {
  content: "";
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(130, 118, 111, 0.35);
  border-top-color: var(--hikr-accent-strong);
  animation: hikr-ext-spin .75s linear infinite;
}
.hikr-ext-btn-wide {
  width: 100%;
  margin-top: 4px;
}
@keyframes hikr-ext-spin {
  to { transform: rotate(360deg); }
}
.hikr-ext-sort-menu {
  border: 1px solid var(--hikr-line);
  border-radius: 8px;
  background: var(--hikr-surface-soft);
  padding: 8px;
  display: grid;
  gap: 6px;
}
.hikr-ext-sort-menu.hikr-ext-sort-busy {
  opacity: .6;
  pointer-events: none;
}
.hikr-ext-sort-head {
  font-size: 11px;
  font-weight: 650;
  color: var(--hikr-ink-soft);
  padding: 0 2px;
}
.hikr-ext-sort-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.hikr-ext-sort-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border: 1px solid var(--hikr-line-strong);
  background: var(--hikr-surface);
  color: var(--hikr-ink);
  min-height: 28px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11.5px;
  font-weight: 500;
  text-align: left;
  transition: color .12s ease, border-color .12s ease, background .12s ease;
}
.hikr-ext-sort-item:hover {
  background: var(--hikr-surface-soft);
  border-color: var(--hikr-accent-soft);
  color: var(--hikr-accent-strong);
}
.hikr-ext-sort-item.hikr-ext-sort-active {
  border-color: var(--hikr-accent);
  color: var(--hikr-accent-strong);
  background: rgba(201, 122, 116, 0.1);
}
.hikr-ext-sort-arrow {
  font-size: 10px;
  line-height: 1;
  color: var(--hikr-accent-strong);
}
.hikr-ext-sort-note {
  font-size: 10px;
  color: var(--hikr-muted);
  line-height: 1.35;
  padding: 0 2px;
}
.hikr-ext-sort-note[hidden] { display: none !important; }
.hikr-ext-autosort {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--hikr-ink-soft);
  background: var(--hikr-surface-soft);
  border: 1px solid var(--hikr-line);
  border-radius: 6px;
  padding: 6px 9px;
  line-height: 1.3;
}
.hikr-ext-autosort b { font-weight: 650; color: var(--hikr-ink); }
.hikr-ext-autosort-hint { color: var(--hikr-muted); }
.hikr-ext-sort-spinner {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 2px solid rgba(130, 118, 111, 0.35);
  border-top-color: var(--hikr-accent-strong);
  animation: hikr-ext-spin .75s linear infinite;
}
.hikr-ext-status {
  font-size: 11px;
  color: var(--hikr-muted);
  line-height: 1.4;
}
.hikr-ext-tour-details {
  display: block;
  clear: none;
  margin: 3px 0 5px;
  font: inherit;
  font-size: 0.85em;
  color: inherit;
  line-height: 1.35;
  min-height: 0;
  overflow: visible;
}
div.hikr-ext-tour-details:not(.hikr-ext-tour-inline) {
  border-left: 2px solid var(--hikr-accent-pale);
  padding-left: 6px;
  border-radius: 0 2px 2px 0;
}
.hikr-ext-tour-details::before {
  content: "";
  color: #999;
}
.hikr-ext-tour-details a { font-size: inherit; }
span.hikr-ext-tour-inline {
  display: inline;
  color: var(--hikr-muted);
  font-size: 0.82em;
}
span.hikr-ext-tour-inline:not(.hikr-ext-tour-pending)::before { content: " ("; }
span.hikr-ext-tour-inline:not(.hikr-ext-tour-pending)::after { content: ")"; }
span.hikr-ext-tour-inline .hikr-ext-stats { display: inline; }
span.hikr-ext-tour-inline .hikr-ext-sep { display: inline; }
span.hikr-ext-tour-inline .hikr-ext-route-result,
span.hikr-ext-tour-inline .hikr-ext-waypoint-list { display: none; }
li[id^="item_"] span.hikr-ext-tour-inline {
  display: block;
  margin-top: 3px;
}
li[id^="item_"] span.hikr-ext-tour-inline::before,
li[id^="item_"] span.hikr-ext-tour-inline::after { content: ""; }
li[id^="item_"] span.hikr-ext-tour-inline .hikr-ext-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
}
.hikr-ext-tour-pending .hikr-ext-skeleton {
  display: inline-block;
  width: 220px;
  height: 0.9em;
  vertical-align: middle;
  border-radius: 2px;
  background: linear-gradient(90deg, #eee 0%, #ddd 50%, #eee 100%);
  background-size: 200% 100%;
  animation: hikr-ext-skel 1.6s ease-in-out infinite;
  opacity: 0.45;
}
.hikr-ext-tour-pending::before { content: " · "; color: #999; }
@keyframes hikr-ext-skel {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}
.hikr-ext-stats {
  font: inherit;
  color: inherit;
}
.hikr-ext-stats > span {
  white-space: nowrap;
}
.hikr-ext-route-result {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  margin: 2px 0 1px;
  color: #333;
  min-width: 0;
}
.hikr-ext-list-route {
  margin-top: 2px;
  font-size: 0.88em;
  color: #444;
}
.hikr-ext-fiche-route-row td {
  padding: 2px 0;
}
.hikr-ext-route-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  flex: 0 0 auto;
  line-height: 1.3;
}
.hikr-ext-route-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25em;
  min-width: 1.25em;
  color: #666;
  font-size: 0.95em;
}
.hikr-ext-route-time {
  color: var(--hikr-muted);
  font-size: 0.93em;
}
.hikr-ext-route-pending,
.hikr-ext-route-unavailable {
  color: var(--hikr-muted);
  font-size: 0.93em;
}
.hikr-ext-route-spinner {
  display: inline-block;
  width: 11px;
  height: 11px;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 2px solid rgba(130, 118, 111, 0.3);
  border-top-color: var(--hikr-accent-strong);
  animation: hikr-ext-spin .7s linear infinite;
}
.hikr-ext-sep {
  color: #aaa;
  margin: 0 2px;
}
.hikr-ext-link {
  color: inherit !important;
  text-decoration: underline !important;
  text-decoration-color: rgba(160, 79, 74, 0.45) !important;
  text-underline-offset: 2px;
}
.hikr-ext-link:hover {
  text-decoration-color: rgba(160, 79, 74, 0.9) !important;
}
.hikr-ext-gmaps-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  margin-left: 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
  color: #999 !important;
  text-decoration: none !important;
  font-size: 10px;
  vertical-align: middle;
  line-height: 1;
  opacity: 0.85;
}
.hikr-ext-gmaps-link:hover {
  border-color: #888;
  color: #555 !important;
  opacity: 1;
}
.hikr-ext-waypoint-list {
  display: block;
  margin-top: 4px;
  font: inherit;
  color: inherit;
}
.hikr-ext-waypoint-list summary {
  cursor: pointer;
  color: #666;
  padding: 2px 0;
  list-style: none;
  font-size: 0.95em;
}
.hikr-ext-waypoint-list summary::-webkit-details-marker { display: none; }
.hikr-ext-waypoint-list summary::before {
  content: "▸ ";
  color: #999;
}
.hikr-ext-waypoint-list[open] summary::before { content: "▾ "; }
.hikr-ext-waypoint-list summary:hover { color: #333; }
.hikr-ext-waypoint-list ol {
  margin: 4px 0 0 18px;
  padding: 0;
  display: grid;
  gap: 1px;
  font-size: 0.95em;
}
.hikr-ext-waypoint-list a {
  color: inherit;
  text-decoration: none;
}
.hikr-ext-waypoint-list a:hover { text-decoration: underline; }
.hikr-ext-wp-visits { color: #999; font-size: 0.9em; }
.hikr-ext-waypoint-map-slot {
  display: inline-block;
  min-width: 1em;
}
.hikr-ext-waypoint-map-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
  color: #999 !important;
  text-decoration: none !important;
  font-size: 10px;
  vertical-align: middle;
  line-height: 1;
  opacity: 0.85;
}
.hikr-ext-waypoint-map-link:hover {
  border-color: #888;
  color: #555 !important;
  opacity: 1;
}
.hikr-ext-extra-page,
.hikr-ext-extra-page .content-center,
.hikr-ext-extra-page .content-list,
.hikr-ext-extra-page .content-list-intern_div,
.hikr-ext-extra-page .main_text,
.hikr-ext-extra-page p,
.hikr-ext-extra-page h1,
.hikr-ext-extra-page h2,
.hikr-ext-extra-page h3,
.hikr-ext-extra-page h4,
.hikr-ext-extra-page div {
  text-align: left !important;
}
.hikr-ext-search-presets {
  margin: 0 0 14px;
  padding: 12px 14px;
  border: 1px solid var(--hikr-line);
  background: var(--hikr-surface-soft);
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
  color: var(--hikr-ink);
  font-size: 12px;
  max-width: 560px;
}
.hikr-ext-search-presets-field {
  display: grid;
  gap: 4px;
  min-width: 220px;
  flex: 1 1 260px;
}
.hikr-ext-search-presets-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.hikr-ext-saved-locations {
  margin: 10px 0 16px;
  padding: 12px 14px;
  border: 1px solid var(--hikr-line);
  background: var(--hikr-surface-soft);
  border-radius: 8px;
  display: grid;
  gap: 8px;
  color: var(--hikr-ink);
  font-size: 12px;
  max-width: 360px;
}
.hikr-ext-saved-locations-field {
  display: grid;
  gap: 4px;
}
.hikr-ext-saved-locations label,
.hikr-ext-search-presets label {
  font-weight: 600;
  color: var(--hikr-ink-soft);
}
.hikr-ext-form-select,
.hikr-ext-saved-locations input[type="text"] {
  width: 100%;
  min-height: 30px;
  border: 1px solid var(--hikr-line-strong);
  border-radius: 4px;
  padding: 5px 30px 5px 8px;
  background: var(--hikr-surface);
  color: var(--hikr-ink);
  font-size: 12px;
}
.hikr-ext-form-select {
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--hikr-muted) 50%),
    linear-gradient(135deg, var(--hikr-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 15px) 12px,
    calc(100% - 10px) 12px;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}
.hikr-ext-form-select:disabled {
  opacity: .6;
}
.hikr-ext-form-select:focus,
.hikr-ext-saved-locations input[type="text"]:focus {
  outline: none;
  border-color: var(--hikr-accent-soft);
  box-shadow: 0 0 0 3px rgba(201, 122, 116, 0.15);
}
.hikr-ext-form-button {
  border: 1px solid var(--hikr-line-strong);
  background: var(--hikr-surface);
  color: var(--hikr-ink);
  border-radius: 4px;
  min-height: 30px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: color .12s ease, border-color .12s ease;
  justify-self: start;
}
.hikr-ext-form-button:hover {
  color: var(--hikr-accent-strong);
  border-color: var(--hikr-accent-soft);
}
.hikr-ext-form-button:disabled {
  opacity: .5;
  cursor: not-allowed;
}
.hikr-ext-saved-hint {
  color: var(--hikr-muted);
  font-size: 11px;
}
.hikr-ext-suggest-wrap { position: relative; }
.hikr-ext-suggest-list {
  position: absolute;
  top: calc(100% + 2px);
  left: 0; right: 0;
  background: #ffffff;
  border: 1px solid var(--hikr-line-strong);
  border-radius: 6px;
  margin: 0; padding: 4px 0;
  list-style: none;
  z-index: 9999;
  max-height: 220px;
  overflow-y: auto;
  box-shadow: 0 6px 18px rgba(42,36,34,0.14);
}
.hikr-ext-suggest-list[hidden] { display: none !important; }
.hikr-ext-suggest-list li { margin: 0; padding: 0; }
.hikr-ext-suggest-list button {
  width: 100%;
  text-align: left;
  padding: 7px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--hikr-ink);
  font-family: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.hikr-ext-suggest-list button:hover { background: var(--hikr-accent-mist); color: var(--hikr-accent-strong); }
.hikr-ext-map-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 16, 14, 0.32);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2147481000;
  pointer-events: none;
}
.hikr-ext-map-backdrop[hidden] { display: none !important; }
.hikr-ext-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 16, 14, 0.42);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  z-index: 2147483500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.hikr-ext-preview-overlay[hidden] { display: none !important; }
.hikr-ext-preview-frame {
  position: relative;
  width: min(1160px, calc(100vw - 32px));
  height: min(920px, calc(100vh - 32px));
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 28px 72px rgba(0, 0, 0, 0.32);
  overflow: hidden;
}
.hikr-ext-preview-frame iframe { width: 100%; height: 100%; border: 0; display: block; }
.hikr-ext-preview-close {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 10;
  background: rgba(42, 36, 34, 0.62);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.hikr-ext-preview-frame:hover .hikr-ext-preview-close { opacity: 1; }
.hikr-ext-lightbox {
  position: fixed;
  inset: 0;
  display: none;
  flex-direction: column;
  padding: 16px 20px;
  background: rgba(25, 20, 18, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 2147482600;
  color: #ffffff;
}
.hikr-ext-lightbox[data-open="true"] { display: flex; }
.hikr-ext-lightbox-center {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.hikr-ext-lightbox-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-height: 38px;
}
.hikr-ext-lightbox-title {
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  color: #f4efec;
  padding: 2px 40px 0;
  line-height: 1.35;
  max-width: 100%;
}
.hikr-ext-lightbox-stage {
  flex: 0 1 auto;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: 50px 1fr 50px;
  align-items: center;
  gap: 10px;
}
.hikr-ext-lightbox img {
  justify-self: center;
  max-width: 100%;
  max-height: calc(100vh - 230px);
  object-fit: contain;
  border-radius: 4px;
  image-orientation: from-image;
}
.hikr-ext-lightbox-nav,
.hikr-ext-lightbox-close {
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(255,255,255,0.08);
  color: #ffffff;
  min-width: 40px;
  min-height: 40px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 20px;
  transition: background .12s ease;
}
.hikr-ext-lightbox-nav:hover,
.hikr-ext-lightbox-close:hover {
  background: rgba(255,255,255,0.16);
}
.hikr-ext-lightbox-close { font-size: 14px; }
.hikr-ext-lightbox-footer {
  display: flex;
  justify-content: center;
  color: rgba(255,255,255,0.65);
  font-size: 11.5px;
  min-height: 24px;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
  padding: 4px 56px 0;
}
.hikr-ext-lightbox-img-wrap {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hikr-ext-lightbox-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 46px;
  height: 46px;
  margin: -23px 0 0 -23px;
  border-radius: 50%;
  border: 4px solid rgba(255,255,255,0.25);
  border-top-color: #ffffff;
  animation: hikr-ext-spin .8s linear infinite;
}
.hikr-ext-lightbox-spinner[hidden] { display: none !important; }
.hikr-ext-lightbox-photolink,
.hikr-ext-lightbox-photolink:link,
.hikr-ext-lightbox-photolink:visited,
.hikr-ext-lightbox-photolink:active,
.hikr-ext-lightbox-photolink:focus {
  color: #f0b4ae !important;
  text-decoration: none !important;
  font-size: 12.5px;
  padding: 4px 10px;
  background: rgba(255,255,255,0.16);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 5px;
  white-space: nowrap;
}
.hikr-ext-lightbox-photolink:hover {
  color: #ffc9c3 !important;
  text-decoration: none !important;
  background: rgba(255,255,255,0.24);
  border-color: rgba(255,255,255,0.5);
}
.hikr-ext-lightbox-photolink[hidden] { display: none !important; }
.hikr-ext-lightbox-title a.hikr-ext-link {
  color: #ffd9a8 !important;
  text-decoration: underline !important;
}
.hikr-ext-lightbox-thumbs {
  display: flex;
  gap: 6px;
  justify-content: center;
  align-items: center;
  padding: 4px 8px 2px;
  overflow: hidden;
  min-height: 0;
}
.hikr-ext-lightbox-thumbs[hidden] { display: none !important; }
.hikr-ext-lightbox-thumbs img {
  height: 52px;
  width: 70px;
  object-fit: cover;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  opacity: 0.55;
  flex: 0 0 auto;
  transition: opacity .12s ease, border-color .12s ease;
}
.hikr-ext-lightbox-thumbs img:hover { opacity: 0.9; }
.hikr-ext-lightbox-thumbs img.is-active { opacity: 1; border-color: #f0b4ae; }

/* ── Minimap: extension-owned base-layer switcher (separate from hikr's) ── */
.hikr-ext-leaflet-layers.leaflet-control-layers {
  border: 2px solid #a04f4a !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 10px rgba(42, 36, 34, 0.28) !important;
}
.hikr-ext-leaflet-layers .leaflet-control-layers-toggle {
  background-image: none !important;
  position: relative;
}
.hikr-ext-leaflet-layers .leaflet-control-layers-toggle::before {
  content: "⛰";
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.hikr-ext-leaflet-layers-title {
  font: 600 11px/1.3 Inter, ui-sans-serif, system-ui, sans-serif;
  color: #a04f4a;
  padding: 1px 4px 5px;
  white-space: nowrap;
}
.hikr-ext-map-modal {
  position: fixed;
  inset: 28px;
  display: none;
  grid-template-rows: auto auto 1fr;
  background: var(--hikr-surface);
  border: 1px solid var(--hikr-line-strong);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(42, 36, 34, 0.22);
  z-index: 2147482550;
}
.hikr-ext-map-modal header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--hikr-surface-soft);
  color: var(--hikr-ink);
  border-bottom: 1px solid var(--hikr-line);
  font-weight: 600;
}
.hikr-ext-map-status {
  min-height: 28px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--hikr-line);
  background: var(--hikr-surface);
  color: var(--hikr-muted);
  font-size: 12px;
  line-height: 1.35;
}
.hikr-ext-map {
  min-height: 420px;
  height: 100%;
  position: relative;
}
.leaflet-container { height: 100%; width: 100%; font: inherit; }
.leaflet-tile-pane { position: absolute; left: 0; top: 0; }
.leaflet-pane, .leaflet-map-pane, .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow,
.leaflet-tile-container, .leaflet-pane > svg, .leaflet-pane > canvas, .leaflet-zoom-box,
.leaflet-image-layer, .leaflet-layer { position: absolute; left: 0; top: 0; }
.leaflet-container { overflow: hidden; }
.leaflet-map-pane { z-index: 400; }
.leaflet-tile-pane { z-index: 200; }
.leaflet-overlay-pane { z-index: 400; }
.leaflet-shadow-pane { z-index: 500; }
.leaflet-marker-pane { z-index: 600; }
.leaflet-tooltip-pane { z-index: 650; }
.leaflet-popup-pane { z-index: 700; }
.leaflet-popup {
  position: absolute;
  text-align: center;
  margin-bottom: 20px;
}
.leaflet-popup-content-wrapper {
  padding: 1px;
  text-align: left;
  border-radius: 12px;
}
.leaflet-popup-content {
  margin: 13px 24px 13px 20px;
  line-height: 1.3;
  font-size: 13px;
  min-height: 1px;
}
.leaflet-popup-content p { margin: 1.3em 0; }
.leaflet-popup-tip-container {
  width: 40px;
  height: 20px;
  position: absolute;
  left: 50%;
  margin-top: -1px;
  margin-left: -20px;
  overflow: hidden;
  pointer-events: none;
}
.leaflet-popup-tip {
  width: 17px;
  height: 17px;
  padding: 1px;
  margin: -10px auto 0;
  pointer-events: auto;
  transform: rotate(45deg);
}
.leaflet-popup-content-wrapper,
.leaflet-popup-tip {
  background: white;
  color: #333;
  box-shadow: 0 3px 14px rgba(0,0,0,0.4);
}
.leaflet-container a.leaflet-popup-close-button {
  position: absolute;
  top: 0;
  right: 0;
  border: none;
  text-align: center;
  width: 24px;
  height: 24px;
  font: 16px/24px Tahoma, Verdana, sans-serif;
  color: #757575;
  text-decoration: none;
  background: transparent;
}
.leaflet-container a.leaflet-popup-close-button:hover,
.leaflet-container a.leaflet-popup-close-button:focus { color: #585858; }
.leaflet-popup-scrolled { overflow: auto; }
.hikr-ext-map-pin-icon {
  border: 0 !important;
  background: transparent !important;
}
.hikr-ext-map-pin {
  display: block;
  position: relative;
  width: 18px;
  height: 18px;
  border: 2px solid #7f1d1d;
  border-radius: 50% 50% 50% 0;
  background: #f87171;
  box-shadow: 0 2px 7px rgba(42, 36, 34, 0.35);
  transform: rotate(-45deg);
}
.hikr-ext-map-pin::after {
  content: "";
  position: absolute;
  width: 6px;
  height: 6px;
  left: 4px;
  top: 4px;
  border-radius: 50%;
  background: #fff;
}
.hikr-ext-map-popup {
  min-width: 230px;
  max-width: 340px;
  color: var(--hikr-ink);
  font-size: 12px;
  line-height: 1.38;
}
.hikr-ext-map-popup strong {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
}
.hikr-ext-map-popup-coords,
.hikr-ext-map-popup-route {
  color: var(--hikr-muted);
  font-size: 11px;
  margin: 3px 0;
}
.hikr-ext-map-popup-route {
  color: var(--hikr-accent-strong);
  font-weight: 600;
}
.hikr-ext-map-popup-details {
  margin-top: 6px;
}
.hikr-ext-map-popup-details .hikr-ext-tour-details {
  margin: 0;
  clear: none;
}
.leaflet-pane > svg path,
.leaflet-interactive {
  pointer-events: auto;
}
.leaflet-tile { user-select: none; -webkit-user-drag: none; }
.leaflet-control { position: relative; z-index: 800; pointer-events: auto; }
.leaflet-top, .leaflet-bottom { position: absolute; z-index: 1000; pointer-events: none; }
.leaflet-top { top: 0; }
.leaflet-right { right: 0; }
.leaflet-bottom { bottom: 0; }
.leaflet-left { left: 0; }
.leaflet-control-attribution { background: rgba(255,255,255,0.82); padding: 2px 6px; font-size: 11px; }

/* ── Snow Research ─────────────────────────────────────── */
.hikr-ext-snow-modal {
  position: fixed;
  inset: 0;
  background: rgba(42,36,34,0.78);
  z-index: 2147482700;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 16px;
  overflow-y: auto;
}
.hikr-ext-snow-frame {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 28px 72px rgba(0,0,0,0.32);
  width: min(940px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.hikr-ext-snow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 12px;
  border-bottom: 1px solid #e5e0dc;
  font-size: 14px;
  font-weight: 600;
  color: #2a2422;
  flex-shrink: 0;
}
.hikr-ext-snow-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #888;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
}
.hikr-ext-snow-close:hover { background: #f0ebe8; color: #333; }
.hikr-ext-snow-export {
  background: none;
  border: 1px solid #ccc;
  cursor: pointer;
  font-size: 12px;
  color: #555;
  padding: 3px 8px;
  border-radius: 4px;
  line-height: 1.4;
}
.hikr-ext-snow-export:hover { background: #f0ebe8; border-color: #aaa; }
.hikr-ext-snow-body {
  overflow-y: auto;
  padding: 10px 0;
  flex: 1;
}
.hikr-ext-snow-empty {
  text-align: center;
  color: #999;
  padding: 32px 16px;
  font-size: 13px;
}
.hikr-ext-snow-entry {
  border-bottom: 1px solid #f0ebe8;
  padding: 10px 18px;
}
.hikr-ext-snow-entry:last-child { border-bottom: none; }
.hikr-ext-snow-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
  font-size: 13px;
}
.hikr-ext-snow-elevation {
  font-weight: 700;
  color: #3a5a3a;
  font-size: 14px;
  white-space: nowrap;
}
.hikr-ext-snow-peak-name {
  font-weight: 600;
  color: #2a2422;
  text-decoration: none;
}
a.hikr-ext-snow-peak-name:hover { text-decoration: underline; }
.hikr-ext-snow-tours {
  color: #888;
  font-size: 12px;
}
.hikr-ext-snow-tours a { color: #888; text-decoration: none; }
.hikr-ext-snow-tours a:hover { text-decoration: underline; }
.hikr-ext-snow-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.hikr-ext-snow-thumb-link img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: border-color .12s, opacity .12s;
}
.hikr-ext-snow-thumb-link img:hover { border-color: #a05c2a; opacity: 0.88; }

/* ── Snow Lightbox ──────────────────────────────────────── */
.hikr-ext-snow-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(10,8,7,0.92);
  z-index: 2147482800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hikr-ext-snow-lb-frame {
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
}
.hikr-ext-snow-lb-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0 10px;
  color: rgba(255,255,255,0.75);
  font-size: 12px;
}
.hikr-ext-snow-lb-counter { font-weight: 600; white-space: nowrap; }
.hikr-ext-snow-lb-caption { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hikr-ext-snow-lb-photolink {
  color: rgba(255,255,255,0.75);
  font-size: 12px;
  text-decoration: none;
  padding: 3px 8px;
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 4px;
  white-space: nowrap;
}
.hikr-ext-snow-lb-photolink:hover { color: #fff; border-color: rgba(255,255,255,0.55); }
.hikr-ext-snow-lb-close {
  background: rgba(255,255,255,0.12);
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 9px;
  border-radius: 5px;
}
.hikr-ext-snow-lb-close:hover { background: rgba(255,255,255,0.22); }
.hikr-ext-snow-lb-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 0;
}
.hikr-ext-snow-lb-nav {
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.18);
  color: #fff;
  cursor: pointer;
  font-size: 28px;
  width: 42px;
  height: 64px;
  border-radius: 6px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hikr-ext-snow-lb-nav:hover { background: rgba(255,255,255,0.20); }
.hikr-ext-snow-lb-img-wrap {
  position: relative;
  line-height: 0;
  flex-shrink: 0;
}
.hikr-ext-snow-lb-img {
  max-width: calc(100vw - 160px);
  max-height: calc(100vh - 120px);
  object-fit: contain;
  border-radius: 4px;
  image-orientation: from-image;
  display: block;
}
.hikr-ext-snow-lb-annotations { position: absolute; inset: 0; pointer-events: none; }
.hikr-ext-snow-annotation {
  position: absolute;
  transform: translate(-50%, -100%);
  background: rgba(10,8,7,0.72);
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 1.4;
  pointer-events: none;
}
.hikr-ext-snow-annotation::after {
  content: "";
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  border: 3px solid transparent;
  border-top-color: rgba(10,8,7,0.72);
}
.hikr-ext-snow-annotation--active {
  background: rgba(170,35,20,0.88);
  font-weight: 700;
  font-size: 12px;
  z-index: 1;
}
.hikr-ext-snow-annotation--active::after {
  border-top-color: rgba(170,35,20,0.88);
}
`;
