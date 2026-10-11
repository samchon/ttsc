import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  nativePluginSource,
  path,
  spawn,
  ttsxBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import {
  MOCHA_BIN,
  TTSX_REGISTER,
  linkTtscPackage,
} from "../../../../internal/ttsc/internal/ttsx-register";

/**
 * Verifies plugin corpus: ttsx runs a host that declares no emit provenance.
 *
 * A plugin library's own executable host, typia's for one, parses its own argv
 * and declares no `emitProvenance` capability. ttsx requires emit provenance,
 * and used to reject such a host outright with "does not support required emit
 * provenance", which broke every such library under ttsx and its register hook
 * (0.31.4). The host must run unchanged, with its ownership observed from
 * outside.
 *
 * 1. Copy the native Go-source plugin fixture with a descriptor that declares no
 *    capability.
 * 2. Run its entry through the ttsx CLI and assert the transformed value runs.
 * 3. Load an excluded root through real Mocha with `--require ttsc/register` and
 *    assert the same.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual ttsx CLI and the real Mocha preload execute TypeScript transformed by the actual Go host, requiring zero exit and uppercase PLUGIN output with no provenance rejection.
 * @evidence contracts/testing.md#independent-expectations Each entry calls goUpper on lowercase plugin; literal uppercase stdout independently establishes native transformation, and the absent capability is authored in the descriptor.
 * @evidence contracts/testing.md#distinguishing-cases A host without the capability, contrasted with the declaring descriptor of test_plugin_corpus_ttsx_register_executes_source_plugin_output_end_to_end, on both the CLI and the register path.
 * @evidence contracts/testing.md#execution-ownership This named native export owns one consumer project, one ttsx process and one Mocha process, selected once by the native boundary runner.
 * @evidence contracts/e2e.md#necessary-boundary The rejection lived in build execution between the descriptor's capabilities and the runtime's provenance requirement; only a real descriptor, Go host and ttsx run cross all three.
 * @evidence contracts/e2e.md#shared-execution The canonical Go producer and the suite TTSC_CACHE_DIR are shared with other runtime consumers; build counts and executable-byte reuse are not measured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The descriptor, entries and module links belong to the temporary project. Direct command return precedes stdout inspection but does not certify arbitrary descendants.
 * @evidence contracts/e2e.md#preserved-coverage Adds the undeclared-capability boundary without changing the declaring cases.
 */
export function test_plugin_corpus_ttsx_runs_a_host_that_declares_no_emit_provenance(): void {
  const root = copyProject("go-source-plugin");
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    `module.exports = () => ({ name: "go-source-plugin", source: ${JSON.stringify(nativePluginSource("runtime-source"))} });\n`,
  );
  const env = {
    PATH: goPath(),
    TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
  };

  const executed = spawn(ttsxBin, ["src/main.ts"], { cwd: root, env });
  assert.ifError(executed.error);
  assert.equal(executed.signal, null);
  assert.equal(executed.status, 0, executed.stderr);
  assert.doesNotMatch(executed.stderr, /emit provenance/);
  assert.equal(executed.stdout.trim(), "PLUGIN");

  linkTtscPackage(root);
  const testDir = path.join(root, "test");
  fs.mkdirSync(testDir);
  fs.writeFileSync(
    path.join(testDir, "main.ts"),
    [
      `export const value: string = goUpper("plugin");`,
      `console.log(value);`,
      "",
    ].join("\n"),
    "utf8",
  );
  const registered = spawn(
    process.execPath,
    [
      MOCHA_BIN,
      "--require",
      TTSX_REGISTER,
      "--extension",
      "ts",
      "test/main.ts",
    ],
    { cwd: root, env },
  );
  assert.ifError(registered.error);
  assert.equal(registered.signal, null);
  assert.equal(registered.status, 0, registered.stderr);
  assert.doesNotMatch(registered.stderr, /emit provenance/);
  assert.match(registered.stdout, /^PLUGIN$/m);
}
