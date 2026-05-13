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
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed =
  async () => {
    const rootA = copyProject("go-source-plugin");
    const rootB = copyProject("go-source-plugin");
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-source-plugin-race-"),
    );
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
