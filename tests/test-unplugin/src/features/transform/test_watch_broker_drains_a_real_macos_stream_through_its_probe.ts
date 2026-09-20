import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { fseventsBindingPath } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/fseventsBindingPath.mjs";
import { watchBrokerSource } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/watchBrokerSource.mjs";

/**
 * Verifies a real FSEvents stream, through the `fsevents` binding, delivers a
 * synchronous write before the drain that follows it is answered, and delivers
 * nothing written before the stream was proven open (samchon/ttsc#1453,
 * samchon/ttsc#1454).
 *
 * FSEvents delivers with a latency and logs a write a moment after it returns,
 * so a stream opened right after a write still delivers that write, and a drain
 * answered after a turn of the loop preceded the events it was meant to prove.
 * FSEvents preserves order within one stream, which is what the probes rely on:
 * the answer to a drain, and the ready of a registration, come only after a
 * probe written at that moment came back through the stream, so everything
 * written before that moment has been delivered by then. The scenario measures
 * both on the installed binding; it runs on macOS only.
 *
 * 1. Write a file below a location, then register the location with a probe
 *    directory below the same root, and await ready.
 * 2. Ask for a drain and assert it is answered with nothing unproven and no event
 *    for the file written before the registration: the ready came after the
 *    opening probe, which came after that write.
 * 3. Write a file below the location and ask for a drain at once, and assert the
 *    file's event was received before the drain's answer.
 */
export async function test_watch_broker_drains_a_real_macos_stream_through_its_probe(): Promise<void> {
  if (process.platform !== "darwin") return;
  const binding = fseventsBindingPath();
  assert.notEqual(binding, null, "the fsevents binding is installed on macOS");
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-probe-drain-"),
  );
  const watched = path.join(root, "src");
  fs.mkdirSync(watched);
  const child = spawn(process.execPath, ["-e", watchBrokerSource(binding)], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const messages: {
    drained?: boolean;
    filename?: string | null;
    id?: number;
    ready?: boolean;
    unproven?: unknown;
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
    fs.writeFileSync(path.join(watched, "before.ts"), "export {};\n");
    const ready = until(
      (message) => message.id === 1 && message.ready === true,
      "the registration to be ready",
    );
    child.send({
      allEvents: true,
      id: 1,
      locations: [
        {
          directory: watched,
          probe: {
            directory: path.join(root, "node_modules", ".cache", "probes"),
            root,
          },
        },
      ],
      op: "add",
    });
    await ready;

    const first = until(
      (message) => message.id === 10 && message.drained === true,
      "the first drain",
    );
    child.send({ id: 10, op: "drain" });
    await first;
    assert.deepEqual(
      messages.filter((message) => message.filename !== undefined),
      [],
      "a write before the registration is the past, not an event",
    );
    assert.deepEqual(
      messages.find((message) => message.id === 10)?.unproven,
      [],
      "a probed stream is proven",
    );

    fs.writeFileSync(path.join(watched, "after.ts"), "export {};\n");
    const second = until(
      (message) => message.id === 11 && message.drained === true,
      "the second drain",
    );
    child.send({ id: 11, op: "drain" });
    await second;
    const drained = messages.findIndex(
      (message) => message.id === 11 && message.drained === true,
    );
    const event = messages.findIndex(
      (message) => message.id === 1 && message.filename === "after.ts",
    );
    assert.ok(event !== -1, "the write is delivered");
    assert.ok(
      event < drained,
      "the write is delivered before the drain that followed it is answered",
    );
  } finally {
    if (child.connected) child.disconnect();
    child.kill();
  }
}
