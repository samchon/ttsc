import { TestProject } from "@ttsc/testing";

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
} from "../../internal/plugin-corpus";

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
 */
export const test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed =
  async () => {
    const rootA = copyProject("go-source-plugin");
    const rootB = copyProject("go-source-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-race-");
    const env = {
      ...process.env,
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
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
