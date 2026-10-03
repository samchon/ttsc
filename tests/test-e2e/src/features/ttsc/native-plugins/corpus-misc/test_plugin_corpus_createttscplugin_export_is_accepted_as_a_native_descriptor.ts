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
 * Verifies plugin corpus: createTtscPlugin export is accepted as a native
 * descriptor.
 *
 * Plugin authors may export a named `createTtscPlugin` factory as an
 * alternative to `module.exports = descriptor` or `exports.default`. The
 * descriptor loader must recognise this convention so both styles coexist
 * without requiring a separate entry-point per export shape.
 *
 * 1. Write a plugin descriptor file that exports `createTtscPlugin` returning a
 *    descriptor with the go-transformer source.
 * 2. Run ttsc with `--emit` against the fixture project.
 * 3. Assert zero exit and `"PLUGIN"` present in the emitted JS.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises named createTtscPlugin descriptor export loading; asserts zero exit and transformed PLUGIN JavaScript, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins the named factory export assembles the native producer rather than being rejected; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_createttscplugin_export_is_accepted_as_a_native_descriptor entry executes from native-plugins/corpus-misc in the generic E2E population without a platform filter in this body; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is named createTtscPlugin descriptor export loading; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable transformer workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; the descriptor shape is a distinct actual loader input. This body does not prove per-input independent preparation is minimal, measure cache hits/builds or certify packed installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion is made and a warm hit is not observed. TestProject owns exit cleanup after direct synchronous return, which does not certify arbitrary descendants or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Retains zero exit and transformed PLUGIN JavaScript with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_corpus_createttscplugin_export_is_accepted_as_a_native_descriptor() {
    const root = pluginProject(
      [{ transform: "./plugins/create.cjs", name: "create-export" }],
      {
        "plugins/create.cjs": `
        exports.createTtscPlugin = (context) => ({
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
    assert.ifError(result.error);
    assert.equal(result.signal, null, result.stderr);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
}
