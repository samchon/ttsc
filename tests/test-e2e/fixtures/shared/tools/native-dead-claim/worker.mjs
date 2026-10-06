import fs from "node:fs";
import path from "node:path";
const [apiUrl, root, encodedOptions, mode] = process.argv.slice(2);
const api = await import(apiUrl);
const file = path.join(root, "src/mod.ts");
let cache;
const original = fs.readFileSync(file);
const observations = [];
const temporary = () => ["TEMP", "TMP", "TMPDIR"].map((key) => [key, process.env[key] ?? null]);
try {
  for (let index = 0; index < (mode === "responsive" ? 2 : 1); index++) {
    if (index !== 0) fs.appendFileSync(file, "\n// fresh native responsiveness epoch\n");
    cache = api.createTtscTransformCache();
    api.shareTtscTransformCache(cache, api.readTtscTransformSession());
    const before = temporary();
    const ticks = [];
    const started = performance.now();
    const timer = setInterval(() => ticks.push(performance.now()), 1);
    let result;
    let ended;
    try {
      result = await api.transformTtsc(file, fs.readFileSync(file, "utf8"), api.resolveOptions(JSON.parse(encodedOptions)), undefined, cache);
    } finally {
      ended = performance.now();
      clearInterval(timer);
    }
    let maximumGapMs = (ticks[0] ?? ended) - started;
    for (let tick = 1; tick < ticks.length; tick++) maximumGapMs = Math.max(maximumGapMs, ticks[tick] - ticks[tick - 1]);
    maximumGapMs = Math.max(maximumGapMs, ended - (ticks.at(-1) ?? started));
    observations.push({ code: result?.code ?? null, before, after: temporary(), maximumGapMs, elapsedMs: ended - started, nativeRuns: fs.readFileSync(JSON.parse(encodedOptions).plugins[0].runLog, "utf8").trim().split(/\r?\n/).length });
    api.resetTtscTransformCache(cache);
    cache = undefined;
  }
  console.log(JSON.stringify({ code: observations[0]?.code ?? null, observations }));
} catch (error) {
  console.log(JSON.stringify({ error: String(error?.stack ?? error) }));
} finally {
  if (cache !== undefined) api.resetTtscTransformCache(cache);
  fs.writeFileSync(file, original);
}
