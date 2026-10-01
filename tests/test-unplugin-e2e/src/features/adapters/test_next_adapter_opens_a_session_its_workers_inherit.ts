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
 * @evidence contracts/testing.md#behavioral-verification
 *   Executes built withTtsc in a child, then a real worker child reads its
 *   inherited session variable. Asserts the absolute store exists outside the
 *   project, under the owned temp root, removes an independently dead owner,
 *   and remains after the creating process exits.
 * @evidence contracts/testing.md#independent-expectations
 *   A child inherits its parent's environment; a persistent transform session
 *   must outlive that process while dead transient owners are reclaimed. The
 *   fixture confirms ESRCH before planting the orphan, independently of cleanup.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Contrasts a live newly opened persistent store with a known-dead transient
 *   store, project versus temporary location, and same-value worker inheritance
 *   versus an absent or different variable. Post-exit existence checks lifetime.
 * @evidence contracts/testing.md#execution-ownership
 *   This exported E2E entry owns two synchronous child processes and temporary
 *   filesystem state. It does not compile a plugin; TestProject owns directory
 *   cleanup, and both processes have exited before final lifetime assertions.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Actual process environment inheritance and post-exit filesystem lifetime
 *   cannot be established by direct option-unit calls. This narrow boundary
 *   complements packed Next worker delivery without starting another Next host.
 * @evidence contracts/e2e.md#shared-execution
 *   One wrapper process and one worker probe jointly verify opening, cleanup,
 *   inheritance and lifetime. No install or native producer is repeated; the
 *   already built adapter is the producer shared by this feature population.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   TEMP, TMP and TMPDIR select an owned root and the session variable is cleared
 *   in the child environment. The fixture verifies the orphan PID is dead before
 *   creation, and synchronous execution prevents inspecting an unfinished child.
 * @evidence contracts/e2e.md#preserved-coverage
 *   All existing location, live existence, worker inheritance, dead-owner
 *   removal and post-exit assertions remain in this same two-process batch.
 *   The dead-PID precondition strengthens the fixture without removing a case.
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
    "try { process.kill(2147483646, 0); throw new Error('orphan fixture PID is alive'); } catch (error) { if (error.code !== 'ESRCH') throw error; }",
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
