// Observe the main Runtime's stack modules, not capability-worker loads.
if (!require("node:worker_threads").isMainThread) return;

const { findSourceMap, registerHooks } = require("node:module");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

const stackRoot = path.join(__dirname, "src", "runtime-corpus", "stack");
const stackFiles = new Set(["inside.cts", "inside.cjs", "outside.cts", "outside.cjs"].map((name) => path.join(stackRoot, name)));
const observedLoads = [];

// ttsx installs its synchronous hooks through NODE_OPTIONS before this -r
// preload. This later hook observes the result returned by that nextLoad chain,
// including a runtime shortCircuit result, and returns the identical object.
// A bypassed hook supplies no evidence; these are load-return bytes rather than
// a claim that Node evaluated every observed source.
registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url.startsWith("file:")) {
      const file = fileURLToPath(url);
      if (stackFiles.has(file)) {
        const source = typeof result.source === "string" ? result.source : result.source == null ? undefined : Buffer.from(result.source).toString("utf8");
        observedLoads.push({ file, url, format: result.format, shortCircuit: result.shortCircuit, attribution: "unchanged nextLoad return after runtime hook registration", source, firstLines: source?.split(/\r?\n/).slice(0, 12) });
      }
    }
    return result;
  },
});

// This raw Node preload runs only in the existing Runtime child. It is outside
// the consumer TypeScript include and does not change its ambient type inputs.
process.once("beforeExit", () => {
  const maps = ["inside", "outside"].map((name) => {
    const source = path.join(__dirname, "src", "runtime-corpus", "stack", name + ".cts");
    const requested = path.join(__dirname, "src", "runtime-corpus", "stack", name + ".cjs");
    const loads = observedLoads.filter((row) => row.file === source || row.file === requested);
    return { source, requested, sourceMap: findSourceMap(source)?.payload, requestedMap: findSourceMap(requested)?.payload, loadHookReached: loads.length !== 0, loads };
  });
  process.stdout.write("TTSC_RUNTIME_MAPS:" + JSON.stringify(maps) + "\n");
});
