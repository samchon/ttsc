import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { fseventsBindingPath } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/fseventsBindingPath.mjs";
import { watchBrokerSource } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/watchBrokerSource.mjs";

/**
 * Verifies a real FSEvents system flag reaches the registration as a gap
 * through the `fsevents` binding (samchon/ttsc#1425).
 *
 * On macOS, `fs.watch` lost events without notice, since libuv discards every
 * FSEvents event that carries a system flag, dropped events among them. A
 * dropped-events notice cannot be provoked on demand, but a changed root
 * travels the same path: the binding opens each stream with `WatchRoot`, and
 * moving the watched directory makes FSEvents deliver `RootChanged`. The
 * scenario runs on macOS only, where the binding exists.
 *
 * 1. Start the broker with the installed binding, and register a directory.
 * 2. Move the directory away, and assert the registration receives a gap.
 *
 * @evidence contracts/testing.md#behavioral-verification Spawns watchBrokerSource with installed fsevents, waits for readiness, renames the watched root and asserts a gap reaches registration 1 through actual binding IPC.
 * @evidence contracts/testing.md#independent-expectations FSEvents RootChanged is a real system flag and must invalidate silent-watch authority. The deliberate directory move provides an external cause for the expected gap; it is a transport proxy for dropped flags, not an induced overflow.
 * @evidence contracts/testing.md#distinguishing-cases Owns one ready stream followed by an actual root identity change. Scripted dropped/root/outside flags and absent binding counterexamples execute in the transferred macOS drop unit entry.
 * @evidence contracts/testing.md#execution-ownership macOS E2E entry owns the binding-backed broker process and root rename; other platforms return. TestExecutor discovers this named feature and the binding-presence assertion prevents silently falling back.
 * @evidence contracts/e2e.md#necessary-boundary Actual system flags must survive the installed binding and broker IPC rather than libuv discarding them. Moving the root makes that native transport observable without attempting an unreliable queue overflow.
 * @evidence contracts/e2e.md#shared-execution One child/root registration combines readiness and root-change transport. Shared package/binding installation supplies the producer; no compiler build or second process is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The watched directory belongs to a unique parent and the gap wait is armed before rename. Finally disconnects/kills the child and TestProject removes both original/moved paths at worker exit; timed-out wait listeners remain until teardown.
 * @evidence contracts/e2e.md#preserved-coverage The readiness-to-rename gap assertion remains unchanged. Scripted flag-kind and missing-binding semantics retain their unit owner, while genuine dropped-event generation remains untested and is not inferred from the root-change proxy.
 */
export async function test_watch_broker_reports_a_real_macos_root_change_as_a_gap(): Promise<void> {
  if (process.platform !== "darwin") return;
  const binding = fseventsBindingPath();
  assert.notEqual(binding, null, "the fsevents binding is installed on macOS");
  const parent = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-root-change-"),
  );
  const watched = path.join(parent, "watched");
  fs.mkdirSync(watched);
  const child = spawn(process.execPath, ["-e", watchBrokerSource(binding)], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const messages: { gap?: boolean; id?: number; ready?: boolean }[] = [];
  const until = (
    matches: (message: (typeof messages)[number]) => boolean,
    label: string,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for ${label}`)),
        20_000,
      );
      const check = (): void => {
        if (!messages.some(matches)) return;
        clearTimeout(timer);
        child.off("message", receive);
        resolve();
      };
      const receive = (message: (typeof messages)[number]): void => {
        messages.push(message);
        check();
      };
      child.on("message", receive);
      check();
    });
  try {
    const ready = until(
      (message) => message.id === 1 && message.ready === true,
      "the registration to be ready",
    );
    child.send({
      allEvents: true,
      id: 1,
      locations: [{ directory: watched, recursive: true }],
      op: "add",
    });
    await ready;
    const gap = until(
      (message) => message.id === 1 && message.gap === true,
      "a gap for the moved root",
    );
    await TestProject.rename(watched, path.join(parent, "moved"));
    await gap;
  } finally {
    if (child.connected) child.disconnect();
    child.kill();
  }
}
