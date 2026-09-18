import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies `withTtsc` opens the transform session Turbopack's workers inherit,
 * outside the project, and that the session ends with its process
 * (samchon/ttsc#1390).
 *
 * Turbopack forks its loader workers from the process that read the Next
 * config, and they share each compile through the session store that process
 * opened. The store must never land in the project, must go away when the
 * session's process exits, and one left by a process that died must go away the
 * next time a session opens.
 *
 * 1. In a child process, plant a store owned by a process that does not exist,
 *    call the wrapper, and spawn a worker from it.
 * 2. Assert the child's store existed outside the project, the worker inherited
 *    it, and the dead process's store was removed.
 * 3. Assert the child's store was removed when it exited.
 */
export async function test_next_adapter_opens_a_session_its_workers_inherit(): Promise<void> {
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
      env: { ...process.env, TTSC_UNPLUGIN_TRANSFORM_SESSION: "" },
      windowsHide: true,
    }).toString(),
  ) as { exists: boolean; inherited: string; orphan: boolean; store: string };

  assert.ok(path.isAbsolute(report.store), report.store);
  assert.ok(report.exists, "the store exists while its process runs");
  assert.equal(report.inherited, report.store, "a forked worker inherits it");
  const relative = path.relative(process.cwd(), report.store);
  assert.ok(
    relative.startsWith("..") || path.isAbsolute(relative),
    "the store lives outside the project",
  );
  assert.equal(report.orphan, false, "a dead process's store is removed");
  assert.equal(
    fs.existsSync(report.store),
    false,
    "the store is removed when its process exits",
  );
}
