#!/usr/bin/env node
// Balance simulator: plays many complete runs of the real game with bots, then writes the raw results,
// an aggregated summary, and a dashboard page.
//
//   npm run balance                       # default: 150 runs per class and profile, plus the skill audit
//   npm run balance -- --runs 400         # more runs for tighter numbers
//   npm run balance -- --audit-runs 0     # skip the skill-branch audit
//   npm run balance -- --label "after potion nerf"
//
// Output goes to tools/balance/out/: latest.json (summary), runs-latest.json (every run), and
// dashboard.html. Runs are seeded (--seed), so the same code and options reproduce the same numbers.

import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { summarize } from "./aggregate.js";
import { buildDashboard } from "./report.js";
import { data } from "./headless.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "out");

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const runsPer = Number(option("runs", 150));
const auditRuns = Number(option("audit-runs", 60));
const baseSeed = Number(option("seed", 20260926));
const label = option("label", "");
const classes = (option("classes", "warrior,wizard,ranger")).split(",");
const profiles = (option("profiles", "competent,careless")).split(",");
const threads = Number(option("threads", Math.max(1, availableParallelism() - 1)));

// Jobs: the main matrix (each class x profile, balanced skills, random boon), plus the skill audit
// (competent bots that fill one branch first, per class and branch). The same seeds are reused across
// scenarios so comparisons are like for like.
const jobs = [];
for (const classId of classes) {
  for (const profile of profiles) {
    for (let index = 0; index < runsPer; index += 1) {
      jobs.push({ scenario: "main", classId, profile, seed: baseSeed + index * 7919, skillStrategy: "balanced" });
    }
  }
  for (const branch of auditRuns > 0 ? data.SKILL_TREES[classId] : []) {
    for (let index = 0; index < auditRuns; index += 1) {
      jobs.push({ scenario: "skills", classId, profile: "competent", seed: baseSeed + index * 7919, skillStrategy: `focus:${branch.id}` });
    }
  }
}

console.log(`Playing ${jobs.length} runs on ${threads} threads (${runsPer} per class and profile, ${auditRuns} per skill branch)...`);
const started = Date.now();
const results = [];
let lastReport = 0;

// Deal jobs round-robin so every worker gets a mix of classes (runs vary a lot in length).
const buckets = Array.from({ length: threads }, () => []);
jobs.forEach((job, index) => buckets[index % threads].push(job));

await Promise.all(buckets.filter((bucket) => bucket.length).map((bucket) => new Promise((resolve, reject) => {
  const worker = new Worker(join(here, "worker.js"), { workerData: { jobs: bucket } });
  worker.on("message", (record) => {
    results.push(record);
    const now = Date.now();
    if (now - lastReport > 2000) {
      lastReport = now;
      process.stdout.write(`\r  ${results.length}/${jobs.length} runs (${Math.round((now - started) / 1000)}s)`);
    }
  });
  worker.on("error", reject);
  worker.on("exit", resolve);
})));

const seconds = Math.round((Date.now() - started) / 1000);
console.log(`\r  ${results.length}/${jobs.length} runs in ${seconds}s.           `);

const summary = summarize(results, { runsPer, auditRuns, baseSeed, label, seconds, generatedAt: new Date().toISOString() });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "runs-latest.json"), JSON.stringify(results));
writeFileSync(join(outDir, "latest.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(outDir, "dashboard.html"), buildDashboard(summary));

// A short console digest.
console.log("\nClass / profile        win%   avg floor   median   stuck   errors");
for (const row of summary.overview) {
  console.log(`${`${row.classLabel} / ${row.profile}`.padEnd(22)} ${String(row.winRate).padStart(5)}%   ${String(row.avgFloor).padStart(9)}   ${String(row.medianFloor).padStart(6)}   ${String(row.stuck).padStart(5)}   ${String(row.errors).padStart(6)}`);
}
console.log(`\nWrote ${join("tools/balance/out", "dashboard.html")}, latest.json and runs-latest.json.`);
