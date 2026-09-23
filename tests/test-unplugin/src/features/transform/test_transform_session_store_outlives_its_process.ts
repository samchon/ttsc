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
  const crashed = path.join(root, `${dead}-left`);
  const running = path.join(root, `${process.pid}-running`);
  fs.mkdirSync(crashed);
  fs.mkdirSync(running);

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
}
