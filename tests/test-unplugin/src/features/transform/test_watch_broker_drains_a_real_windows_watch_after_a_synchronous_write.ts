import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { watchBrokerSource } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/watchBrokerSource.mjs";

/**
 * Verifies a real Windows directory watch in the broker delivers a synchronous
 * write before the drain that follows it is answered, every time
 * (samchon/ttsc#1272, samchon/ttsc#1428).
 *
 * On Windows the broker answers a drain after two turns of its loop, on the
 * ground that the kernel queues a directory change's completion when the write
 * is recorded, before the write returns, and the completion port hands
 * completions out in the order they were queued, so the change's callback runs
 * before the drain message's. That is a claim about the kernel, not about time,
 * and this scenario measures it on the real backend, many times in a row, since
 * a single pass proves nothing about an ordering. It runs on Windows only.
 *
 * 1. Register a recursive watch on a directory and await ready.
 * 2. Two hundred times: write a new file below it and ask for a drain at once, and
 *    assert the file's event was received before the drain's answer.
 */
export async function test_watch_broker_drains_a_real_windows_watch_after_a_synchronous_write(): Promise<void> {
  if (process.platform !== "win32") return;
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-windows-drain-"),
  );
  const watched = path.join(root, "src");
  fs.mkdirSync(watched);
  const child = spawn(process.execPath, ["-e", watchBrokerSource()], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const messages: {
    drained?: boolean;
    filename?: string | null;
    id?: number;
    ready?: boolean;
  }[] = [];
  child.on("message", (message: (typeof messages)[number]) => {
    messages.push(message);
  });
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
        child.off("message", check);
        resolve();
      };
      child.on("message", check);
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
    for (let round = 0; round < 200; round++) {
      const name = `write-${round}.ts`;
      const drainId = 100 + round;
      fs.writeFileSync(path.join(watched, name), "export {};\n");
      const drained = until(
        (message) => message.id === drainId && message.drained === true,
        `drain ${round}`,
      );
      child.send({ id: drainId, op: "drain" });
      await drained;
      const answered = messages.findIndex(
        (message) => message.id === drainId && message.drained === true,
      );
      const heard = messages.findIndex(
        (message) => message.id === 1 && message.filename === name,
      );
      assert.ok(heard !== -1, `round ${round}: the write is delivered`);
      assert.ok(
        heard < answered,
        `round ${round}: the write is delivered before the drain that followed it is answered`,
      );
    }
  } finally {
    if (child.connected) child.disconnect();
    child.kill();
  }
}
