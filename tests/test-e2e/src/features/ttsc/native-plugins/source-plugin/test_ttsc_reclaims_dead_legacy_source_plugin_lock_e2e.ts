import { TestProject } from "@ttsc/testing";
import child_process from "node:child_process";
import os from "node:os";

import { goPath, spawn, ttscBin } from "../../../../internal/ttsc/internal/plugin-corpus";
import {
  assert,
  buildSourcePlugin,
  fs,
  path,
} from "../../../../internal/ttsc/internal/source-build";

/**
 * Verifies ttsc e2e: reclaims a dead legacy source-plugin owner.
 *
 * The hang report reached the CLI through package plugin discovery and then
 * stalled in the shared source-plugin cache. The lower-level lock test pins the
 * helper branch; this e2e keeps the launcher/loadProjectPlugins path honest by
 * running `ttsc -p tsconfig.json --noEmit` against the same abandoned lock.
 *
 * 1. Seed the exact source-plugin cache entry with a binary, then replace it with
 *    an old `.lock` directory whose same-host owner process has exited.
 * 2. Run the real local `ttsc` launcher with that cache directory.
 * 3. Assert the CLI exits successfully and reports reclaiming the abandoned lock
 *    instead of waiting for the ordinary admission budget.
 * @evidence contracts/testing.md#behavioral-verification The real ttsc noEmit launcher must discover the source plugin, reclaim its seeded dead legacy lock, build the missing binary and exit zero with both reclamation and build diagnostics.
 * @evidence contracts/testing.md#independent-expectations A successfully exited same-host child establishes the dead owner, explicit aged owner bytes establish legacy state, and independent CLI status plus named stderr messages distinguish successful recovery from merely accepting the configuration.
 * @evidence contracts/testing.md#distinguishing-cases The initially selected key is deliberately stripped of its binary and v3 history before an old legacy owner is created. This owns launcher/discovery-to-lock recovery, while direct fake-tool admission and pure owner policies have separate tests.
 * @evidence contracts/testing.md#execution-ownership This exported source-plugin entry copies the go-source-plugin consumer and invokes the real shipped CLI, native compiler and source-plugin builder; the seed builder also executes a real build.
 * @evidence contracts/e2e.md#necessary-boundary Package plugin discovery and CLI execution must actually reach the abandoned-key recovery path; direct lock inspection or builder calls cannot detect a launcher that bypasses or miskeys that connection.
 * @evidence contracts/e2e.md#shared-execution One copied consumer, source module and explicit cache are reused. The seed build currently obtains the exact binary-key path, then the binary is removed to require cold recovery; that extra seed payload cost is explicit and has not yet been replaced by a verified key-only producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private consumer/cache paths own the intentionally removed binary and lock histories, and PATH is restored in finally. The seed process exits synchronously before recording its PID, and the CLI spawn completes before assertions; no warm artifact may bypass the missing-binary premise.
 * @evidence contracts/e2e.md#preserved-coverage Exited-child success, zero CLI status and both named reclamation/build diagnostics remain unchanged. This entry does not independently inspect the rebuilt artifact contents, and the seed-build expense is not hidden by its contract.
 */
export const test_ttsc_reclaims_dead_legacy_source_plugin_lock_e2e = () => {
  const root = TestProject.copyProject("go-source-plugin");
  const plugin = path.join(root, "go-plugin");
  const cacheDir = path.join(root, "cache");
  const savedPath = process.env.PATH;
  process.env.PATH = goPath();
  try {
    const binary = buildSourcePlugin({
      baseDir: root,
      cacheDir,
      pluginName: "go-source-plugin",
      source: plugin,
      quiet: true,
      ttscVersion: readWorkspaceTtscVersion(),
      tsgoVersion: "unknown",
    });
    const lockDir = `${path.dirname(binary)}.lock`;
    fs.rmSync(binary, { force: true });
    fs.rmSync(lockDir, { force: true, recursive: true });
    fs.rmSync(`${lockDir}.v3`, { force: true, recursive: true });
    fs.mkdirSync(lockDir, { recursive: true });
    const exited = child_process.spawnSync(process.execPath, ["-e", ""], {
      windowsHide: true,
    });
    assert.equal(exited.status, 0);
    fs.writeFileSync(
      path.join(lockDir, "owner.json"),
      `${JSON.stringify({ hostname: os.hostname(), pid: exited.pid })}\n`,
      "utf8",
    );
    const old = new Date(Date.now() - 120_000);
    fs.utimesSync(lockDir, old, old);

    const result = spawn(ttscBin, ["-p", "tsconfig.json", "--noEmit"], {
      cwd: root,
      env: {
        TTSC_CACHE_DIR: cacheDir,
        PATH: process.env.PATH,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /reclaiming abandoned source plugin/);
    assert.match(result.stderr, /building source plugin "go-source-plugin"/);
  } finally {
    if (savedPath === undefined) delete process.env.PATH;
    else process.env.PATH = savedPath;
  }
};

function readWorkspaceTtscVersion(): string {
  const file = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "package.json",
  );
  const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
    version?: string;
  };
  return pkg.version ?? "0.0.0";
}
