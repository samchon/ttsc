import { TestProject } from "@ttsc/testing";

import { SHARED_GO_BUILD_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: relative cache dir resolves from cwd option.
 *
 * When `--cache-dir` is a relative path it must be anchored at `--cwd` (the
 * TypeScript project root), not at the process working directory from which
 * ttsc was launched. Build tools and monorepo scripts commonly differ in their
 * working directories, so anchoring at `--cwd` keeps the cache co-located with
 * the project regardless of how the process is invoked.
 *
 * 1. Copy the `go-source-plugin` fixture and create a separate `driverCwd` dir.
 * 2. Run ttsc with `--cwd <root> --cache-dir relative-cache` from `driverCwd`.
 * 3. Assert zero exit, the cache appears under `<root>/relative-cache/plugins`,
 *    and does NOT appear under `<driverCwd>/relative-cache/plugins`.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --emit anchors relative-cache at --cwd, builds there, and leaves the distinct process working directory without that cache.
 * @evidence contracts/testing.md#independent-expectations Relative cache options belong to the selected project root; the two roots are deliberately distinct.
 * @evidence contracts/testing.md#distinguishing-cases Project cwd differs from driver cwd, with both positive and negative cache locations asserted.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary A real launcher invoked from a distinct driver cwd passes project-relative cache selection to native source preparation. The positive project cache and absent driver cache prove invocation context survives across that connection.
 * @evidence contracts/e2e.md#shared-execution The suite reuses built workspace packages and the shared content-addressed producer cache when this case selects it. Separate launcher invocations carry this case's differing arguments or selected runtime entry; a case-local cold cache is retained when preparation or failure is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --emit anchors relative-cache at --cwd, builds there, and leaves the distinct process working directory without that cache. These assertions stay in test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option =
  () => {
    const root = copyProject("go-source-plugin");
    const driverCwd = TestProject.tmpdir("ttsc-driver-");
    const cacheDir = "relative-cache";

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--cache-dir", cacheDir],
      {
        cwd: driverCwd,
        // The Go objects are the suite's; the case observes the plugin cache.
        env: { PATH: goPath(), TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /building source plugin "go-source-plugin"/);
    assert.equal(fs.existsSync(path.join(root, cacheDir, "plugins")), true);
    assert.equal(
      fs.existsSync(path.join(driverCwd, cacheDir, "plugins")),
      false,
    );
  };
