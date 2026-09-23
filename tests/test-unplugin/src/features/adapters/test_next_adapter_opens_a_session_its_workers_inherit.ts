import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { pathIsWithin } from "../../../../../packages/unplugin/lib/core/transform/filesystem/pathIsWithin.mjs";

/**
 * Verifies `withTtsc` opens the transform session Turbopack's workers inherit,
 * outside the project, and that its store outlives the process for the next
 * session to adopt from (samchon/ttsc#1390, samchon/ttsc#1483).
 *
 * Turbopack forks its loader workers from the process that read the Next
 * config, and they share each compile through the session store that process
 * opened. The store must never land in the project. It used to go away when the
 * session's process exited, which left every restart of the dev server
 * compiling each project once; it is kept now, while a per-process store an
 * earlier version left behind in a crash must still go away the next time a
 * session opens.
 *
 * 1. In a child process with a temporary directory of its own, plant a store owned
 *    by a process that does not exist, call the wrapper, and spawn a worker
 *    from it.
 * 2. Assert the child's store existed outside the project, the worker inherited
 *    it, and the dead process's store was removed.
 * 3. Assert the child's store is still there after it exited.
 */
export async function test_next_adapter_opens_a_session_its_workers_inherit(): Promise<void> {
  // In its long spelling, which the store is resolved to.
  const temporary = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-next-session-root-"),
  );
  const script = [
    'const fs = await import("node:fs");',
    'const os = await import("node:os");',
    'const path = await import("node:path");',
    'const { execFileSync } = await import("node:child_process");',
    "const user = process.getuid?.();",
    'const root = path.join(os.tmpdir(), `ttsc-unplugin-sessions${user === undefined ? "" : `-${user}`}`);',
    "fs.mkdirSync(root, { mode: 0o700, recursive: true });",
    'const orphan = path.join(root, "2147483646-orphan");',
    "fs.mkdirSync(orphan, { recursive: true });",
    `const next = (await import(${JSON.stringify(TestUnpluginRuntime.libUrl("next"))})).default;`,
    "next({});",
    "const store = process.env.TTSC_UNPLUGIN_TRANSFORM_SESSION;",
    'const inherited = execFileSync(process.execPath, ["-e", "process.stdout.write(process.env.TTSC_UNPLUGIN_TRANSFORM_SESSION ?? \'\')"]).toString();',
    "process.stdout.write(JSON.stringify({ exists: fs.existsSync(store), inherited, orphan: fs.existsSync(orphan), store }));",
  ].join("\n");
  const report = JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TEMP: temporary,
        TMP: temporary,
        TMPDIR: temporary,
        TTSC_UNPLUGIN_TRANSFORM_SESSION: "",
      },
      windowsHide: true,
    }).toString(),
  ) as { exists: boolean; inherited: string; orphan: boolean; store: string };

  assert.ok(path.isAbsolute(report.store), report.store);
  assert.ok(report.exists, "the store exists while its process runs");
  assert.equal(report.inherited, report.store, "a forked worker inherits it");
  assert.ok(
    !pathIsWithin(report.store, process.cwd()),
    "the store lives outside the project",
  );
  assert.ok(
    pathIsWithin(report.store, temporary),
    "below the temporary directory",
  );
  assert.equal(report.orphan, false, "a dead process's store is removed");
  assert.equal(
    fs.existsSync(report.store),
    true,
    "the store outlives its process",
  );
}
