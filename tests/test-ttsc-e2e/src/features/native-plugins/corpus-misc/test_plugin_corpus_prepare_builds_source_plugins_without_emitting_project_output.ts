import { TestProject } from "@ttsc/testing";

import { SHARED_GO_BUILD_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  pluginCacheEntryDirs,
  spawn,
  ttscBin,
} from "../../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: prepare builds source plugins without emitting
 * project output.
 *
 * The `ttsc prepare` subcommand is designed for CI warm-up: it compiles all
 * source plugins and populates the cache but must not touch TypeScript source
 * files or write JS output. A subsequent `ttsc --emit` should then skip the
 * build step entirely.
 *
 * 1. Copy the `go-source-plugin` fixture and run `ttsc prepare`.
 * 2. Assert zero exit, the `ttsc: prepared` stdout line, the build log in stderr,
 *    no `dist/` directory, and exactly one binary under the plugin cache.
 * 3. Run `ttsc --emit` against the same cache and assert it skips the build
 *    (`building source plugin` absent) yet produces correct JS output.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc prepare builds exactly one cached binary without dist, then --emit reuses it without a build log and emits PLUGIN.
 * @evidence contracts/testing.md#independent-expectations prepare promises preparation without project emit; the fixture transform independently defines PLUGIN.
 * @evidence contracts/testing.md#distinguishing-cases Cold prepare followed by warm emit distinguishes preparation from accidental compilation or rebuilding.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_prepare_builds_source_plugins_without_emitting_project_output entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The prepare CLI builds and publishes a real source plugin without compiling the consumer, and a separate --emit invocation consumes that publication. Native builder units do not prove the subcommand separates preparation from project emit and passes its cache to the subsequent command.
 * @evidence contracts/e2e.md#shared-execution One cold plugin cache and shared Go object cache prepare the producer once; the subsequent emit consumes that exact cache and explicitly rejects a second source build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc prepare builds exactly one cached binary without dist, then --emit reuses it without a build log and emits PLUGIN. These assertions stay in test_plugin_corpus_prepare_builds_source_plugins_without_emitting_project_output with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_prepare_builds_source_plugins_without_emitting_project_output =
  () => {
    const root = copyProject("go-source-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-prepare-");
    // The plugin cache is the case's own; the Go objects it builds from are
    // the suite's, which the case never reads.
    const env = {
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
      TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
    };

    const prepared = spawn(ttscBin, ["prepare", "--cwd", root], {
      cwd: root,
      env,
    });
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.match(prepared.stdout, /ttsc: prepared /);
    assert.match(prepared.stderr, /building source plugin "go-source-plugin"/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
    const pluginCache = path.join(cacheDir, "plugins");
    const binaries = pluginCacheEntryDirs(pluginCache).map((name) =>
      path.join(
        pluginCache,
        name,
        process.platform === "win32" ? "plugin.exe" : "plugin",
      ),
    );
    assert.equal(binaries.length, 1);
    const binary = binaries[0];
    assert.ok(binary);
    assert.equal(fs.existsSync(binary), true);

    const built = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
    assert.equal(built.status, 0, built.stderr);
    assert.doesNotMatch(built.stderr, /building source plugin/);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
  };
