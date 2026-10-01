import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  nativePluginSource,
  path,
  pluginProject,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: default export factory is accepted as a native
 * descriptor.
 *
 * Plugin descriptors may use `exports.default = (context) => descriptor` in
 * addition to the plain `module.exports = descriptor` shape. The descriptor
 * loader must recognise both so package authors who prefer named exports are
 * not forced to use `module.exports`.
 *
 * 1. Write a plugin file that sets `exports.default` to a factory function
 *    returning a descriptor pointing at the go-transformer source.
 * 2. Run ttsc with `--emit` against the fixture project.
 * 3. Assert zero exit and `"PLUGIN"` present in the emitted JS.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises default factory descriptor export loading; asserts zero exit and transformed PLUGIN JavaScript, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins the default factory export assembles the native producer rather than being rejected; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_default_export_factory_is_accepted_as_a_native_descriptor entry executes from native-plugins/corpus-misc in the Linux E2E population; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is default factory descriptor export loading; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable transformer workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion uses this warm fixture. TestProject removes temporary consumer state at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains zero exit and transformed PLUGIN JavaScript with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_corpus_default_export_factory_is_accepted_as_a_native_descriptor() {
    const root = pluginProject(
      [{ transform: "./plugins/default.cjs", name: "default-shape" }],
      {
        "plugins/default.cjs": `
        exports.default = (context) => ({
          name: context.plugin.name,
          source: ${JSON.stringify(nativePluginSource())},
        });
      `,
      },
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
}
