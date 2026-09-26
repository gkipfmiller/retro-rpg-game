// Turns per-run records into the summary the dashboard and console report show.
import { Game, data } from "./headless.js";

const { ITEMS, CLASSES, BOONS, SKILL_TREES, ENEMIES } = data;
const game = new Game();

const round = (value, places = 1) => Math.round(value * 10 ** places) / 10 ** places;
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const percent = (part, whole) => (whole ? round((part / whole) * 100) : 0);
const groupBy = (items, keyOf) => items.reduce((groups, item) => {
  const key = keyOf(item);
  (groups[key] ??= []).push(item);
  return groups;
}, {});

// Floors "reached": a victory counts as clearing Floor 30 (31 for the survival curve).
const depth = (run) => (run.result === "victory" ? 31 : run.floorReached);

export function summarize(results, meta) {
  const main = results.filter((run) => run.scenario === "main");
  const audit = results.filter((run) => run.scenario === "skills");
  const cells = groupBy(main, (run) => `${run.classId}|${run.profile}`);
  const cellEntries = Object.entries(cells).map(([key, runs]) => {
    const [classId, profile] = key.split("|");
    return { classId, profile, classLabel: CLASSES[classId]?.name ?? classId, runs };
  });

  const overview = cellEntries.map(({ classId, profile, classLabel, runs }) => ({
    classId, profile, classLabel,
    runs: runs.length,
    wins: runs.filter((run) => run.result === "victory").length,
    winRate: percent(runs.filter((run) => run.result === "victory").length, runs.length),
    avgFloor: round(average(runs.map((run) => Math.min(30, depth(run))))),
    medianFloor: median(runs.map((run) => Math.min(30, depth(run)))),
    stuck: runs.filter((run) => run.result === "stuck").length,
    errors: runs.filter((run) => run.result === "error").length,
    avgLevel: round(average(runs.map((run) => run.level))),
    avgTurns: Math.round(average(runs.map((run) => run.turns))),
    avgHealPotions: round(average(runs.map((run) => run.potionsUsed?.heal ?? 0))),
    avgManaPotions: round(average(runs.map((run) => run.potionsUsed?.mana ?? 0))),
    avgKills: Math.round(average(runs.map((run) => run.kills ?? 0))),
  }));

  // Share of runs alive on arrival at each floor, and how many of those died there.
  const survival = cellEntries.map(({ classId, profile, classLabel, runs }) => ({
    classId, profile, classLabel,
    alive: Array.from({ length: 32 }, (_, floor) => percent(runs.filter((run) => depth(run) >= floor).length, runs.length)),
    deathRate: Array.from({ length: 31 }, (_, floor) => {
      const arrived = runs.filter((run) => depth(run) >= floor);
      const died = arrived.filter((run) => run.result === "death" && run.floorReached === floor);
      return { floor, arrived: arrived.length, died: died.length, rate: percent(died.length, arrived.length) };
    }),
  }));

  const killers = cellEntries.map(({ classId, profile, classLabel, runs }) => {
    const deaths = runs.filter((run) => run.result === "death");
    const byCause = groupBy(deaths, (run) => run.cause ?? "Unknown");
    return {
      classId, profile, classLabel, deaths: deaths.length,
      top: Object.entries(byCause)
        .map(([cause, list]) => ({ cause, count: list.length, share: percent(list.length, deaths.length), medianFloor: median(list.map((run) => run.floorReached)) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  });

  const bossFloors = cellEntries.map(({ classId, profile, classLabel, runs }) => ({
    classId, profile, classLabel,
    floors: [10, 20, 30].map((floor) => {
      const arrived = runs.filter((run) => depth(run) >= floor);
      const died = arrived.filter((run) => run.result === "death" && run.floorReached === floor);
      return { floor, arrived: arrived.length, died: died.length, rate: percent(died.length, arrived.length) };
    }),
  }));

  // Progression snapshots on arrival at key floors, for competent bots.
  const keyFloors = [1, 3, 5, 8, 10, 12, 15, 18, 20, 22, 25, 28, 30];
  const progression = Object.entries(groupBy(main.filter((run) => run.profile === "competent"), (run) => run.classId)).map(([classId, runs]) => ({
    classId,
    classLabel: CLASSES[classId]?.name ?? classId,
    floors: keyFloors.map((floor) => {
      const snapshots = runs.map((run) => run.floors.find((entry) => entry.floor === floor)).filter(Boolean);
      return {
        floor,
        runs: snapshots.length,
        level: round(average(snapshots.map((entry) => entry.level))),
        hpPct: Math.round(average(snapshots.map((entry) => (entry.hp / entry.maxHp) * 100))),
        maxHp: Math.round(average(snapshots.map((entry) => entry.maxHp))),
        healPotions: round(average(snapshots.map((entry) => entry.healPotions))),
        gold: Math.round(average(snapshots.map((entry) => entry.gold))),
        power: round(average(snapshots.map((entry) => entry.power))),
      };
    }),
  }));

  const boons = Object.entries(groupBy(main.filter((run) => run.profile === "competent" && run.boon), (run) => run.classId)).map(([classId, runs]) => ({
    classId,
    classLabel: CLASSES[classId]?.name ?? classId,
    baseline: round(average(runs.map((run) => Math.min(30, depth(run))))),
    rows: Object.entries(groupBy(runs, (run) => run.boon))
      .map(([boonId, list]) => ({
        boonId,
        name: BOONS[boonId]?.name ?? boonId,
        summary: BOONS[boonId]?.summary ?? "",
        runs: list.length,
        avgFloor: round(average(list.map((run) => Math.min(30, depth(run))))),
        winRate: percent(list.filter((run) => run.result === "victory").length, list.length),
      }))
      .sort((a, b) => b.avgFloor - a.avgFloor),
  }));

  // Skill audit: bots that fill one branch first, against the balanced baseline on the same seeds.
  const skills = Object.entries(groupBy(audit, (run) => run.classId)).map(([classId, runs]) => {
    const baselineRuns = main.filter((run) => run.classId === classId && run.profile === "competent" && runs.some((other) => other.seed === run.seed));
    const baseline = {
      avgFloor: round(average(baselineRuns.map((run) => Math.min(30, depth(run))))),
      winRate: percent(baselineRuns.filter((run) => run.result === "victory").length, baselineRuns.length),
    };
    return {
      classId,
      classLabel: CLASSES[classId]?.name ?? classId,
      baseline,
      branches: Object.entries(groupBy(runs, (run) => run.skillStrategy.slice(6))).map(([branchId, list]) => {
        const branch = SKILL_TREES[classId].find((entry) => entry.id === branchId);
        const avgFloor = round(average(list.map((run) => Math.min(30, depth(run)))));
        return {
          branchId,
          name: branch?.name ?? branchId,
          skills: branch?.skills.map((skill) => `${skill.name}: ${skill.description}`) ?? [],
          runs: list.length,
          avgFloor,
          winRate: percent(list.filter((run) => run.result === "victory").length, list.length),
          delta: round(avgFloor - baseline.avgFloor),
        };
      }).sort((a, b) => b.avgFloor - a.avgFloor),
    };
  });

  // Items: how often each is found, when, whether bots equip it, and whether it's in winning kits.
  const itemStats = Object.fromEntries(Object.keys(ITEMS).map((id) => [id, { found: 0, runsFound: 0, firstFloors: [], bought: 0, runsEquipped: 0, byClass: {} }]));
  for (const run of main) {
    const seen = new Set();
    for (const entry of run.acquired ?? []) {
      const stats = itemStats[entry.itemId];
      if (!stats) continue;
      stats.found += 1;
      if (!seen.has(entry.itemId)) {
        seen.add(entry.itemId);
        stats.runsFound += 1;
        stats.firstFloors.push(entry.floor);
      }
    }
    for (const entry of run.bought ?? []) if (itemStats[entry.itemId]) itemStats[entry.itemId].bought += 1;
    const equippedIds = new Set((run.equipped ?? []).map((entry) => entry.itemId));
    for (const id of equippedIds) {
      if (!itemStats[id]) continue;
      itemStats[id].runsEquipped += 1;
      itemStats[id].byClass[run.classId] = (itemStats[id].byClass[run.classId] ?? 0) + 1;
    }
  }
  const victories = main.filter((run) => run.result === "victory");
  const items = Object.values(ITEMS).map((item) => {
    const stats = itemStats[item.id];
    const inWinningKit = victories.filter((run) => Object.values(run.endEquipment ?? {}).includes(item.id)).length;
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      slot: item.slot ?? null,
      classBias: item.classBias ? CLASSES[item.classBias]?.name : null,
      rarity: game.getItemRarity(item.id),
      value: item.value ?? 0,
      stats: game.formatItemStats(item.id),
      avgDamage: item.damage ? round((item.damage[0] + item.damage[1]) / 2) : null,
      found: stats.found,
      foundPerRun: round(stats.found / Math.max(1, main.length), 2),
      runsFoundPct: percent(stats.runsFound, main.length),
      medianFirstFloor: median(stats.firstFloors),
      bought: stats.bought,
      runsEquippedPct: percent(stats.runsEquipped, main.length),
      equipRateWhenFound: item.slot ? percent(stats.runsEquipped, Math.max(stats.runsFound, stats.runsEquipped)) : null,
      winningKitPct: percent(inWinningKit, victories.length),
      equippedBy: stats.byClass,
    };
  });

  const enemies = (() => {
    const deaths = main.filter((run) => run.result === "death" && run.killerTemplate && ENEMIES[run.killerTemplate]);
    return Object.entries(groupBy(deaths, (run) => run.killerTemplate))
      .map(([templateId, list]) => ({ templateId, name: ENEMIES[templateId].name, behavior: ENEMIES[templateId].behavior, kills: list.length, share: percent(list.length, deaths.length), medianFloor: median(list.map((run) => run.floorReached)) }))
      .sort((a, b) => b.kills - a.kills);
  })();

  const problems = results
    .filter((run) => run.result === "stuck" || run.result === "error")
    .slice(0, 25)
    .map((run) => ({ classId: run.classId, profile: run.profile, seed: run.seed, scenario: run.scenario, result: run.result, floor: run.floorReached, reason: run.stuckReason ?? run.error?.split("\n")[0] }));

  return { meta: { ...meta, totalRuns: results.length }, overview, survival, killers, bossFloors, progression, boons, skills, items, enemies, problems };
}
