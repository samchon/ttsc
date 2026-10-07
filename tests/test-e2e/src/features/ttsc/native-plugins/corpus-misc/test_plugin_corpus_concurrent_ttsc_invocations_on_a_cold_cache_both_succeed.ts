import { TestProject } from "@ttsc/testing";

import { SHARED_GO_BUILD_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
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
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: concurrent ttsc invocations on a cold cache both
 * succeed.
 *
 * The source-plugin build path writes to a shared content-addressed cache using
 * a scratch-then-rename strategy. Two simultaneous cold builds must not corrupt
 * each other — the original outputs alone do not identify the winning builder
 * or prove avoided rebuilding. The runtime cache publication population is
 * additionally required to contain one content-key entry.
 *
 * 1. Copy the `go-source-plugin` fixture to two independent temp directories and
 *    point both at the same empty cache directory.
 * 2. Launch both ttsc processes simultaneously via `child_process.spawn` and await
 *    their completion in parallel.
 * 3. Assert both processes exit zero and each emits `"PLUGIN"` in its JS output.
 *
 * @evidence contracts/testing.md#behavioral-verification Two concurrent ttsc --emit children sharing an empty plugin cache both exit zero and emit PLUGIN.
 * @evidence contracts/testing.md#independent-expectations The copied fixture transforms the literal plugin to PLUGIN; each independent output must carry that literal.
 * @evidence contracts/testing.md#distinguishing-cases Two copied consumers share an explicitly empty cache, and one published content-key entry is required after their joined results. Copy paths differ but the key frames source digests rather than directory spellings; actual selected toolchain/environment equivalence is still a preparation premise.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The actual ttsc/ttsx launcher connects package or descriptor discovery to the native/check host and compiler output. This case's fixture messages, status or emitted effects distinguish lost delivery at that connection; direct rule calls do not exercise launcher assembly.
 * @evidence contracts/e2e.md#shared-execution Two consumer projects share one verified empty plugin cache and the suite Go-cache location. Both launcher requests are started before allSettled joins; successful overlap at the publication lock, object-cache hits, avoided builds and total downstream processes are not measured. Both direct child results and outputs remain independently checked.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state. Error events are retained until actual direct-child close, both launch Promises settle before output checks and each failure remains named. This does not certify arbitrary descendants or loaded images.
 * @evidence contracts/e2e.md#preserved-coverage Two concurrent ttsc --emit children sharing an empty plugin cache both exit zero and emit PLUGIN. These assertions stay in test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed =
  async () => {
    const rootA = copyProject("go-source-plugin");
    const rootB = copyProject("go-source-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-race-");
    assert.deepEqual(
      fs.readdirSync(cacheDir),
      [],
      "the private plugin cache starts empty",
    );
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
      signal: NodeJS.Signals | null;
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
        let failure: Error | undefined;
        child.on("error", (error) => {
          failure = error;
        });
        child.on("close", (status, signal) => {
          if (failure !== undefined) reject(failure);
          else resolve({ status, signal, stdout, stderr, root });
        });
      });
    }

    const results = await Promise.allSettled([launch(rootA), launch(rootB)]);
    const failures: unknown[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") {
        failures.push(
          new Error(`Concurrent consumer ${index} failed`, {
            cause: result.reason,
          }),
        );
        continue;
      }
      try {
        assert.equal(result.value.signal, null, result.value.stderr);
        assert.equal(result.value.status, 0, result.value.stderr);
        assert.match(
          fs.readFileSync(
            path.join(result.value.root, "dist", "main.js"),
            "utf8",
          ),
          /"PLUGIN"/,
        );
      } catch (error) {
        failures.push(
          new Error(`Concurrent consumer ${index} output failed`, {
            cause: error,
          }),
        );
      }
    }
    try {
      const entries = fs
        .readdirSync(path.join(cacheDir, "plugins"), { withFileTypes: true })
        .filter(
          (entry) => entry.isDirectory() && /^[0-9a-f]{32}$/.test(entry.name),
        );
      assert.equal(
        entries.length,
        1,
        "both copied inputs publish one content key",
      );
      assert.ok(
        fs.existsSync(
          path.join(
            cacheDir,
            "plugins",
            entries[0]!.name,
            process.platform === "win32" ? "plugin.exe" : "plugin",
          ),
        ),
      );
    } catch (error) {
      failures.push(error);
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(
        failures,
        "Concurrent plugin publication failed",
      );
  };
