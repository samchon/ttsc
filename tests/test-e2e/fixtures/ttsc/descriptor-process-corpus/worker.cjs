const fs = require("node:fs");
const path = require("node:path");
const { loadProjectPlugins } = require(process.env.DESCRIPTOR_API);
const tsconfig = path.join(__dirname, "tsconfig.json");
const cases = [
  ["factory", "factory.cts"],
  ["module", "module.cts"],
  ["counterfeit", "counterfeit.cts", true],
  ["counterfeit-missing", "counterfeit-missing.cts", true],
  ["mutated-missing", "mutated-missing.cts", true],
  ["late-candidate-race", "late-candidate-race.cts", true],
  ["directory-candidate-race", "directory-candidate-race.cts", true],
  ["context", "descriptor/context.ts"],
  ["body", "descriptor/body.ts"],
];
const results = [];
for (const [name, file, refuseFallback] of cases) {
  fs.writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: { plugins: [{ transform: path.join(__dirname, file) }] },
  }));
  const env = {
    ...process.env,
    TTSC_DESC_MARKER: name === "context" ? "context-only" : "effective",
    ...(refuseFallback ? { TTSC_TTSX_BINARY: path.join(__dirname, "trap.cjs") } : {}),
  };
  try {
    loadProjectPlugins({ binary: "", env, tsconfig });
    results.push({ name, failed: false, message: "NO_ERROR" });
  } catch (error) {
    const message = String(error?.message ?? error);
    results.push({ name, failed: true, message });
    process.stderr.write(name + ": " + message + "\n");
  }
}
fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(results));
