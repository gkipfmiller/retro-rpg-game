// Worker thread: plays the runs it's given and sends each result back as it finishes.
import { parentPort, workerData } from "node:worker_threads";
import { playRun } from "./bot.js";

for (const job of workerData.jobs) {
  let record;
  try {
    record = playRun(job);
  } catch (error) {
    record = { ...job, result: "error", error: String(error?.stack ?? error), floors: [], acquired: [], equipped: [], bought: [], skills: [], potionsUsed: {} };
  }
  record.scenario = job.scenario;
  parentPort.postMessage(record);
}
