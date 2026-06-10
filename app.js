const STORAGE_KEY = "homegame-poker-timer-v1";
const HISTORY_KEY = "poker-timer-history-v1";
const MAX_LEVELS = 80;
const MAX_PLAYERS = 200;
const MAX_PAYOUTS = 20;
const MAX_TEXT_LENGTH = 120;

const numberRules = {
  "tournament.buyIn": { min: 0, max: 100000 },
  "tournament.rake": { min: 0, max: 100000 },
  "tournament.startingStack": { min: 1, max: 100000000 },
  "tournament.rebuyPrice": { min: 0, max: 100000 },
  "tournament.rebuyStack": { min: 0, max: 100000000 },
  "tournament.addOnPrice": { min: 0, max: 100000 },
  "tournament.addOnStack": { min: 0, max: 100000000 },
  "tournament.rebuyUntilLevel": { min: 0, max: MAX_LEVELS },
  "tournament.warningSeconds": { min: 0, max: 3600 },
  "cashgame.smallBlind": { min: 0, max: 100000 },
  "cashgame.bigBlind": { min: 0, max: 100000 },
  "cashgame.timerMinutes": { min: 0, max: 1440 }
};

const levelNumberRules = {
  minutes: { min: 1, max: 240 },
  smallBlind: { min: 0, max: 100000000 },
  bigBlind: { min: 0, max: 100000000 },
  ante: { min: 0, max: 100000000 }
};

const payoutNumberRules = {
  place: { min: 1, max: MAX_PAYOUTS },
  percent: { min: 0, max: 100 }
};

const cashPlayerNumberRules = {
  buyIn: { min: 0, max: 1000000 },
  cashOut: { min: 0, max: 1000000 }
};

const presets = {
  turbo: {
    name: "Turbo",
    levelDuration: 10,
    startingStack: 15000,
    levels: [
      [10, 100, 200, 0, "none", "Level"],
      [10, 200, 400, 0, "none", "Level"],
      [10, 300, 600, 0, "none", "Level"],
      [5, 0, 0, 0, "none", "Pause"],
      [10, 500, 1000, 1000, "bb", "Level"],
      [10, 1000, 2000, 2000, "bb", "Level"],
      [10, 2000, 4000, 4000, "bb", "Level"]
    ]
  },
  classic: {
    name: "Classic",
    levelDuration: 15,
    startingStack: 20000,
    levels: [
      [15, 100, 200, 0, "none", "Level"],
      [15, 200, 400, 0, "none", "Level"],
      [15, 300, 600, 0, "none", "Level"],
      [15, 400, 800, 800, "bb", "Level"],
      [10, 0, 0, 0, "none", "Pause"],
      [15, 600, 1200, 1200, "bb", "Level"],
      [15, 1000, 2000, 2000, "bb", "Level"],
      [15, 1500, 3000, 3000, "bb", "Level"]
    ]
  },
  deepstack: {
    name: "Deepstack",
    levelDuration: 20,
    startingStack: 30000,
    levels: [
      [20, 100, 200, 0, "none", "Level"],
      [20, 100, 300, 0, "none", "Level"],
      [20, 200, 400, 0, "none", "Level"],
      [20, 300, 600, 0, "none", "Level"],
      [10, 0, 0, 0, "none", "Pause"],
      [20, 400, 800, 800, "bb", "Level"],
      [20, 600, 1200, 1200, "bb", "Level"],
      [20, 800, 1600, 1600, "bb", "Level"],
      [20, 1000, 2000, 2000, "bb", "Level"]
    ]
  }
};

const defaultState = {
  mode: "tournament",
  theme: "dark",
  tvMode: false,
  preset: "classic",
  tournament: {
    title: "Samstag Homegame",
    buyIn: 50,
    rake: 0,
    startingStack: 20000,
    rebuyPrice: 50,
    rebuyStack: 20000,
    addOnPrice: 50,
    addOnStack: 30000,
    rebuyUntilLevel: 6,
    useAnte: true,
    warningSeconds: 60,
    sound: true,
    currentLevel: 0,
    remainingSeconds: 15 * 60,
    running: false,
    levels: mapPresetLevels(presets.classic.levels),
    players: [
      player("Spieler 1"),
      player("Spieler 2"),
      player("Spieler 3"),
      player("Spieler 4"),
      player("Spieler 5"),
      player("Spieler 6")
    ],
    payouts: [
      { place: 1, percent: 50 },
      { place: 2, percent: 30 },
      { place: 3, percent: 20 }
    ]
  },
  cashgame: {
    title: "Cashgame",
    smallBlind: 1,
    bigBlind: 2,
    timerMinutes: 0,
    running: false,
    elapsedSeconds: 0,
    players: [
      cashPlayer("Spieler 1", 100, 0),
      cashPlayer("Spieler 2", 100, 0),
      cashPlayer("Spieler 3", 100, 0)
    ]
  }
};

let state = loadState();
let history = loadHistory();
let tickHandle = null;
let lastSaved = "";
let lastHistorySaved = "";
let audioContext = null;
let lastTickAt = Date.now();

function player(name) {
  return { id: makeId(), name, active: true, rebuys: 0, addons: 0 };
}

function cashPlayer(name, buyIn, cashOut) {
  return { id: makeId(), name, buyIn, cashOut };
}

function mapPresetLevels(rows) {
  return rows.map((row, index) => ({
    id: makeId(),
    name: `${row[5]} ${index + 1}`,
    minutes: row[0],
    smallBlind: row[1],
    bigBlind: row[2],
    ante: row[3],
    anteType: row[4],
    type: row[5] === "Pause" ? "break" : "level"
  }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return sanitizeState(saved ? mergeDefaults(defaultState, saved) : structuredClone(defaultState));
  } catch {
    return sanitizeState(structuredClone(defaultState));
  }
}

function mergeDefaults(base, saved) {
  if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
  if (typeof base !== "object" || base === null) return saved ?? base;
  const result = { ...base };
  for (const key of Object.keys(saved || {})) {
    result[key] = key in base ? mergeDefaults(base[key], saved[key]) : saved[key];
  }
  return result;
}

function sanitizeState(value) {
  const normalized = {
    ...value,
    mode: value?.mode === "cashgame" ? "cashgame" : "tournament",
    theme: value?.theme === "light" ? "light" : "dark",
    tvMode: Boolean(value?.tvMode),
    preset: presets[value?.preset] ? value.preset : "classic",
    tournament: normalizeTournament(value?.tournament || defaultState.tournament),
    cashgame: normalizeCashgame(value?.cashgame || defaultState.cashgame)
  };
  return catchUpPersistedTimers(normalized);
}

function catchUpPersistedTimers(appState) {
  const savedAt = Date.parse(appState.savedAt || "");
  if (!Number.isFinite(savedAt)) return appState;
  const elapsedSeconds = Math.floor((Date.now() - savedAt) / 1000);
  if (elapsedSeconds <= 0 || elapsedSeconds > 7 * 24 * 60 * 60) return appState;
  if (appState.tournament.running) advanceTournamentBy(appState.tournament, elapsedSeconds, false);
  if (appState.cashgame.running) advanceCashgameBy(appState.cashgame, elapsedSeconds, false);
  return appState;
}

function normalizeTournament(raw) {
  const levels = (Array.isArray(raw?.levels) ? raw.levels : [])
    .map(normalizeLevel)
    .filter(Boolean)
    .slice(0, MAX_LEVELS);
  const safeLevels = levels.length ? levels : mapPresetLevels(presets.classic.levels);
  const currentLevel = clampInteger(raw?.currentLevel, { min: 0, max: safeLevels.length - 1, fallback: 0 });
  const fallbackSeconds = clampInteger(safeLevels[currentLevel]?.minutes, { min: 1, max: 240, fallback: 15 }) * 60;

  return {
    ...raw,
    title: cleanText(raw?.title, "Samstag Homegame"),
    buyIn: clampNumber(raw?.buyIn, numberRules["tournament.buyIn"]),
    rake: clampNumber(raw?.rake, numberRules["tournament.rake"]),
    startingStack: clampInteger(raw?.startingStack, numberRules["tournament.startingStack"]),
    rebuyPrice: clampNumber(raw?.rebuyPrice, numberRules["tournament.rebuyPrice"]),
    rebuyStack: clampInteger(raw?.rebuyStack, numberRules["tournament.rebuyStack"]),
    addOnPrice: clampNumber(raw?.addOnPrice, numberRules["tournament.addOnPrice"]),
    addOnStack: clampInteger(raw?.addOnStack, numberRules["tournament.addOnStack"]),
    rebuyUntilLevel: clampInteger(raw?.rebuyUntilLevel, { ...numberRules["tournament.rebuyUntilLevel"], fallback: 0 }),
    useAnte: raw?.useAnte !== false,
    warningSeconds: clampInteger(raw?.warningSeconds, numberRules["tournament.warningSeconds"]),
    sound: raw?.sound !== false,
    currentLevel,
    remainingSeconds: clampInteger(raw?.remainingSeconds, { min: 0, max: 7 * 24 * 60 * 60, fallback: fallbackSeconds }),
    running: Boolean(raw?.running),
    levels: safeLevels,
    players: normalizePlayers(raw?.players),
    payouts: normalizePayouts(raw?.payouts)
  };
}

function normalizeLevel(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const type = raw.type === "break" ? "break" : "level";
  return {
    id: raw.id || makeId(),
    name: cleanText(raw.name, type === "break" ? "Pause" : `Level ${index + 1}`),
    minutes: clampInteger(raw.minutes, { ...levelNumberRules.minutes, fallback: type === "break" ? 10 : 15 }),
    smallBlind: type === "break" ? 0 : clampInteger(raw.smallBlind, levelNumberRules.smallBlind),
    bigBlind: type === "break" ? 0 : clampInteger(raw.bigBlind, levelNumberRules.bigBlind),
    ante: type === "break" ? 0 : clampInteger(raw.ante, levelNumberRules.ante),
    anteType: type === "break" ? "none" : normalizeChoice(raw.anteType, ["none", "regular", "bb"], "none"),
    type
  };
}

function normalizePlayers(players) {
  if (!Array.isArray(players)) return [];
  return players.slice(0, MAX_PLAYERS).map((item, index) => ({
    id: item?.id || makeId(),
    name: cleanText(item?.name, `Spieler ${index + 1}`),
    active: item?.active !== false,
    rebuys: clampInteger(item?.rebuys, { min: 0, max: 100, fallback: 0 }),
    addons: clampInteger(item?.addons, { min: 0, max: 100, fallback: 0 })
  }));
}

function normalizePayouts(payouts) {
  if (!Array.isArray(payouts)) return [];
  return payouts.slice(0, MAX_PAYOUTS).map((item, index) => ({
    place: clampInteger(item?.place, { ...payoutNumberRules.place, fallback: index + 1 }),
    percent: clampNumber(item?.percent, payoutNumberRules.percent)
  }));
}

function normalizeCashgame(raw) {
  return {
    ...raw,
    title: cleanText(raw?.title, "Cashgame"),
    smallBlind: clampNumber(raw?.smallBlind, numberRules["cashgame.smallBlind"]),
    bigBlind: clampNumber(raw?.bigBlind, numberRules["cashgame.bigBlind"]),
    timerMinutes: clampInteger(raw?.timerMinutes, numberRules["cashgame.timerMinutes"]),
    running: Boolean(raw?.running),
    elapsedSeconds: clampInteger(raw?.elapsedSeconds, { min: 0, max: 7 * 24 * 60 * 60, fallback: 0 }),
    players: normalizeCashPlayers(raw?.players)
  };
}

function normalizeCashPlayers(players) {
  if (!Array.isArray(players)) return [];
  return players.slice(0, MAX_PLAYERS).map((item, index) => ({
    id: item?.id || makeId(),
    name: cleanText(item?.name, `Spieler ${index + 1}`),
    buyIn: clampNumber(item?.buyIn, cashPlayerNumberRules.buyIn),
    cashOut: clampNumber(item?.cashOut, cashPlayerNumberRules.cashOut)
  }));
}

function clampNumber(value, rule = {}) {
  const min = rule.min ?? 0;
  const max = rule.max ?? Number.POSITIVE_INFINITY;
  const fallback = rule.fallback ?? min;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampInteger(value, rule = {}) {
  return Math.round(clampNumber(value, rule));
}

function cleanText(value, fallback = "", maxLength = MAX_TEXT_LENGTH) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, maxLength);
}

function normalizeChoice(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function saveState() {
  const serialized = JSON.stringify({ ...state, savedAt: new Date().toISOString() });
  if (serialized !== lastSaved) {
    localStorage.setItem(STORAGE_KEY, serialized);
    lastSaved = serialized;
  }
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(saved) ? mergeHistory(saved.filter((entry) => entry?.tournament), []) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  const serialized = JSON.stringify(history);
  if (serialized !== lastHistorySaved) {
    localStorage.setItem(HISTORY_KEY, serialized);
    lastHistorySaved = serialized;
  }
}

function render() {
  document.body.className = `${state.theme === "light" ? "light" : ""} ${state.tvMode ? "tv" : ""}`;
  const app = document.querySelector("#app");
  app.innerHTML = `
    <div class="app">
      ${topbar()}
      ${state.mode === "tournament" ? tournamentView() : cashgameView()}
    </div>
  `;
  bindEvents();
  saveState();
  saveHistory();
}

function topbar() {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-title">
          <img src="assets/dino.svg" alt="" />
          <strong>Poker Timer</strong>
        </div>
      </div>
      <div class="toolbar">
        <div class="tabs">
          <button data-action="setMode" data-mode="tournament" class="${state.mode === "tournament" ? "active" : ""}">Turnier</button>
          <button data-action="setMode" data-mode="cashgame" class="${state.mode === "cashgame" ? "active" : ""}">Cashgame</button>
        </div>
        <button data-action="toggleTheme">${state.theme === "dark" ? "Light" : "Dark"}</button>
        <button data-action="toggleTv">TV</button>
      </div>
    </header>
  `;
}

function tournamentView() {
  const t = state.tournament;
  return `
    <main class="layout">
      <aside class="panel setup">
        <section class="section">
          <h2>Turnier-Setup</h2>
          <div class="grid">
            ${input("Titel", "tournament.title", t.title)}
            ${numberInput("Buy-in", "tournament.buyIn", t.buyIn)}
            ${numberInput("Fee/Rake", "tournament.rake", t.rake)}
            ${numberInput("Startstack", "tournament.startingStack", t.startingStack)}
            ${numberInput("Rebuy Preis", "tournament.rebuyPrice", t.rebuyPrice)}
            ${numberInput("Rebuy Chips", "tournament.rebuyStack", t.rebuyStack)}
            ${numberInput("Add-on Preis", "tournament.addOnPrice", t.addOnPrice)}
            ${numberInput("Add-on Chips", "tournament.addOnStack", t.addOnStack)}
            ${numberInput("Rebuy bis Level", "tournament.rebuyUntilLevel", t.rebuyUntilLevel)}
            ${numberInput("Warnung Sekunden", "tournament.warningSeconds", t.warningSeconds)}
            <label class="checkline full"><input type="checkbox" data-path="tournament.useAnte" ${t.useAnte ? "checked" : ""}> Antes aktivieren</label>
            <label class="checkline full"><input type="checkbox" data-path="tournament.sound" ${t.sound ? "checked" : ""}> Sound aktivieren</label>
            <button class="full" data-action="testSound">Sound testen</button>
          </div>
          ${tournamentAlerts()}
        </section>
        <section class="section">
          <h3>Presets</h3>
          <div class="row-actions">
            <button data-action="applyPreset" data-preset="turbo">Turbo</button>
            <button data-action="applyPreset" data-preset="classic">Classic</button>
            <button data-action="applyPreset" data-preset="deepstack">Deepstack</button>
          </div>
        </section>
        <section class="section">
          <h3>Blind-Struktur</h3>
          <div class="table-wrap">${levelsTable()}</div>
          <div class="row-actions">
            <button data-action="addLevel">Level</button>
            <button data-action="addBreak">Pause</button>
          </div>
        </section>
        <section class="section">
          <h3>Spieler</h3>
          <div class="grid">
            <input id="new-player-name" placeholder="Name" />
            <button data-action="addPlayer">Spieler hinzufügen</button>
          </div>
          <div class="list">${playersList()}</div>
        </section>
        <section class="section">
          <h3>Payout</h3>
          <div class="table-wrap">${payoutTable()}</div>
          ${payoutSummary()}
          <div class="row-actions">
            <button data-action="addPayout">Platz hinzufügen</button>
          </div>
        </section>
        <section class="section">
          <h3>Historie & Export</h3>
          <div class="row-actions">
            <button data-action="archiveTournament">Turnier archivieren</button>
            <button data-action="exportTournament">Aktuelles exportieren</button>
            <button data-action="exportHistory">Historie exportieren</button>
            <button data-action="triggerImport">Importieren</button>
          </div>
          <input class="hidden-file" id="import-file" type="file" accept="application/json,.json" />
          <div class="history-list">${historyList()}</div>
        </section>
      </aside>
      <section class="screen">
        ${timerStage()}
        <div class="secondary-panels">
          <div class="dashboard">${tournamentMetrics()}</div>
        </div>
      </section>
    </main>
  `;
}

function timerStage() {
  const t = state.tournament;
  const level = t.levels[t.currentLevel] || t.levels[0];
  const next = t.levels[t.currentLevel + 1];
  const className = t.remainingSeconds <= 0 ? "ended" : t.remainingSeconds <= t.warningSeconds ? "warning" : "";
  const anteText = !t.useAnte || level.anteType === "none" ? "Aus" : level.anteType === "bb" ? `BBA ${fmt(level.ante)}` : `Ante ${fmt(level.ante)}`;
  return `
    <div class="panel timer-stage">
      <div class="level-kicker">
        <span>${level.type === "break" ? "Pause" : `Level ${t.currentLevel + 1}`}</span>
        <span>${next ? `Nächstes: ${nextLabel(next)}` : "Finales Level"}</span>
      </div>
      <div class="clock ${className}" aria-live="polite">${formatTime(t.remainingSeconds)}</div>
      <div class="blinds">
        <div class="metric"><span>Small Blind</span><strong>${level.type === "break" ? "-" : fmt(level.smallBlind)}</strong></div>
        <div class="metric"><span>Big Blind</span><strong>${level.type === "break" ? "-" : fmt(level.bigBlind)}</strong></div>
        <div class="metric"><span>Ante</span><strong>${level.type === "break" ? "-" : anteText}</strong></div>
      </div>
      <div class="timer-controls">
        <button class="primary" data-action="toggleTimer">${t.running ? "Pause" : "Start"}</button>
        <button data-action="prevLevel">Zurück</button>
        <button data-action="nextLevel">Nächstes Level</button>
        <button data-action="resetTimer">Reset Level</button>
        <button class="soft-control" data-action="toggleTv">${state.tvMode ? "Bedienung" : "TV/Beamer"}</button>
      </div>
    </div>
  `;
}

function cashgameView() {
  const c = state.cashgame;
  const totalBuyIn = c.players.reduce((sum, p) => sum + num(p.buyIn), 0);
  const totalCashOut = c.players.reduce((sum, p) => sum + num(p.cashOut), 0);
  return `
    <main class="layout">
      <aside class="panel setup">
        <section class="section">
          <h2>Cashgame-Setup</h2>
          <div class="grid">
            ${input("Titel", "cashgame.title", c.title)}
            ${numberInput("Small Blind", "cashgame.smallBlind", c.smallBlind)}
            ${numberInput("Big Blind", "cashgame.bigBlind", c.bigBlind)}
            ${numberInput("Session-Minuten", "cashgame.timerMinutes", c.timerMinutes)}
          </div>
        </section>
        <section class="section">
          <h3>Spieler</h3>
          <div class="grid">
            <input id="new-cash-name" placeholder="Name" />
            <button data-action="addCashPlayer">Spieler hinzufügen</button>
          </div>
          <div class="table-wrap">${cashTable()}</div>
        </section>
      </aside>
      <section class="screen">
        <div class="panel timer-stage">
          <div class="level-kicker">
            <span>${c.title}</span>
            <span>Blinds ${fmt(c.smallBlind)} / ${fmt(c.bigBlind)}</span>
          </div>
          <div class="clock">${formatTime(c.timerMinutes > 0 ? Math.max(c.timerMinutes * 60 - c.elapsedSeconds, 0) : c.elapsedSeconds)}</div>
          <div class="blinds">
            <div class="metric"><span>Buy-ins</span><strong>${money(totalBuyIn)}</strong></div>
            <div class="metric"><span>Cash-outs</span><strong>${money(totalCashOut)}</strong></div>
            <div class="metric"><span>Offen</span><strong>${money(totalBuyIn - totalCashOut)}</strong></div>
          </div>
          <div class="timer-controls">
            <button class="primary" data-action="toggleCashTimer">${c.running ? "Pause" : "Start"}</button>
            <button data-action="resetCashTimer">Reset</button>
            <button data-action="toggleTv">${state.tvMode ? "Bedienung" : "TV/Beamer"}</button>
          </div>
        </div>
        <div class="secondary-panels cash-grid">
          <div class="panel section">
            <h3>Resultate</h3>
            <div class="list">${cashResults()}</div>
          </div>
          <div class="panel section">
            <h3>Hinweis</h3>
            <p class="notice">Cashgame kann als einfacher Session-Timer laufen. Bei Session-Minuten 0 zählt die Uhr aufwärts, sonst rückwärts.</p>
          </div>
        </div>
      </section>
    </main>
  `;
}

function input(label, path, value) {
  return `<label>${label}<input data-path="${path}" value="${escapeHtml(value)}" /></label>`;
}

function numberInput(label, path, value) {
  return `<label>${label}<input type="number" data-path="${path}" value="${escapeHtml(value)}" ${numberAttrs(numberRules[path])} /></label>`;
}

function numberAttrs(rule = {}) {
  const attrs = [];
  if (rule.min !== undefined) attrs.push(`min="${rule.min}"`);
  if (rule.max !== undefined && Number.isFinite(rule.max)) attrs.push(`max="${rule.max}"`);
  return attrs.join(" ");
}

function levelsTable() {
  const rows = state.tournament.levels.map((level, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><select data-level="${index}" data-field="type"><option value="level" ${level.type === "level" ? "selected" : ""}>Level</option><option value="break" ${level.type === "break" ? "selected" : ""}>Pause</option></select></td>
      <td><input data-level="${index}" data-field="minutes" type="number" value="${level.minutes}" ${numberAttrs(levelNumberRules.minutes)}></td>
      <td><input data-level="${index}" data-field="smallBlind" type="number" value="${level.smallBlind}" ${numberAttrs(levelNumberRules.smallBlind)}></td>
      <td><input data-level="${index}" data-field="bigBlind" type="number" value="${level.bigBlind}" ${numberAttrs(levelNumberRules.bigBlind)}></td>
      <td><input data-level="${index}" data-field="ante" type="number" value="${level.ante}" ${numberAttrs(levelNumberRules.ante)}></td>
      <td><select data-level="${index}" data-field="anteType"><option value="none" ${level.anteType === "none" ? "selected" : ""}>Aus</option><option value="regular" ${level.anteType === "regular" ? "selected" : ""}>Ante</option><option value="bb" ${level.anteType === "bb" ? "selected" : ""}>BBA</option></select></td>
      <td><button class="icon danger" title="Entfernen" data-action="removeLevel" data-index="${index}">x</button></td>
    </tr>
  `).join("");
  return `<table><thead><tr><th>#</th><th>Typ</th><th>Min.</th><th>SB</th><th>BB</th><th>Ante</th><th>Art</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function playersList() {
  return state.tournament.players.map((p, index) => `
    <div class="person ${p.active ? "" : "out"}">
      <div>
        <input data-player="${index}" data-field="name" value="${escapeHtml(p.name)}">
        <small>Rebuys: ${p.rebuys} | Add-ons: ${p.addons}</small>
      </div>
      <div class="row-actions">
        <button class="icon" title="Rebuy" data-action="rebuyPlayer" data-index="${index}">R</button>
        <button class="icon" title="Add-on" data-action="addonPlayer" data-index="${index}">A</button>
        <button data-action="togglePlayer" data-index="${index}">${p.active ? "Out" : "Aktiv"}</button>
      </div>
      <button class="icon danger" title="Entfernen" data-action="removePlayer" data-index="${index}">x</button>
    </div>
  `).join("");
}

function payoutTable() {
  const rows = state.tournament.payouts.map((p, index) => `
    <tr>
      <td><input data-payout="${index}" data-field="place" type="number" value="${p.place}" ${numberAttrs(payoutNumberRules.place)}></td>
      <td><input data-payout="${index}" data-field="percent" type="number" value="${p.percent}" ${numberAttrs(payoutNumberRules.percent)}></td>
      <td>${money(prizePool() * num(p.percent) / 100)}</td>
      <td><button class="icon danger" data-action="removePayout" data-index="${index}">x</button></td>
    </tr>
  `).join("");
  return `<table><thead><tr><th>Platz</th><th>%</th><th>Betrag</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function cashTable() {
  const rows = state.cashgame.players.map((p, index) => `
    <tr>
      <td><input data-cash-player="${index}" data-field="name" value="${escapeHtml(p.name)}"></td>
      <td><input data-cash-player="${index}" data-field="buyIn" type="number" value="${p.buyIn}" ${numberAttrs(cashPlayerNumberRules.buyIn)}></td>
      <td><input data-cash-player="${index}" data-field="cashOut" type="number" value="${p.cashOut}" ${numberAttrs(cashPlayerNumberRules.cashOut)}></td>
      <td>${money(num(p.cashOut) - num(p.buyIn))}</td>
      <td><button class="icon danger" data-action="removeCashPlayer" data-index="${index}">x</button></td>
    </tr>
  `).join("");
  return `<table><thead><tr><th>Name</th><th>Buy-in</th><th>Cash-out</th><th>+/-</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function tournamentMetrics() {
  const t = state.tournament;
  const active = t.players.filter((p) => p.active).length;
  const totalChips = t.players.length * num(t.startingStack)
    + t.players.reduce((sum, p) => sum + p.rebuys * num(t.rebuyStack) + p.addons * num(t.addOnStack), 0);
  return `
    <div class="metric"><span>Spieler aktiv</span><strong>${active}/${t.players.length}</strong></div>
    <div class="metric"><span>Prizepool</span><strong>${money(prizePool())}</strong></div>
    <div class="metric"><span>Chips gesamt</span><strong>${fmt(totalChips)}</strong></div>
    <div class="metric"><span>Average Stack</span><strong>${fmt(active ? Math.round(totalChips / active) : 0)}</strong></div>
  `;
}

function payoutTotal() {
  return state.tournament.payouts.reduce((sum, payout) => sum + num(payout.percent), 0);
}

function payoutSummary() {
  const total = payoutTotal();
  const ok = Math.abs(total - 100) < 0.01;
  const message = ok
    ? "Die Payout-Prozente ergeben genau 100%."
    : total < 100
      ? `Noch ${fmt(100 - total)}% nicht verteilt.`
      : `${fmt(total - 100)}% zu viel verteilt.`;
  return `<p class="notice payout-summary ${ok ? "valid" : "invalid"}">Payout verteilt: ${fmt(total)}%. ${message}</p>`;
}

function tournamentAlerts() {
  const t = state.tournament;
  const alerts = [];
  const level = t.levels[t.currentLevel];
  if (!t.players.length) alerts.push("Noch keine Spieler im Turnier.");
  if (t.players.length && !t.players.some((p) => p.active)) alerts.push("Alle Spieler sind als out markiert.");
  if (num(t.rake) > num(t.buyIn)) alerts.push("Die Fee ist höher als der Buy-in.");
  if (level && num(t.warningSeconds) >= num(level.minutes) * 60) alerts.push("Die Warnzeit ist länger als das aktuelle Level.");
  if (Math.abs(payoutTotal() - 100) >= 0.01) alerts.push("Die Payout-Prozente ergeben nicht 100%.");
  if (!alerts.length) return "";
  return `<div class="alert-list">${alerts.map((item) => `<p class="alert">${escapeHtml(item)}</p>`).join("")}</div>`;
}

function cashResults() {
  return state.cashgame.players.map((p) => {
    const result = num(p.cashOut) - num(p.buyIn);
    return `<div class="person"><strong>${escapeHtml(p.name)}</strong><span>${money(result)}</span></div>`;
  }).join("");
}

function historyList() {
  if (!history.length) return `<p class="notice">Noch keine archivierten Turniere.</p>`;
  return history.map((entry) => `
    <div class="history-item">
      <div>
        <strong>${escapeHtml(entry.title)}</strong>
        <small>${formatDateTime(entry.createdAt)} | ${entry.playersTotal} Spieler | ${money(entry.prizePool)}</small>
      </div>
      <div class="row-actions">
        <button data-action="loadHistory" data-id="${entry.id}">Laden</button>
        <button data-action="exportHistoryEntry" data-id="${entry.id}">Export</button>
        <button class="danger" data-action="removeHistory" data-id="${entry.id}">Löschen</button>
      </div>
    </div>
  `).join("");
}

function bindEvents() {
  document.querySelectorAll("[data-path]").forEach((el) => {
    el.addEventListener("change", () => {
      const value = el.type === "checkbox" ? el.checked : normalizeFieldValue(el.dataset.path, el.value);
      setPath(el.dataset.path, value);
      if (el.type === "number") el.value = value;
      if (el.dataset.path === "tournament.startingStack") syncTimerIfNeeded();
      render();
    });
  });

  document.querySelectorAll("[data-level]").forEach((el) => {
    el.addEventListener("change", () => {
      const level = state.tournament.levels[Number(el.dataset.level)];
      const field = el.dataset.field;
      level[field] = normalizeLevelField(field, el.value);
      if (field in levelNumberRules) el.value = level[field];
      if (field === "type" && level.type === "break") {
        level.smallBlind = 0;
        level.bigBlind = 0;
        level.ante = 0;
        level.anteType = "none";
      }
      if (Number(el.dataset.level) === state.tournament.currentLevel && field === "minutes") {
        state.tournament.remainingSeconds = num(level.minutes) * 60;
      }
      render();
    });
  });

  document.querySelectorAll("[data-player]").forEach((el) => {
    el.addEventListener("change", () => {
      state.tournament.players[Number(el.dataset.player)][el.dataset.field] = el.value;
      render();
    });
  });

  document.querySelectorAll("[data-payout]").forEach((el) => {
    el.addEventListener("change", () => {
      const payout = state.tournament.payouts[Number(el.dataset.payout)];
      const field = el.dataset.field;
      payout[field] = normalizePayoutField(field, el.value);
      el.value = payout[field];
      render();
    });
  });

  document.querySelectorAll("[data-cash-player]").forEach((el) => {
    el.addEventListener("change", () => {
      const player = state.cashgame.players[Number(el.dataset.cashPlayer)];
      const field = el.dataset.field;
      player[field] = normalizeCashPlayerField(field, el.value);
      if (field in cashPlayerNumberRules) el.value = player[field];
      render();
    });
  });

  document.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => handleAction(el));
  });

  const importFile = document.querySelector("#import-file");
  if (importFile) {
    importFile.addEventListener("change", importFromFile);
  }
}

function handleAction(el) {
  const action = el.dataset.action;
  if (action === "setMode") state.mode = el.dataset.mode;
  if (action === "toggleTheme") state.theme = state.theme === "dark" ? "light" : "dark";
  if (action === "toggleTv") state.tvMode = !state.tvMode;
  if (action === "toggleTimer") {
    unlockAudio();
    state.tournament.running = !state.tournament.running;
    resetRuntimeClock();
  }
  if (action === "testSound") playLevelEndSound();
  if (action === "resetTimer") resetCurrentLevel();
  if (action === "nextLevel") moveLevel(1);
  if (action === "prevLevel") moveLevel(-1);
  if (action === "addLevel" && state.tournament.levels.length < MAX_LEVELS) state.tournament.levels.push({ id: makeId(), name: "Level", minutes: 15, smallBlind: 100, bigBlind: 200, ante: 0, anteType: "none", type: "level" });
  if (action === "addBreak" && state.tournament.levels.length < MAX_LEVELS) state.tournament.levels.push({ id: makeId(), name: "Pause", minutes: 10, smallBlind: 0, bigBlind: 0, ante: 0, anteType: "none", type: "break" });
  if (action === "removeLevel") removeLevel(Number(el.dataset.index));
  if (action === "applyPreset") applyPreset(el.dataset.preset);
  if (action === "addPlayer") addPlayer();
  if (action === "removePlayer") state.tournament.players.splice(Number(el.dataset.index), 1);
  if (action === "togglePlayer") state.tournament.players[Number(el.dataset.index)].active = !state.tournament.players[Number(el.dataset.index)].active;
  if (action === "rebuyPlayer") addRebuy(Number(el.dataset.index));
  if (action === "addonPlayer") state.tournament.players[Number(el.dataset.index)].addons += 1;
  if (action === "addPayout" && state.tournament.payouts.length < MAX_PAYOUTS) state.tournament.payouts.push({ place: state.tournament.payouts.length + 1, percent: 0 });
  if (action === "removePayout") state.tournament.payouts.splice(Number(el.dataset.index), 1);
  if (action === "toggleCashTimer") {
    unlockAudio();
    state.cashgame.running = !state.cashgame.running;
    resetRuntimeClock();
  }
  if (action === "resetCashTimer") state.cashgame.elapsedSeconds = 0;
  if (action === "addCashPlayer") addCashPlayer();
  if (action === "removeCashPlayer") state.cashgame.players.splice(Number(el.dataset.index), 1);
  if (action === "archiveTournament") archiveTournament();
  if (action === "exportTournament") exportTournament();
  if (action === "exportHistory") exportHistory();
  if (action === "triggerImport") {
    document.querySelector("#import-file")?.click();
    return;
  }
  if (action === "loadHistory") loadHistoryEntry(el.dataset.id);
  if (action === "exportHistoryEntry") exportHistoryEntry(el.dataset.id);
  if (action === "removeHistory") removeHistoryEntry(el.dataset.id);
  render();
}

function setPath(path, value) {
  const keys = path.split(".");
  let target = state;
  while (keys.length > 1) target = target[keys.shift()];
  target[keys[0]] = value;
}

function normalizeFieldValue(path, value) {
  if (numberRules[path]) return clampNumber(value, numberRules[path]);
  if (path.endsWith(".title")) return cleanText(value, path.startsWith("cashgame") ? "Cashgame" : "Turnier");
  return parseMaybeNumber(value);
}

function normalizeLevelField(field, value) {
  if (field in levelNumberRules) return clampInteger(value, levelNumberRules[field]);
  if (field === "type") return normalizeChoice(value, ["level", "break"], "level");
  if (field === "anteType") return normalizeChoice(value, ["none", "regular", "bb"], "none");
  return value;
}

function normalizePayoutField(field, value) {
  if (field in payoutNumberRules) return field === "place"
    ? clampInteger(value, payoutNumberRules[field])
    : clampNumber(value, payoutNumberRules[field]);
  return value;
}

function normalizeCashPlayerField(field, value) {
  if (field in cashPlayerNumberRules) return clampNumber(value, cashPlayerNumberRules[field]);
  if (field === "name") return cleanText(value, "Spieler");
  return value;
}

function resetRuntimeClock() {
  lastTickAt = Date.now();
}

function syncTimerIfNeeded() {
  const level = state.tournament.levels[state.tournament.currentLevel];
  if (!state.tournament.running && level) state.tournament.remainingSeconds = num(level.minutes) * 60;
}

function applyPreset(key) {
  const preset = presets[key];
  state.preset = key;
  state.tournament.startingStack = preset.startingStack;
  state.tournament.levels = mapPresetLevels(preset.levels);
  state.tournament.currentLevel = 0;
  state.tournament.remainingSeconds = state.tournament.levels[0].minutes * 60;
  state.tournament.running = false;
  resetRuntimeClock();
}

function archiveTournament() {
  const snapshot = createTournamentSnapshot();
  history = [snapshot, ...history.filter((entry) => entry.id !== snapshot.id)].slice(0, 50);
}

function createTournamentSnapshot() {
  const tournament = structuredClone(state.tournament);
  tournament.running = false;
  return {
    id: makeId(),
    app: "Poker Timer",
    type: "tournament-result",
    version: 1,
    title: tournament.title || "Turnier",
    createdAt: new Date().toISOString(),
    prizePool: prizePool(),
    playersTotal: tournament.players.length,
    playersActive: tournament.players.filter((p) => p.active).length,
    tournament
  };
}

function loadHistoryEntry(id) {
  const entry = history.find((item) => item.id === id);
  if (!entry?.tournament) return;
  state.tournament = normalizeTournament(mergeDefaults(defaultState.tournament, structuredClone(entry.tournament)));
  state.tournament.running = false;
  state.mode = "tournament";
  resetRuntimeClock();
}

function removeHistoryEntry(id) {
  if (!confirm("Archiviertes Turnier wirklich löschen?")) return;
  history = history.filter((entry) => entry.id !== id);
}

function exportTournament() {
  downloadJson(createTournamentSnapshot(), fileName(`${state.tournament.title || "turnier"}-export`));
}

function exportHistory() {
  downloadJson({ app: "Poker Timer", type: "tournament-history", version: 1, exportedAt: new Date().toISOString(), history }, fileName("poker-timer-historie"));
}

function exportHistoryEntry(id) {
  const entry = history.find((item) => item.id === id);
  if (entry) downloadJson(entry, fileName(`${entry.title}-export`));
}

function importFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      importData(data);
      render();
    } catch {
      alert("Die Datei konnte nicht importiert werden.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function importData(data) {
  if (data?.type === "tournament-history" && Array.isArray(data.history)) {
    const imported = data.history.filter((entry) => entry?.tournament);
    history = mergeHistory(imported, history);
    return;
  }
  if (data?.type === "tournament-result" && data.tournament) {
    const normalized = normalizeHistoryEntry(data);
    history = mergeHistory([normalized], history);
    state.tournament = structuredClone(normalized.tournament);
    state.tournament.running = false;
    state.mode = "tournament";
    return;
  }
  if (data?.tournament) {
    state.tournament = normalizeTournament(mergeDefaults(defaultState.tournament, structuredClone(data.tournament)));
    state.tournament.running = false;
    state.mode = "tournament";
    return;
  }
  throw new Error("Unsupported import format");
}

function mergeHistory(imported, current) {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of imported) {
    const normalized = normalizeHistoryEntry(entry);
    byId.set(normalized.id, normalized);
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
}

function normalizeHistoryEntry(entry) {
  const tournament = normalizeTournament(mergeDefaults(defaultState.tournament, structuredClone(entry.tournament)));
  tournament.running = false;
  return {
    id: entry.id || makeId(),
    app: "Poker Timer",
    type: "tournament-result",
    version: 1,
    title: cleanText(entry.title, tournament.title || "Turnier"),
    createdAt: Number.isFinite(Date.parse(entry.createdAt)) ? entry.createdAt : new Date().toISOString(),
    prizePool: clampNumber(entry.prizePool, { min: 0, max: 100000000, fallback: calculatePrizePool(tournament) }),
    playersTotal: clampInteger(entry.playersTotal, { min: 0, max: MAX_PLAYERS, fallback: tournament.players.length }),
    playersActive: clampInteger(entry.playersActive, { min: 0, max: MAX_PLAYERS, fallback: tournament.players.filter((p) => p.active).length }),
    tournament
  };
}

function downloadJson(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileName(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "poker-timer";
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function addPlayer() {
  if (state.tournament.players.length >= MAX_PLAYERS) return;
  const input = document.querySelector("#new-player-name");
  const name = cleanText(input.value, `Spieler ${state.tournament.players.length + 1}`);
  state.tournament.players.push(player(name));
}

function addCashPlayer() {
  if (state.cashgame.players.length >= MAX_PLAYERS) return;
  const input = document.querySelector("#new-cash-name");
  const name = cleanText(input.value, `Spieler ${state.cashgame.players.length + 1}`);
  state.cashgame.players.push(cashPlayer(name, 0, 0));
}

function addRebuy(index) {
  if (state.tournament.currentLevel + 1 <= num(state.tournament.rebuyUntilLevel)) {
    state.tournament.players[index].rebuys += 1;
  } else {
    alert(`Rebuy ist nur bis Ende Level ${state.tournament.rebuyUntilLevel} erlaubt.`);
  }
}

function removeLevel(index) {
  if (state.tournament.levels.length <= 1) return;
  state.tournament.levels.splice(index, 1);
  state.tournament.currentLevel = Math.min(state.tournament.currentLevel, state.tournament.levels.length - 1);
  resetCurrentLevel();
}

function resetCurrentLevel() {
  const level = state.tournament.levels[state.tournament.currentLevel];
  state.tournament.remainingSeconds = num(level?.minutes) * 60;
  state.tournament.running = false;
  resetRuntimeClock();
}

function moveLevel(delta) {
  const nextIndex = Math.max(0, Math.min(state.tournament.levels.length - 1, state.tournament.currentLevel + delta));
  state.tournament.currentLevel = nextIndex;
  const level = state.tournament.levels[nextIndex];
  state.tournament.remainingSeconds = num(level.minutes) * 60;
  state.tournament.running = false;
  resetRuntimeClock();
}

function advanceLevel() {
  if (state.tournament.currentLevel >= state.tournament.levels.length - 1) {
    state.tournament.remainingSeconds = 0;
    state.tournament.running = false;
    return;
  }
  state.tournament.currentLevel += 1;
  const level = state.tournament.levels[state.tournament.currentLevel];
  state.tournament.remainingSeconds = num(level.minutes) * 60;
  state.tournament.running = true;
}

function prizePool() {
  return calculatePrizePool(state.tournament);
}

function calculatePrizePool(t) {
  const entries = t.players.length * Math.max(num(t.buyIn) - num(t.rake), 0);
  const rebuys = t.players.reduce((sum, p) => sum + p.rebuys * Math.max(num(t.rebuyPrice) - num(t.rake), 0), 0);
  const addons = t.players.reduce((sum, p) => sum + p.addons * Math.max(num(t.addOnPrice) - num(t.rake), 0), 0);
  return entries + rebuys + addons;
}

function tick() {
  if (!state.tournament.running && !state.cashgame.running) return;
  const delta = elapsedWholeSeconds();
  if (delta <= 0) return;

  if (state.tournament.running) advanceTournamentBy(state.tournament, delta, state.tournament.sound);
  if (state.cashgame.running) advanceCashgameBy(state.cashgame, delta, true);
  render();
}

function elapsedWholeSeconds() {
  const now = Date.now();
  const delta = Math.floor((now - lastTickAt) / 1000);
  if (delta > 0) lastTickAt += delta * 1000;
  return delta;
}

function advanceTournamentBy(t, seconds, soundEnabled) {
  let remainingDelta = Math.max(0, Math.floor(seconds));
  let playedEndSound = false;

  while (remainingDelta > 0 && t.running) {
    const before = Math.max(0, num(t.remainingSeconds));
    const after = before - remainingDelta;
    const warning = num(t.warningSeconds);

    if (soundEnabled && warning > 0 && before > warning && after <= warning) playWarningSound();

    if (after > 0) {
      t.remainingSeconds = after;
      break;
    }

    if (soundEnabled && !playedEndSound) {
      playLevelEndSound();
      playedEndSound = true;
    }

    remainingDelta = Math.abs(after);
    if (t.currentLevel < t.levels.length - 1) {
      t.currentLevel += 1;
      const level = t.levels[t.currentLevel];
      t.remainingSeconds = num(level.minutes) * 60;
      t.running = true;
    } else {
      t.remainingSeconds = 0;
      t.running = false;
    }
  }
}

function advanceCashgameBy(c, seconds, soundEnabled) {
  c.elapsedSeconds = Math.max(0, num(c.elapsedSeconds) + Math.max(0, Math.floor(seconds)));
  const limit = num(c.timerMinutes) * 60;
  if (limit > 0 && c.elapsedSeconds >= limit) {
    c.elapsedSeconds = limit;
    c.running = false;
    if (soundEnabled) playLevelEndSound();
  }
}

function startTicking() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = setInterval(tick, 1000);
}

function unlockAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

function playWarningSound() {
  beepSequence([
    { frequency: 660, duration: 0.1 },
    { frequency: 880, duration: 0.1, delay: 0.14 }
  ]);
}

function playLevelEndSound() {
  beepSequence([
    { frequency: 330, duration: 0.18 },
    { frequency: 220, duration: 0.28, delay: 0.22 },
    { frequency: 165, duration: 0.36, delay: 0.55 }
  ]);
}

function beepSequence(notes) {
  const ctx = unlockAudio();
  if (!ctx) return;
  notes.forEach((note) => beep(note.frequency, note.duration, note.delay || 0));
}

function beep(frequency, duration, delay = 0) {
  try {
    const ctx = unlockAudio();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  } catch {}
}

function nextLabel(level) {
  if (level.type === "break") return `${level.minutes} Min Pause`;
  return `${fmt(level.smallBlind)} / ${fmt(level.bigBlind)}`;
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function fmt(value) {
  return new Intl.NumberFormat("de-CH").format(num(value));
}

function money(value) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(num(value));
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMaybeNumber(value) {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) && String(value).trim() !== "" ? parsed : value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

render();
startTicking();
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
window.addEventListener("focus", tick);
