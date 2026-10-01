import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the shared compile store a pooled session opens outlives the process
 * that opened it, so a restarted dev server's workers find what the last one
 * compiled (samchon/ttsc#1483).
 *
 * Turbopack runs the loader for every module after a restart, in fresh workers
 * with nothing in memory, and the store used to be a directory per process,
 * removed when it exited: every restart compiled each project once, however
 * valid Turbopack's own cache was. The store is now one directory per user,
 * kept across processes, while the per-process stores an earlier version left
 * behind in a crash are still removed.
 *
 * 1. Leave a per-process store of a dead process, and one of this live process,
 *    below the per-user root of a private temporary directory.
 * 2. Open the session in two processes, one after the other, and assert both name
 *    the same store, which still exists after both exited, with no permission
 *    for anyone but its owner where the platform has owners.
 * 3. Assert the dead process's store is gone and the live one's is kept.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs openTtscTransformSession in two sequential Node processes and inspects real store files; asserts the same persistent directory, post-exit existence, owner-only permissions where supported, dead legacy cleanup and preservation of live/foreign directories.
 * @evidence contracts/testing.md#independent-expectations A restarted session must name the same per-user store while reclaiming only recognized terminated legacy owners. Literal equality/existence and OS mode bits specify that lifetime contract independently of directory naming logic.
 * @evidence contracts/testing.md#distinguishing-cases Owns repeated fresh processes with no inherited session variable, persistent versus legacy paths, dead/live/foreign legacy names and POSIX permission bits. It does not exercise adoption of a compiled publication.
 * @evidence contracts/testing.md#execution-ownership E2E entry owns two API subprocesses plus one short-lived PID fixture and discovers through src/features/transform; all commands are synchronous and no native compiler/plugin is built.
 * @evidence contracts/e2e.md#necessary-boundary Cross-process environment initialization, persistence after creator exit and OS-owner permissions cannot be established by an in-memory session unit. This API boundary complements Next worker inheritance without starting another bundler host.
 * @evidence contracts/e2e.md#shared-execution One private per-user root serves both API processes and all legacy fixtures. A second fresh process is necessary to distinguish persistence from process-local reuse; built package preparation and installation are shared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Child environments point TEMP/TMP/TMPDIR to the owned root and clear TTSC_UNPLUGIN_TRANSFORM_SESSION. Children finish before assertions, and TestProject removes the root at worker exit; live and foreign directories remain only within that owned fixture.
 * @evidence contracts/e2e.md#preserved-coverage All existing same-store, owner-mode, dead/live/foreign and post-exit assertions remain in this process batch. Store publication/adoption contents are tested by shared-claim owners, not inferred from directory existence.
 */
export async function test_transform_session_store_outlives_its_process(): Promise<void> {
  const temporary = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-session-root-"),
  );
  const user = process.getuid?.();
  const root = path.join(
    temporary,
    `ttsc-unplugin-sessions${user === undefined ? "" : `-${user}`}`,
  );
  fs.mkdirSync(root, { mode: 0o700, recursive: true });
  const dead = spawnSync(process.execPath, ["-e", ""]).pid;
  const crashed = path.join(root, `${dead}-abc123`);
  const running = path.join(root, `${process.pid}-abc456`);
  fs.mkdirSync(crashed);
  fs.mkdirSync(running);
  const unowned = path.join(root, `${dead}-unrecognized`);
  fs.mkdirSync(unowned);

  const open = (): string => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TEMP: temporary,
      TMP: temporary,
      TMPDIR: temporary,
    };
    delete env.TTSC_UNPLUGIN_TRANSFORM_SESSION;
    const opened = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          `const api = await import(${JSON.stringify(TestUnpluginRuntime.libUrl("api"))});`,
          "process.stdout.write(String(api.openTtscTransformSession()));",
        ].join("\n"),
      ],
      { encoding: "utf8", env, windowsHide: true },
    );
    assert.equal(opened.status, 0, opened.stderr);
    return opened.stdout;
  };
  const first = open();
  const second = open();
  assert.equal(path.dirname(first), root, "below the per-user root");
  assert.equal(second, first, "one store across processes");
  assert.equal(fs.statSync(first).isDirectory(), true, "kept after exit");
  if (user !== undefined) {
    assert.equal(fs.statSync(first).mode & 0o077, 0, "owner-only");
  }
  assert.equal(fs.existsSync(crashed), false, "a crashed process's store");
  assert.equal(fs.existsSync(running), true, "a live process's store");
  assert.equal(fs.existsSync(unowned), true, "a foreign directory is not a legacy store");
}
