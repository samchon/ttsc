import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  __dirname,
  assert,
  copyProject,
  nativePluginSource,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: source plugins serve an ordered `--plugins-json`
 * pipeline.
 *
 * Three descriptors select one unchanged producer source with distinct names
 * and options. The final literal observes their combined delivery; uppercase
 * affixes commute with upper, so it does not distinguish every reordering or
 * independently count compiled binaries and sidecar processes.
 *
 * 1. Rewrite `plugin.cjs` as a context-aware factory and configure three entries
 *    (prefix `A:`, identity, suffix `:Z`) all pointing at the same source
 *    directory.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit and `"A:PLUGIN:Z"` in the emitted JS.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual source host must emit A:PLUGIN:Z from the three authored factory entries with CLI status zero. Missing affixes or uppercase behavior differ, but these commuting affixes do not distinguish every permutation or duplicate upper operation.
 * @evidence contracts/testing.md#independent-expectations Literal prefix A:, original uppercase PLUGIN and suffix :Z prescribe the complete result independently of native execution.
 * @evidence contracts/testing.md#distinguishing-cases Distinct prefix, identity uppercase and suffix operations share one producer; producer lifetime and malformed source are separately exercised by the default-cache lifecycle and compiler-failure entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the named corpus-source entry in the generic E2E population; it owns one public emit CLI and final combined native output. Internal plugins-json argv is not directly captured by this body, and direct units are not claimed to execute this assembly.
 * @evidence contracts/e2e.md#necessary-boundary Factory names/options pass through the real launcher/native source host to emitted output, which direct descriptor composition cannot establish. The final literal has the stated permutation limits and is not a complete serialized-argv oracle.
 * @evidence contracts/e2e.md#shared-execution All entries select unchanged canonical simple-source and the explicit suite-owned shared cache. Only consumer options vary. Production identity governs reuse; output alone does not count binaries/processes, prove a hit or certify that no build occurred or minimum preparation cost was reached.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked consumer owns its configuration and initially absent main output; canonical source and suite-owned shared cache are not consumer cleanup targets. The synchronous result checks error, signal and status before reading output, without certifying arbitrary descendants or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Original zero status and A:PLUGIN:Z remain with the same three entries and actual producer source. CJS factory-context dirname/filename and ttsx fallback contributions retain their separate exact owners and actual-survival obligations; this output does not certify those owners executed or justify donor deletion.
 */
export function test_plugin_corpus_source_plugins_serve_an_ordered_plugins_json_pipeline(): void {
    const root = copyProject("go-source-plugin");
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
    const cacheDir = SHARED_PLUGIN_CACHE_DIR;
    // Override plugin.cjs to expose a context-driven manifest factory so we can
    // declare prefix → upper → suffix as ordered entries that all share the
    // same source dir (and therefore the same compiled binary).
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      `const path = require("node:path");
module.exports = (context) => ({
  name: context.plugin.name,
  source: path.resolve(${JSON.stringify(nativePluginSource("simple-source"))}),
});
`,
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
          plugins: [
            { transform: "./plugin.cjs", name: "prefix", prefix: "A:" },
            { transform: "./plugin.cjs", name: "upper" },
            { transform: "./plugin.cjs", name: "suffix", suffix: ":Z" },
          ],
        },
        include: ["src"],
      }),
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"A:PLUGIN:Z"/,
    );
  }
