import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { createInterface } from "node:readline";

import { probeLocalProcess } from "../../../../../packages/ttsc/src/internal/probeLocalProcess";
import { isLocalProcessGone } from "../../../../../packages/ttsc/src/launcher/internal/runtime/isLocalProcessGone";
import { PluginBuildLockOwner } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildLockOwner";

/**
 * Verifies the owner-liveness probes count an exited process its parent never
 * collected as gone, and still count a running one alive.
 *
 * Signal zero reaches a zombie. Under a parent that never collects, such as a
 * container's PID 1 that is not an init, a ttsx run directory or plugin build
 * lock owned by a killed process was never reclaimed (samchon/ttsc#1733).
 *
 * 1. Probe this running process: present, and not gone, everywhere.
 * 2. On Linux, start a shell that forks a short child and then replaces itself
 *    with `sleep`, which never collects it, and wait until the kernel reports
 *    that child a zombie.
 * 3. Assert every probe reports the zombie gone and the sleeping parent alive.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual probes run against real processes: the current one, a kernel-reported zombie and its live parent.
 * @evidence contracts/testing.md#independent-expectations The kernel's own /proc state, read here independently, establishes the zombie before the probes are asked; the shell's live sleep is the presence control.
 * @evidence contracts/testing.md#distinguishing-cases An uncollected zombie and live processes are separate rows; the unchanged ESRCH and remote-host decisions keep their existing owners.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this export; it calls the three source owners in process and spawns only the shell and sleep it joins.
 */
export async function test_local_process_probe_counts_an_uncollected_zombie_as_exited(): Promise<void> {
  const hostname = os.hostname();
  assert.deepEqual(probeLocalProcess(process.pid), { result: "present" });
  assert.equal(isLocalProcessGone({ pid: process.pid, hostname }), false);
  assert.equal(
    PluginBuildLockOwner.gone({ pid: process.pid, hostname }),
    false,
  );
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

    assert.equal(probeLocalProcess(zombie).result, "absent");
    assert.equal(isLocalProcessGone({ pid: zombie, hostname }), true);
    assert.equal(PluginBuildLockOwner.gone({ pid: zombie, hostname }), true);
    assert.equal(probeLocalProcess(parent.pid!).result, "present");
    assert.equal(isLocalProcessGone({ pid: parent.pid!, hostname }), false);
    assert.equal(
      PluginBuildLockOwner.gone({ pid: parent.pid!, hostname }),
      false,
    );
  } finally {
    parent.kill("SIGKILL");
    await closed;
  }
}
