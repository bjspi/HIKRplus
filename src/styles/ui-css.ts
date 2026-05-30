export const UI_CSS = `
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #2a2422;
  background: #fbfaf8;
  --bg: #fbfaf8;
  --surface: #ffffff;
  --surface-soft: #faf6f4;
  --ink: #2a2422;
  --ink-soft: #4a3f3c;
  --muted: #82766f;
  --line: #ece5e1;
  --line-strong: #d9cfc9;
  --accent: #a04f4a;
  --accent-strong: #8a3f3b;
  --accent-soft: #c97a74;
  --accent-pale: #f1dedb;
  --accent-mist: #faeeeb;
  --accent-ink: #5a2926;
  --gold: #b88a4a;
}
* { box-sizing: border-box; }
body { margin: 0; }
button, input, select { font: inherit; }
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--bg);
}
.options-layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  min-height: calc(100vh - 90px);
}
.options-sidebar {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px 12px;
  background: var(--surface);
  border-right: 1px solid var(--line);
}
.nav-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background .1s ease, color .1s ease;
}
.nav-item:hover {
  background: var(--accent-mist);
  color: var(--accent-strong);
}
.nav-item.active {
  background: var(--accent-pale);
  color: var(--accent-ink);
  font-weight: 650;
}
.options-main {
  padding: 24px 28px 32px;
  max-width: 680px;
  min-width: 0;
}
.panel-section[hidden] { display: none !important; }
.panel-title {
  margin: 0 0 18px;
  font-size: 17px;
  font-weight: 650;
  color: var(--ink);
  letter-spacing: -0.01em;
}
.opt-suggest-wrap { position: relative; }
.opt-suggest-list {
  position: absolute;
  top: calc(100% + 2px);
  left: 0; right: 0;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  margin: 0; padding: 4px 0;
  list-style: none;
  z-index: 50;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 6px 18px rgba(42,36,34,0.12);
}
.opt-suggest-list[hidden] { display: none !important; }
.opt-suggest-list li { margin: 0; padding: 0; }
.opt-suggest-list button {
  width: 100%;
  text-align: left;
  padding: 7px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--ink);
  font-family: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.opt-suggest-list button:hover { background: var(--accent-mist); color: var(--accent-strong); }
.cache-stats-section {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.cache-stats-section h3 {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 650;
}
.cache-stat-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--ink-soft);
}
.hero {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: center;
  padding: 22px 28px 20px;
  background: linear-gradient(180deg, #ffffff 0%, var(--surface-soft) 100%);
  color: var(--ink);
  border-bottom: 1px solid var(--line);
  position: relative;
}
.hero::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: -1px;
  height: 2px;
  background: linear-gradient(90deg, var(--accent) 0%, var(--gold) 100%);
  opacity: 0.55;
}
.hero-logo-wide {
  height: 36px;
  width: auto;
  display: block;
  object-fit: contain;
  opacity: 0.92;
}
.hero-tagline {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.content {
  width: min(1100px, calc(100vw - 32px));
  margin: 22px auto 32px;
  display: grid;
  gap: 14px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.section, .popup-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(42, 36, 34, 0.03);
}
.section h2, .popup-card h2 {
  margin: 0 0 14px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 650;
}
.section h3 {
  margin: 14px 0 8px;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 650;
}
.field { display: grid; gap: 6px; margin: 14px 0; }
.field label, .toggle label {
  font-size: 13px;
  font-weight: 550;
  color: var(--ink);
}
.field small, .toggle small, .muted {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.42;
}
.field input, .field select {
  width: 100%;
  min-height: 36px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 7px 10px;
  background: var(--surface);
  color: var(--ink);
  transition: border-color .12s ease, box-shadow .12s ease;
}
.field input:focus, .field select:focus {
  outline: none;
  border-color: var(--accent-soft);
  box-shadow: 0 0 0 3px rgba(201, 122, 116, 0.18);
}
.toggle {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 12px;
  align-items: start;
  padding: 11px 0;
  border-bottom: 1px solid var(--line);
}
.toggle:last-child { border-bottom: 0; }
.toggle input {
  appearance: none;
  width: 32px;
  height: 18px;
  margin: 2px 0 0;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: #ede5e0;
  position: relative;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease;
}
.toggle input::after {
  content: "";
  position: absolute;
  width: 12px;
  height: 12px;
  left: 2px;
  top: 2px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(42, 36, 34, 0.2);
  transition: transform .18s ease;
}
.toggle input:checked {
  background: var(--accent);
  border-color: var(--accent-strong);
}
.toggle input:checked::after { transform: translateX(14px); }
.toggle small { margin-top: 2px; }
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.btn {
  min-height: 34px;
  border: 1px solid var(--ink);
  border-radius: 6px;
  background: var(--ink);
  color: #ffffff;
  padding: 7px 14px;
  cursor: pointer;
  font-weight: 550;
  font-size: 13px;
  transition: background .12s ease, transform .12s ease;
}
.btn:hover { background: #1a1513; }
.btn.secondary {
  background: var(--surface);
  color: var(--ink);
  border-color: var(--line-strong);
}
.btn.secondary:hover {
  background: var(--surface-soft);
  border-color: var(--accent-soft);
  color: var(--accent-strong);
}
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn:not(:disabled):active { transform: translateY(1px); }
.status {
  min-height: 22px;
  color: var(--accent-strong);
  font-size: 13px;
  margin-top: 10px;
}
.saved-location-add {
  display: grid;
  grid-template-columns: 1fr 1.4fr auto;
  gap: 8px;
  align-items: start;
  margin: 10px 0 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}
.saved-location-add .opt-suggest-wrap { grid-column: 1; }
.saved-location-add input {
  min-height: 32px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 6px 10px;
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
}
.saved-location-add input:focus {
  outline: none;
  border-color: var(--accent-soft);
  box-shadow: 0 0 0 3px rgba(201, 122, 116, 0.18);
}
.saved-location-add .btn { min-height: 32px; padding: 6px 14px; }
.saved-location-list { display: grid; gap: 0; }
.saved-location-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.saved-location-row:last-of-type { border-bottom: 0; }
.saved-location-row [hidden] { display: none !important; }
.saved-location-row > .saved-location-view,
.saved-location-row > .saved-location-edit { grid-column: 1; }
.saved-location-row > .saved-location-actions { grid-column: 2; }
.saved-location-view {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}
.saved-location-view strong {
  font-weight: 600;
  color: var(--ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.saved-location-view .muted {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.saved-location-edit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
  gap: 8px;
  min-width: 0;
}
.saved-location-edit input {
  min-width: 0;
  min-height: 30px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  padding: 5px 8px;
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.saved-location-edit input[data-edit-name] { font-family: inherit; }
.saved-location-edit input:focus {
  outline: none;
  border-color: var(--accent-soft);
  box-shadow: 0 0 0 3px rgba(201, 122, 116, 0.18);
}
.saved-location-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.saved-location-row button {
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--muted);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: color .12s ease, border-color .12s ease;
}
.saved-location-row button:hover {
  color: var(--accent-strong);
  border-color: var(--accent-soft);
}
.saved-location-row button[data-save-location] {
  background: var(--ink);
  color: #fff;
  border-color: var(--ink);
}
.saved-location-row button[data-save-location]:hover {
  background: #1a1513;
  color: #fff;
}
.popup {
  width: 360px;
  min-height: 360px;
  background: var(--bg);
}
.popup .hero {
  padding: 14px 16px 12px;
}
.popup .hero-logo-wide { height: 26px; }
.popup .hero-tagline { font-size: 12px; }
.popup .content {
  width: auto;
  margin: 12px;
  gap: 10px;
}
.popup-card { padding: 14px 16px; }
.popup-card p { margin: 4px 0; }
.popup-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}
.popup-actions .btn {
  background: var(--surface);
  color: var(--ink);
  border-color: var(--line-strong);
  font-weight: 500;
}
.popup-actions .btn:hover:not(:disabled) {
  border-color: var(--accent-soft);
  color: var(--accent-strong);
  background: var(--surface-soft);
}
@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr; }
  .hero { padding: 18px; }
  .options-layout { grid-template-columns: 1fr; }
  .options-sidebar { flex-direction: row; flex-wrap: wrap; padding: 10px; border-right: none; border-bottom: 1px solid var(--line); }
  .options-main { padding: 16px; }
}
.hikr-ext-sort-menu--options {
  margin-top: 14px;
  max-width: 460px;
}
.hikr-ext-sort-head {
  font-size: 12px;
  font-weight: 650;
  color: var(--muted);
  margin-bottom: 8px;
}
.hikr-ext-sort-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.hikr-ext-sort-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--ink);
  min-height: 32px;
  padding: 5px 10px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 500;
  text-align: left;
  transition: color .12s ease, border-color .12s ease, background .12s ease;
}
.hikr-ext-sort-item:hover {
  background: var(--accent-mist);
  border-color: var(--accent-soft);
  color: var(--accent-strong);
}
.hikr-ext-sort-item.hikr-ext-sort-active {
  border-color: var(--accent);
  color: var(--accent-strong);
  background: var(--accent-pale);
}
.hikr-ext-sort-arrow {
  font-size: 11px;
  line-height: 1;
  color: var(--accent-strong);
}
`;
