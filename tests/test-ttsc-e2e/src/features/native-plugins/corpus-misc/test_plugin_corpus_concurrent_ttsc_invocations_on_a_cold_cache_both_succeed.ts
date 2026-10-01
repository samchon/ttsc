import { TestProject } from "@ttsc/testing";

import { SHARED_GO_BUILD_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  child_process,
  copyProject,
  fs,
  goPath,
  nativeBinary,
  os,
  path,
  spawn,
  tsgoBinary,
  ttscBin,
} from "../../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: concurrent ttsc invocations on a cold cache both
 * succeed.
 *
 * The source-plugin build path writes to a shared content-addressed cache using
 * a scratch-then-rename strategy. Two simultaneous cold builds must not corrupt
 * each other — one may win the rename race while the other detects the
 * completed entry and proceeds without rebuilding.
 *
 * 1. Copy the `go-source-plugin` fixture to two independent temp directories and
 *    point both at the same empty cache directory.
 * 2. Launch both ttsc processes simultaneously via `child_process.spawn` and await
 *    their completion in parallel.
 * 3. Assert both processes exit zero and each emits `"PLUGIN"` in its JS output.
 *
 * @evidence contracts/testing.md#behavioral-verification Two concurrent ttsc --emit children sharing an empty plugin cache both exit zero and emit PLUGIN.
 * @evidence contracts/testing.md#independent-expectations The copied fixture transforms the literal plugin to PLUGIN; each independent output must carry that literal.
 * @evidence contracts/testing.md#distinguishing-cases Two distinct consumer roots contend for one cold content key; warm sequential reuse is owned by prepare and cache reuse cases.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The actual ttsc/ttsx launcher connects package or descriptor discovery to the native/check host and compiler output. This case's fixture messages, status or emitted effects distinguish lost delivery at that connection; direct rule calls do not exercise launcher assembly.
 * @evidence contracts/e2e.md#shared-execution Two consumer projects share one intentionally empty plugin cache and the suite Go object cache. Two simultaneous child lifetimes are necessary to observe publication contention; both results and both outputs remain distinct.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage Two concurrent ttsc --emit children sharing an empty plugin cache both exit zero and emit PLUGIN. These assertions stay in test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed =
  async () => {
    const rootA = copyProject("go-source-plugin");
    const rootB = copyProject("go-source-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-race-");
    // The plugin cache both runs race on is cold; the Go objects they build
    // from are the suite's, which the case never reads.
    const env = {
      ...process.env,
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
      TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
      TTSC_BINARY: nativeBinary,
      TTSC_TSGO_BINARY: tsgoBinary,
    };

    function launch(root: string): Promise<{
      root: string;
      status: number | null;
      stdout: string;
      stderr: string;
    }> {
      return new Promise((resolve, reject) => {
        const child = child_process.spawn(
          process.execPath,
          [ttscBin, "--cwd", root, "--emit"],
          {
            cwd: root,
            env,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
          },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (status) =>
          resolve({ status, stdout, stderr, root }),
        );
      });
    }

    const [a, b] = await Promise.all([launch(rootA), launch(rootB)]);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.match(
      fs.readFileSync(path.join(rootA, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
    assert.match(
      fs.readFileSync(path.join(rootB, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
  };
