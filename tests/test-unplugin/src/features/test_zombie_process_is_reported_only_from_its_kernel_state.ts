import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createInterface } from "node:readline";

import { isZombieProcess } from "../../../../packages/unplugin/src/core/transform/utils/isZombieProcess";

/**
 * Verifies the shared-compile, session and watch-probe owners recognize an
 * exited process its parent never collected, and never a running one.
 *
 * Signal zero reaches a zombie, so these owners counted it alive and never
 * reclaimed its locks or directories under a parent that never collects, such
 * as a container's PID 1 that is not an init (samchon/ttsc#1733).
 *
 * 1. Assert this running process is not a zombie on any platform.
 * 2. On Linux, start a shell that forks a short child and then replaces itself
 *    with `sleep`, which never collects it, and wait until the kernel reports
 *    that child a zombie.
 * 3. Assert the zombie is recognized and its sleeping parent is not.
 *
 * @evidence contracts/testing.md#behavioral-verification isZombieProcess runs against real processes: the current one, a kernel-reported zombie and its live parent.
 * @evidence contracts/testing.md#independent-expectations The kernel's /proc state, read here independently, establishes the zombie before the predicate is asked; the shell's live sleep is the control.
 * @evidence contracts/testing.md#distinguishing-cases A running process and an uncollected zombie are separate rows.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this export; it calls the predicate in process and spawns only the shell and sleep it joins.
 */
export async function test_zombie_process_is_reported_only_from_its_kernel_state(): Promise<void> {
  assert.equal(isZombieProcess(process.pid), false);
  if (process.platform !== "linux") return;

  const parent = spawn("sh", ["-c", "true & echo $!; exec sleep 60"], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const closed = new Promise<void>((resolve) => parent.once("close", resolve));
  try {
    const line = await new Promise<string>((resolve, reject) => {
      const reader = createInterface({ input: parent.stdout! });
      reader.once("line", (text) => {
        reader.close();
        // Keep draining so the pipe can end and the child can close.
        parent.stdout!.resume();
        resolve(text);
      });
      parent.once("error", reject);
    });
    const zombie = Number(line);
    assert.ok(Number.isSafeInteger(zombie) && zombie > 0, line);
    const state = (): string => {
      const stat = fs.readFileSync(`/proc/${zombie}/stat`, "utf8");
      return stat.charAt(stat.lastIndexOf(")") + 2);
    };
    const deadline = Date.now() + 10_000;
    while (state() !== "Z") {
      assert.ok(
        Date.now() < deadline,
        "the forked child never became a zombie",
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    process.kill(zombie, 0);

    assert.equal(isZombieProcess(zombie), true);
    assert.equal(isZombieProcess(parent.pid!), false);
  } finally {
    parent.kill("SIGKILL");
    await closed;
  }
}
