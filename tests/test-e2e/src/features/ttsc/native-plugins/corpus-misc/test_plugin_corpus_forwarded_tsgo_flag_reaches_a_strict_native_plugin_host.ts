import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  nativePluginSource,
  path,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: a forwarded tsgo flag reaches a native host that
 * never declared `--tsgo-args`.
 *
 * Pins issue #1188. #113 shipped the forwarded-flag payload as a `--tsgo-args`
 * CLI flag, an addition to a plugin protocol third-party hosts had already
 * frozen: a host parsing with `flag.ContinueOnError` answers `flag provided but
 * not defined: -tsgo-args` and exits 2 before its build starts, so every
 * documented forwarded flag failed on any typia/nestia-shaped project. The
 * payload now rides `TTSC_TSGO_ARGS`, which such a host picks up simply by
 * calling `driver.LoadProgram`. The `go-driver-emit-plugin` host is exactly
 * that shape — strict `flag.FlagSet`, no `--tsgo-args`, `driver.LoadProgram`,
 * `EmitWithPluginTransformers` — the same shape typia's `ttsc-typia` has.
 *
 * The assertion is delivery, not survival: the project declares no `sourceMap`,
 * so a `.js.map` can only exist if `--sourceMap` actually reached the sidecar's
 * own compiler options. A zero exit alone would also pass if ttsc had merely
 * dropped the flag.
 *
 * 1. Build a project on the strict `go-driver-emit-plugin` host, with no
 *    `sourceMap` in its tsconfig.
 * 2. Run `ttsc --emit --sourceMap`.
 * 3. Assert zero exit, the transformed JavaScript, and an emitted `.js.map` with
 *    its trailer.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises forwarded sourceMap environment delivery; asserts zero exit, no unknown-flag error, transformed JavaScript, its map trailer and emitted map, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins a project lacking sourceMap receives the requested side product through native compiler options; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_forwarded_tsgo_flag_reaches_a_strict_native_plugin_host entry executes from native-plugins/corpus-misc in the Linux E2E population; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is forwarded sourceMap environment delivery; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable driver-emit workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion uses this warm fixture. TestProject removes temporary consumer state at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains zero exit, no unknown-flag error, transformed JavaScript, its map trailer and emitted map with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_corpus_forwarded_tsgo_flag_reaches_a_strict_native_plugin_host() {
    const root = commonJsProject(
      {
        "plugin.cjs": [
          `const path = require("node:path");`,
          `module.exports = (context) => ({`,
          `  name: "go-driver-emit-plugin",`,
          `  capabilities: { emitProvenance: true },`,
          `  source: ${JSON.stringify(nativePluginSource("driver-emit"))},`,
          `});`,
          ``,
        ].join("\n"),
        "src/main.ts": [
          `export const payload = { value: "before" };`,
          `console.log(payload.value);`,
          ``,
        ].join("\n"),
      },
      {
        compilerOptions: {
          plugins: [{ transform: "./plugin.cjs" }],
        },
      },
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit", "--sourceMap"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.doesNotMatch(
      `${result.stdout}${result.stderr}`,
      /flag provided but not defined/,
    );

    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /GO DRIVER EMIT PLUGIN/);
    assert.match(js, /\/\/# sourceMappingURL=main\.js\.map/);
    assert.ok(
      fs.existsSync(path.join(root, "dist", "main.js.map")),
      "forwarded --sourceMap did not reach the native host's compiler options",
    );
}
