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
    fs.renameSync(watched, path.join(parent, "moved"));
    await gap;
  } finally {
    if (child.connected) child.disconnect();
    child.kill();
  }
}
