import { SHARED_GO_BUILD_CACHE_DIR, SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  nativePluginSource,
  path,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies a native host checking only Go errors rejects declaration failure.
 *
 * Legacy native hosts print emit diagnostics and publish pending outputs after
 * a nil Go error. TS4094 must now stop that path, including manifest
 * publication, with the host name, phase, severity and compiler code in the
 * error.
 *
 * 1. Copy the driver emit fixture and introduce a declaration-only error.
 * 2. Run the real ttsc source-plugin build with noEmitOnError on and off.
 * 3. Assert failure status, useful diagnostics and no output directory or
 *    manifest.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises the driver-backed native host with noEmitOnError both false and true; requires nonzero status, host/phase/severity/TS4094 diagnostics and no dist or manifest, distinguishing discarded emit diagnostics or incomplete native publication from valid transformed output.
 * @evidence contracts/testing.md#independent-expectations The authored exported class with private hidden member independently requires TS4094 under declaration emission. This failure entry asserts literal error messages and absent publication, not successful executable/declaration/map contents.
 * @evidence contracts/testing.md#distinguishing-cases This case pins a declaration failure must abort publication independently of the consumer noEmitOnError option; the strict-host single-file case separately covers private emit provenance consumption.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_driver_emit_error_rejects_publication entry executes in the native corpus E2E batch against the actual source-built Go host, preserving the original fixture/assertion ownership.
 * @evidence contracts/e2e.md#necessary-boundary The native fixture calls driver.EmitWithPluginTransformers and publishes through a real filesystem writer; only the real source-plugin loader/host connection can reveal failed assembly or discarded native diagnostics.
 * @evidence contracts/e2e.md#shared-execution Both error consumers share the immutable canonical driver-emit producer and shared plugin/Go-object caches; only their compiler option and isolated consumer outputs differ. Both independent inputs run even when one fails its assertion; named failures are reported after both. Cache hits and total builds/Program objects are not measured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each consumer has separate mutable compiler configuration and output state, with common producer inputs and cache locations available but no forced cold binary state or cache hit asserted. Each direct synchronous result must be error-free and nonsignal before numeric failure status is accepted. TestProject owns exit cleanup; arbitrary descendants and loaded-image identity remain unverified.
 * @evidence contracts/e2e.md#preserved-coverage Retains nonzero status, host/phase/severity/TS4094 diagnostics and no dist or manifest; the producer fixture may record successful writes on other paths, but this failing invocation neither reads nor certifies successful provenance records. The separate successful declaration-output boundary retains that meaningful coverage obligation.
 */
export function test_plugin_corpus_driver_emit_error_rejects_publication() {
  const failures: unknown[] = [];
  for (const noEmitOnError of [false, true]) {
    try {
      const root = copyProject("go-driver-emit-plugin");
      fs.writeFileSync(path.join(root, "plugin.cjs"), `module.exports = { name: "go-driver-emit-plugin", capabilities: { emitProvenance: true }, source: ${JSON.stringify(nativePluginSource("driver-emit"))} };\n`);
      const configPath = path.join(root, "tsconfig.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.compilerOptions.noEmitOnError = noEmitOnError;
      fs.writeFileSync(configPath, JSON.stringify(config));
      fs.writeFileSync(
        path.join(root, "src", "main.ts"),
        "export const value = class { private hidden = 1; };\n",
      );
      const manifest = path.join(root, "manifest.json");
      const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
        cwd: root,
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
          TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
        },
      });
      assert.ifError(result.error);
      assert.equal(result.signal, null, result.stdout + result.stderr);
      assert.equal(typeof result.status, "number", result.stdout + result.stderr);
      assert.notEqual(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stderr, /go-driver-emit-plugin: emit failed/);
      assert.match(result.stderr, /native plugin .* failed/);
      assert.match(result.stderr, /error/);
      assert.match(result.stderr, /TS4094/);
      assert.match(result.stderr, /declaration output is incomplete or skipped/);
      assert.equal(fs.existsSync(path.join(root, "dist")), false);
      assert.equal(fs.existsSync(manifest), false);
    } catch (error) {
      failures.push(new Error(`Declaration failure with noEmitOnError=${noEmitOnError}`, { cause: error }));
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Native declaration failure publication checks failed");
}
