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
 * Multiple entries in tsconfig plugins that resolve to the same Go source
 * directory all share the same cached binary, but each entry may carry
 * different `prefix`/`suffix` options. ttsc serialises all entries into the
 * `--plugins-json` argument so the single sidecar binary applies each
 * transformation in declaration order.
 *
 * 1. Rewrite `plugin.cjs` as a context-aware factory and configure three entries
 *    (prefix `A:`, identity, suffix `:Z`) all pointing at the same source
 *    directory.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit and `"A:PLUGIN:Z"` in the emitted JS.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual source sidecar receives three factory entries and must emit the exact ordered A:PLUGIN:Z value with CLI status zero; dropped, duplicated or reordered descriptor operations change that result.
 * @evidence contracts/testing.md#independent-expectations Literal prefix A:, original uppercase PLUGIN and suffix :Z prescribe the complete result independently of native execution.
 * @evidence contracts/testing.md#distinguishing-cases Distinct prefix, identity uppercase and suffix operations share one producer; producer lifetime and malformed source are separately exercised by the default-cache lifecycle and compiler-failure entries.
 * @evidence contracts/testing.md#execution-ownership The named corpus-source entry owns one real emit CLI and ordered native plugins-json transport; no Go rule or TypeScript decision unit is claimed to exercise that assembly.
 * @evidence contracts/e2e.md#necessary-boundary Factory entry names and options must survive real launcher serialization into one native driver and retain their declaration order, which direct descriptor-composition units cannot establish.
 * @evidence contracts/e2e.md#shared-execution All three entries resolve one unchanged canonical go-source-plugin producer and shared content-addressed cache; only their actual per-entry options vary and no copied Go module is rebuilt for this consumer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The consumer configuration and emitted directory are private; the canonical source bytes never change, while TestProject owns the consumer and shared cache cleanup at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Original zero status and exact A:PLUGIN:Z assertions remain with the same three entries and actual Go producer body. CJS factory-context dirname/filename and ttsx fallback meaning remain in their two exact native factory-context survivors rather than being redundantly checked by another copied producer.
 */
export function test_plugin_corpus_source_plugins_serve_an_ordered_plugins_json_pipeline(): void {
    const root = copyProject("go-source-plugin");
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
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"A:PLUGIN:Z"/,
    );
  }
