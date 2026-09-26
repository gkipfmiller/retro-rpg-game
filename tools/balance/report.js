// Builds the balance dashboard: one self-contained HTML page with the summary embedded and charts
// drawn as inline SVG (no libraries), so it opens offline or can be published as it is.

export function buildDashboard(summary) {
  const json = JSON.stringify(summary).replace(/</g, "\\u003c");
  return `<title>Dungeon 30 Balance Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root {
    color-scheme: dark;
    --ground: #120e0b; --panel: #1c1612; --raised: #241c16; --line: #3d3025; --line-strong: #5c4a37;
    --text: #efe4cf; --muted: #a8987e; --faint: #7a6c58; --accent: #d7a54d;
    --warrior: #e8955a; --wizard: #c4a0ff; --ranger: #8fd67b;
    --good: #8fd67b; --warn: #e6c26b; --bad: #ff8b7a;
    --display: "Pixelify Sans", "Trebuchet MS", sans-serif;
    --body: "IBM Plex Sans", "Trebuchet MS", system-ui, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 clamp(16px, 3vw, 40px) 56px; background: var(--ground); color: var(--text); font: 15px/1.5 var(--body); }
  header { padding-block: 32px 12px; }
  .kicker { margin: 0 0 6px; font: 500 12px/1 var(--display); letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent); }
  h1 { margin: 0; font: 700 clamp(28px, 5vw, 44px)/1 var(--display); color: #f7d58a; }
  h2 { margin: 40px 0 6px; font: 700 22px/1.2 var(--display); color: var(--accent); }
  h3 { margin: 18px 0 8px; font: 700 16px var(--display); }
  .meta { margin-top: 10px; font: 13px var(--mono); color: var(--muted); display: flex; flex-wrap: wrap; gap: 4px 18px; }
  .note { color: var(--muted); max-width: 78ch; margin: 0 0 12px; }
  .scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th { text-align: left; font: 500 11px/1 var(--display); letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); padding: 10px; background: var(--raised); border-bottom: 1px solid var(--line-strong); white-space: nowrap; cursor: default; }
  th[data-sort] { cursor: pointer; }
  td { padding: 8px 10px; border-top: 1px solid var(--line); vertical-align: top; }
  td.num, th.num { text-align: right; font-family: var(--mono); font-size: 13px; }
  .class-warrior { color: var(--warrior); } .class-wizard { color: var(--wizard); } .class-ranger { color: var(--ranger); }
  .pill { display: inline-block; padding: 2px 7px; border-radius: 3px; font: 12px var(--mono); border: 1px solid var(--line); }
  .good { color: var(--good); } .warn { color: var(--warn); } .bad { color: var(--bad); } .muted { color: var(--muted); }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 14px 16px; }
  svg text { fill: var(--muted); font: 11px var(--mono); }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; margin-top: 6px; }
  .legend span::before { content: ""; display: inline-block; width: 12px; height: 3px; margin-right: 6px; vertical-align: middle; background: currentColor; }
  .heat td { padding: 0; border: 1px solid var(--ground); }
  .heat td div { width: 100%; min-width: 22px; height: 22px; display: grid; place-items: center; font: 10px var(--mono); color: #1a120c; }
  .heat th { padding: 4px; font-size: 10px; letter-spacing: 0; text-align: center; }
  .bar { height: 10px; background: var(--accent); border-radius: 2px; }
  .bar.neg { background: var(--bad); }
  .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 10px; font-size: 13px; color: var(--muted); }
  input[type="search"], select { font: 14px var(--body); color: var(--text); background: var(--ground); border: 1px solid var(--line-strong); border-radius: 3px; padding: 5px 8px; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .flag { font: 11px var(--mono); padding: 1px 5px; border-radius: 3px; background: rgba(255, 139, 122, 0.12); color: var(--bad); white-space: nowrap; }
</style>

<header>
  <p class="kicker">Dungeon 30 · Balance simulator</p>
  <h1>Balance Report</h1>
  <div class="meta" id="meta"></div>
</header>
<p class="note">Bots play complete runs of the real game code. <b>Competent</b> bots use abilities, heal at 45% HP, use shrines, explore fully and shop for upgrades; <b>careless</b> bots basic-attack, heal at 25%, rush the stairs and buy a couple of potions. Together they bracket a strong player and a new one. Boons are picked at random from what the Grey Witness offers; skills are spread evenly across branches unless noted.</p>

<h2>Overview</h2>
<div class="scroll"><table id="overview"></table></div>

<h2>How far runs get</h2>
<p class="note">Share of runs still alive on arrival at each floor. Dashed lines mark the boss floors (10, 20, 30); the last point is clearing Floor 30.</p>
<div class="grid" id="survival"></div>

<h2>Where runs die</h2>
<p class="note">Of the runs that arrived at each floor, the share that died there. Darker cells are deadlier floors.</p>
<div class="scroll"><table class="heat" id="heat"></table></div>
<h3>Boss floors</h3>
<div class="scroll"><table id="bosses"></table></div>

<h2>What kills them</h2>
<div class="grid" id="killers"></div>

<h2>Progression (competent bots)</h2>
<p class="note">Averages on arrival at each floor, for runs that got there. HP% is current over max HP when the floor starts; potions are healing potions carried.</p>
<div class="grid" id="progression"></div>

<h2>Boons</h2>
<p class="note">Competent runs grouped by the boon they took. Small groups are noisy; treat gaps of a floor or two as within noise unless the run count is large.</p>
<div class="grid" id="boons"></div>

<h2>Skill branches</h2>
<p class="note">Competent bots that fill one branch first (then the rest), on the same seeds as the balanced baseline. Positive means that branch carries runs further.</p>
<div class="grid" id="skills"></div>

<h2>Items</h2>
<p class="note">From all main runs. <i>Found / run</i> counts pickups, chests and drops (not purchases). <i>Equip rate</i> is how often a bot that found it chose to wear it; low rates on gear flag items that are rarely worth wearing. <i>Winning kits</i> is the share of victories that ended with the item equipped.</p>
<div class="controls">
  <label for="item-search">Search <input type="search" id="item-search" placeholder="Name or id"></label>
  <label for="item-category">Category
    <select id="item-category"><option value="">All</option><option>weapon</option><option>armor</option><option>hands</option><option>accessory</option><option>consumable</option><option>tome</option><option>quest</option></select>
  </label>
  <label for="item-flags">Show
    <select id="item-flags"><option value="">All items</option><option value="flagged">Flagged only</option></select>
  </label>
</div>
<div class="scroll"><table id="items"></table></div>

<h2>Deadliest enemies</h2>
<div class="scroll"><table id="enemies"></table></div>

<h2>Bot problems</h2>
<p class="note">Runs where the bot got stuck or crashed. These are bot or game bugs, not balance data; they're excluded from nothing above, so a high count skews results.</p>
<div id="problems"></div>

<script>
const S = ${json};
const CLASS_COLOR = { warrior: "var(--warrior)", wizard: "var(--wizard)", ranger: "var(--ranger)" };
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tone = (value, good, bad, higherIsBetter = true) => {
  if (value == null) return "muted";
  if (higherIsBetter) return value >= good ? "good" : value <= bad ? "bad" : "warn";
  return value <= good ? "good" : value >= bad ? "bad" : "warn";
};

document.getElementById("meta").innerHTML = [
  \`<span><b>\${S.meta.totalRuns}</b> runs</span>\`,
  \`<span>\${S.meta.runsPer} per class and profile</span>\`,
  \`<span>\${S.meta.auditRuns} per skill branch</span>\`,
  \`<span>seed \${S.meta.baseSeed}</span>\`,
  \`<span>\${new Date(S.meta.generatedAt).toLocaleString()}</span>\`,
  \`<span>\${S.meta.seconds}s</span>\`,
  S.meta.label ? \`<span>“\${esc(S.meta.label)}”</span>\` : "",
].join("");

document.getElementById("overview").innerHTML = \`
  <tr><th>Class</th><th>Profile</th><th class="num">Runs</th><th class="num">Win rate</th><th class="num">Avg floor</th><th class="num">Median</th><th class="num">Avg level</th><th class="num">Heal potions</th><th class="num">Mana potions</th><th class="num">Kills</th><th class="num">Turns</th><th class="num">Stuck</th></tr>
  \${S.overview.map((r) => \`<tr>
    <td class="class-\${r.classId}">\${r.classLabel}</td><td>\${r.profile}</td>
    <td class="num">\${r.runs}</td>
    <td class="num \${tone(r.winRate, 25, 3)}">\${r.winRate}%</td>
    <td class="num">\${r.avgFloor}</td><td class="num">\${r.medianFloor}</td>
    <td class="num">\${r.avgLevel}</td><td class="num">\${r.avgHealPotions}</td><td class="num">\${r.avgManaPotions}</td>
    <td class="num">\${r.avgKills}</td><td class="num">\${r.avgTurns}</td>
    <td class="num \${r.stuck + r.errors ? "bad" : "muted"}">\${r.stuck + r.errors}</td></tr>\`).join("")}\`;

function lineChart(series) {
  const W = 520, H = 230, L = 36, R = 10, T = 10, B = 28;
  const x = (f) => L + (f / 31) * (W - L - R);
  const y = (v) => T + (1 - v / 100) * (H - T - B);
  let svg = \`<svg viewBox="0 0 \${W} \${H}" width="100%" role="img" aria-label="Survival curve">\`;
  for (const v of [0, 25, 50, 75, 100]) svg += \`<line x1="\${L}" x2="\${W - R}" y1="\${y(v)}" y2="\${y(v)}" stroke="#3d3025" stroke-width="1"/><text x="\${L - 6}" y="\${y(v) + 4}" text-anchor="end">\${v}%</text>\`;
  for (const f of [10, 20, 30]) svg += \`<line x1="\${x(f)}" x2="\${x(f)}" y1="\${T}" y2="\${H - B}" stroke="#7a3a2a" stroke-dasharray="3 3"/>\`;
  for (const f of [0, 5, 10, 15, 20, 25, 30]) svg += \`<text x="\${x(f)}" y="\${H - 10}" text-anchor="middle">\${f}</text>\`;
  for (const s of series) {
    const points = s.alive.map((v, f) => \`\${x(f).toFixed(1)},\${y(v).toFixed(1)}\`).join(" ");
    svg += \`<polyline points="\${points}" fill="none" stroke="\${CLASS_COLOR[s.classId]}" stroke-width="2.5" stroke-linejoin="round"/>\`;
    const last = s.alive[31];
    svg += \`<circle cx="\${x(31)}" cy="\${y(last)}" r="3.5" fill="\${CLASS_COLOR[s.classId]}"/>\`;
  }
  return svg + "</svg>";
}
const profiles = [...new Set(S.survival.map((s) => s.profile))];
document.getElementById("survival").innerHTML = profiles.map((profile) => {
  const series = S.survival.filter((s) => s.profile === profile);
  return \`<div class="card"><h3>\${profile}</h3>\${lineChart(series)}
    <div class="legend">\${series.map((s) => \`<span class="class-\${s.classId}">\${s.classLabel} · \${s.alive[31]}% clear</span>\`).join("")}</div></div>\`;
}).join("");

const heatColor = (rate) => {
  if (!rate) return "#2a211a";
  const t = Math.min(1, rate / 40);
  const r = Math.round(90 + t * 165), g = Math.round(70 + (1 - t) * 90), b = Math.round(50 + (1 - t) * 40);
  return \`rgb(\${r}, \${g}, \${b})\`;
};
document.getElementById("heat").innerHTML = \`<tr><th></th>\${Array.from({ length: 31 }, (_, f) => \`<th>\${f}</th>\`).join("")}</tr>\`
  + S.survival.map((s) => \`<tr><th class="class-\${s.classId}" style="text-align:left;padding:4px 8px;white-space:nowrap">\${s.classLabel} · \${s.profile}</th>\${s.deathRate.map((d) => \`<td title="Floor \${d.floor}: \${d.died} of \${d.arrived} died (\${d.rate}%)"><div style="background:\${heatColor(d.rate)}">\${d.arrived ? (d.rate >= 1 ? Math.round(d.rate) : "") : "·"}</div></td>\`).join("")}</tr>\`).join("");

document.getElementById("bosses").innerHTML = \`<tr><th>Class</th><th>Profile</th><th class="num">Super Skeletor (F10)</th><th class="num">Patches (F20)</th><th class="num">Abyssal Overlord (F30)</th></tr>\`
  + S.bossFloors.map((b) => \`<tr><td class="class-\${b.classId}">\${b.classLabel}</td><td>\${b.profile}</td>\${b.floors.map((f) => \`<td class="num \${tone(f.rate, 15, 45, false)}">\${f.arrived ? \`\${f.rate}% died <span class="muted">(\${f.died}/\${f.arrived})</span>\` : '<span class="muted">none arrived</span>'}</td>\`).join("")}</tr>\`).join("");

document.getElementById("killers").innerHTML = S.killers.map((k) => \`<div class="card"><h3 class="class-\${k.classId}">\${k.classLabel} · \${k.profile} <span class="muted" style="font:13px var(--body)">\${k.deaths} deaths</span></h3>
  <table>\${k.top.map((t) => \`<tr><td>\${esc(t.cause)}</td><td class="num">\${t.share}%</td><td style="width:40%"><div class="bar" style="width:\${t.share}%"></div></td><td class="num muted">F\${t.medianFloor}</td></tr>\`).join("")}</table></div>\`).join("");

document.getElementById("progression").innerHTML = S.progression.map((p) => \`<div class="card"><h3 class="class-\${p.classId}">\${p.classLabel}</h3>
  <table><tr><th class="num">Floor</th><th class="num">Runs</th><th class="num">Level</th><th class="num">Max HP</th><th class="num">HP%</th><th class="num">Potions</th><th class="num">Gold</th></tr>
  \${p.floors.filter((f) => f.runs).map((f) => \`<tr><td class="num">\${f.floor}</td><td class="num muted">\${f.runs}</td><td class="num">\${f.level}</td><td class="num">\${f.maxHp}</td><td class="num \${tone(f.hpPct, 75, 45)}">\${f.hpPct}%</td><td class="num">\${f.healPotions}</td><td class="num">\${f.gold}</td></tr>\`).join("")}</table></div>\`).join("");

document.getElementById("boons").innerHTML = S.boons.map((b) => \`<div class="card"><h3 class="class-\${b.classId}">\${b.classLabel} <span class="muted" style="font:13px var(--body)">baseline F\${b.baseline}</span></h3>
  <table><tr><th>Boon</th><th class="num">Runs</th><th class="num">Avg floor</th><th class="num">Win</th></tr>
  \${b.rows.map((r) => \`<tr title="\${esc(r.summary)}"><td>\${esc(r.name)}</td><td class="num muted">\${r.runs}</td><td class="num \${tone(r.avgFloor - b.baseline, 1.5, -1.5)}">\${r.avgFloor}</td><td class="num">\${r.winRate}%</td></tr>\`).join("")}</table></div>\`).join("");

document.getElementById("skills").innerHTML = S.skills.length ? S.skills.map((s) => {
  const maxDelta = Math.max(1, ...s.branches.map((b) => Math.abs(b.delta)));
  return \`<div class="card"><h3 class="class-\${s.classId}">\${s.classLabel} <span class="muted" style="font:13px var(--body)">balanced: F\${s.baseline.avgFloor}, \${s.baseline.winRate}% win</span></h3>
  <table><tr><th>Branch first</th><th class="num">Avg floor</th><th class="num">Win</th><th class="num">vs balanced</th><th></th></tr>
  \${s.branches.map((b) => \`<tr title="\${esc(b.skills.join("\\n"))}"><td>\${esc(b.name)}</td><td class="num">\${b.avgFloor}</td><td class="num">\${b.winRate}%</td><td class="num \${tone(b.delta, 1, -1)}">\${b.delta > 0 ? "+" : ""}\${b.delta}</td><td style="width:30%"><div class="bar \${b.delta < 0 ? "neg" : ""}" style="width:\${Math.abs(b.delta) / maxDelta * 100}%"></div></td></tr>\`).join("")}</table></div>\`;
}).join("") : '<p class="muted">Skill audit skipped for this run.</p>';

const itemState = { search: "", category: "", flags: "", sort: "found", desc: true };
const itemFlags = (i) => {
  const flags = [];
  if (!i.found && !i.bought && i.category !== "quest") flags.push("never found");
  if (i.slot && i.found >= 5 && i.equipRateWhenFound != null && i.equipRateWhenFound < 15) flags.push("rarely worn");
  if (i.slot && i.medianFirstFloor != null && i.rarity === "common" && i.medianFirstFloor >= 15) flags.push("late common");
  return flags;
};
function renderItems() {
  let rows = S.items.filter((i) => (!itemState.category || i.category === itemState.category)
    && (!itemState.search || (i.name + " " + i.id).toLowerCase().includes(itemState.search))
    && (!itemState.flags || itemFlags(i).length));
  rows.sort((a, b) => {
    const va = a[itemState.sort] ?? -1, vb = b[itemState.sort] ?? -1;
    const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
    return itemState.desc ? -cmp : cmp;
  });
  const head = [["name", "Item"], ["category", "Type"], ["classBias", "Class"], ["rarity", "Rarity"], ["value", "Value"], ["stats", "Stats"], ["foundPerRun", "Found / run"], ["runsFoundPct", "Runs found"], ["medianFirstFloor", "First floor"], ["bought", "Bought"], ["equipRateWhenFound", "Equip rate"], ["winningKitPct", "Winning kits"]];
  document.getElementById("items").innerHTML = \`<tr>\${head.map(([key, label]) => \`<th data-sort="\${key}" class="\${["value", "foundPerRun", "runsFoundPct", "medianFirstFloor", "bought", "equipRateWhenFound", "winningKitPct"].includes(key) ? "num" : ""}">\${label}\${itemState.sort === key ? (itemState.desc ? " ↓" : " ↑") : ""}</th>\`).join("")}<th>Flags</th></tr>\`
    + rows.map((i) => \`<tr><td>\${esc(i.name)}<br><span class="muted" style="font:12px var(--mono)">\${i.id}</span></td><td>\${i.category}\${i.slot && i.slot !== i.category ? " · " + i.slot : ""}</td><td>\${i.classBias ?? '<span class="muted">any</span>'}</td><td>\${i.rarity}</td>
      <td class="num">\${i.value}</td><td style="font:12px var(--mono);max-width:26ch">\${esc(i.stats)}</td>
      <td class="num">\${i.foundPerRun}</td><td class="num">\${i.runsFoundPct}%</td><td class="num">\${i.medianFirstFloor ?? "—"}</td><td class="num">\${i.bought}</td>
      <td class="num \${i.equipRateWhenFound == null ? "muted" : tone(i.equipRateWhenFound, 40, 15)}">\${i.equipRateWhenFound == null ? "—" : i.equipRateWhenFound + "%"}</td>
      <td class="num">\${i.winningKitPct}%</td><td>\${itemFlags(i).map((f) => \`<span class="flag">\${f}</span>\`).join(" ")}</td></tr>\`).join("");
}
document.getElementById("items").addEventListener("click", (event) => {
  const th = event.target.closest("th[data-sort]");
  if (!th) return;
  itemState.desc = itemState.sort === th.dataset.sort ? !itemState.desc : true;
  itemState.sort = th.dataset.sort;
  renderItems();
});
document.getElementById("item-search").addEventListener("input", (e) => { itemState.search = e.target.value.trim().toLowerCase(); renderItems(); });
document.getElementById("item-category").addEventListener("change", (e) => { itemState.category = e.target.value; renderItems(); });
document.getElementById("item-flags").addEventListener("change", (e) => { itemState.flags = e.target.value; renderItems(); });
renderItems();

document.getElementById("enemies").innerHTML = \`<tr><th>Enemy</th><th>Role</th><th class="num">Player deaths</th><th class="num">Share</th><th class="num">Median floor</th></tr>\`
  + S.enemies.slice(0, 20).map((e) => \`<tr><td>\${esc(e.name)}</td><td class="muted">\${e.behavior}</td><td class="num">\${e.kills}</td><td class="num">\${e.share}%</td><td class="num">\${e.medianFloor}</td></tr>\`).join("");

document.getElementById("problems").innerHTML = S.problems.length
  ? \`<div class="scroll"><table><tr><th>Class</th><th>Profile</th><th>Scenario</th><th class="num">Seed</th><th class="num">Floor</th><th>Result</th><th>Reason</th></tr>\${S.problems.map((p) => \`<tr><td>\${p.classId}</td><td>\${p.profile}</td><td>\${p.scenario}</td><td class="num">\${p.seed}</td><td class="num">\${p.floor}</td><td class="bad">\${p.result}</td><td>\${esc(p.reason)}</td></tr>\`).join("")}</table></div>\`
  : '<p class="good">None. Every run ended in a death or a victory.</p>';
</script>
`;
}
