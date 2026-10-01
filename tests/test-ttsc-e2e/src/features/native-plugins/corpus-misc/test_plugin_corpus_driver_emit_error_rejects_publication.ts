import { SHARED_GO_BUILD_CACHE_DIR, SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  nativePluginSource,
  path,
  spawn,
  ttscBin,
} from "../../../internal/plugin-corpus";

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
 * @evidence contracts/testing.md#independent-expectations Compiler declaration semantics and the fixture's literal transform establish required TS4094 failure or generated output; executable and declaration/map expectations are written independently of the launcher result.
 * @evidence contracts/testing.md#distinguishing-cases This case pins a declaration failure must abort publication independently of the consumer noEmitOnError option; the strict-host single-file case separately covers private emit provenance consumption.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_driver_emit_error_rejects_publication entry executes in the native corpus E2E batch against the actual source-built Go host, preserving the original fixture/assertion ownership.
 * @evidence contracts/e2e.md#necessary-boundary The native fixture calls driver.EmitWithPluginTransformers and publishes through a real filesystem writer; only the real source-plugin loader/host connection can reveal failed assembly or discarded native diagnostics.
 * @evidence contracts/e2e.md#shared-execution Both error consumers share the immutable canonical driver-emit producer and shared plugin/Go-object caches; only their compiler option and isolated consumer outputs differ.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each consumer has separate mutable compiler configuration and output state, while unchanged source/toolchain identity permits object reuse. Cold binary state stays isolated where asserted; TestProject owns temporary directories until process exit and each synchronous child finishes before output is inspected.
 * @evidence contracts/e2e.md#preserved-coverage Retains nonzero status, host/phase/severity/TS4094 diagnostics and no dist or manifest; the fixture additionally records actual successful final writes through the compiler-owned emit provenance recorder rather than deriving owners from output filenames.
 */
export function test_plugin_corpus_driver_emit_error_rejects_publication() {
  for (const noEmitOnError of [false, true]) {
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
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /go-driver-emit-plugin: emit failed/);
    assert.match(result.stderr, /native plugin .* failed/);
    assert.match(result.stderr, /error/);
    assert.match(result.stderr, /TS4094/);
    assert.match(result.stderr, /declaration output is incomplete or skipped/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
    assert.equal(fs.existsSync(manifest), false);
  }
}
