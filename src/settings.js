const SETTINGS_STORAGE_KEY = "dungeon30_settings";

const DEFAULT_SETTINGS = {
  muted: false,
  volume: 0.8,
  minimap: true,
  logFilter: "all",
  lighting: true,
};

export function loadSettings() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}");
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable; settings still apply for this session.
  }
}

// Controls are identified by data-setting (not ids) because the menu card and the in-game
// panel can both exist in the page at the same time.
export function renderSettingsControls(settings) {
  const volumePct = Math.round(settings.volume * 100);
  return `
    <div class="setting-row">
      <label><input type="checkbox" data-setting="muted" ${settings.muted ? "checked" : ""}> Mute sound</label>
    </div>
    <div class="setting-row">
      <span>Volume</span>
      <input type="range" data-setting="volume" min="0" max="100" step="5" value="${volumePct}" aria-label="Volume" ${settings.muted ? "disabled" : ""}>
      <output data-setting-output="volume">${volumePct}%</output>
    </div>
    <div class="setting-row">
      <label><input type="checkbox" data-setting="minimap" ${settings.minimap ? "checked" : ""}> Show minimap <span class="muted">(M)</span></label>
    </div>
    <div class="setting-row">
      <label><input type="checkbox" data-setting="lighting" ${settings.lighting ? "checked" : ""}> Torch lighting on the map</label>
    </div>
  `;
}
