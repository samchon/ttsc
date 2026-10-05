const { findSourceMap } = require("node:module");
const path = require("node:path");

// This raw Node preload runs only in the existing Runtime child. It is outside
// the consumer TypeScript include and does not change its ambient type inputs.
process.once("beforeExit", () => {
  const maps = ["inside", "outside"].map((name) => {
    const source = path.join(__dirname, "src", "runtime-corpus", "stack", name + ".cts");
    const requested = path.join(__dirname, "src", "runtime-corpus", "stack", name + ".cjs");
    return { source, requested, sourceMap: findSourceMap(source)?.payload, requestedMap: findSourceMap(requested)?.payload };
  });
  process.stdout.write("TTSC_RUNTIME_MAPS:" + JSON.stringify(maps) + "\n");
});
