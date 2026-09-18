import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { watchBrokerSource } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/watchBrokerSource.mjs";

/**
 * Verifies the watch broker's shared mode proves every stream swap live and
 * warns every registration a swap could have deafened (samchon/ttsc#1418).
 *
 * All of a loop's macOS directory watches share one FSEventStream, which libuv
 * re-creates whenever one opens or closes, and events in between are lost. So
 * on macOS the broker shares native watches, reports a registration ready only
 * once a probe proves the re-created stream live, and sends `gap` to every
 * registration that was live when a swap began. The protocol is the same on
 * every platform, so the shared mode is driven here directly, and the Windows
 * mode, which shares nothing, must send no gap.
 *
 * 1. Register a directory and assert an entry written right after `ready` is
 *    reported: the stream was live when `ready` came.
 * 2. Register the same directory again, and a reused lingering one, and assert no
 *    live registration is warned.
 * 3. Register a new directory and assert every registration live before it is
 *    warned, and the new one is not.
 * 4. Repeat the new-directory registration without sharing and assert no gap.
 */
export async function test_watch_broker_proves_every_swapped_stream_live(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-watch-broker-"),
  );
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  fs.mkdirSync(first);
  fs.mkdirSync(second);

  const shared = openBroker(true);
  try {
    const location = (directory: string) => [{ directory }];
    await shared.add(1, location(first));
    fs.writeFileSync(path.join(first, "after-ready.txt"), "x");
    await shared.until(
      (message) =>
        message.id === 1 &&
        message.directory === first &&
        message.filename === "after-ready.txt",
      "an entry written right after ready",
    );

    await shared.add(2, location(first));
    await shared.add(3, location(second));
    await shared.drain();
    assert.deepEqual(
      shared.gaps(),
      [1, 2],
      "a new native watch warns every registration live before it",
    );

    shared.remove(3);
    await shared.add(4, location(second));
    await shared.add(5, location(first));
    await shared.drain();
    assert.deepEqual(
      shared.gaps(),
      [1, 2],
      "reused watches, lingering or live, swap nothing",
    );
  } finally {
    shared.close();
  }

  const unshared = openBroker(false);
  try {
    await unshared.add(1, [{ directory: first }]);
    await unshared.add(2, [{ directory: second }]);
    await unshared.drain();
    assert.deepEqual(unshared.gaps(), [], "unshared watches lose nothing");
  } finally {
    unshared.close();
  }
}

/** Message the broker child sends back. */
interface BrokerMessage {
  directory?: string;
  drained?: boolean;
  failed?: boolean;
  filename?: string | null;
  gap?: boolean;
  id?: number;
  ready?: boolean;
}

/** Spawn one broker child and drive its IPC protocol. */
function openBroker(shared: boolean) {
  const child: ChildProcess = spawn(
    process.execPath,
    ["-e", watchBrokerSource(shared)],
    { stdio: ["ignore", "ignore", "ignore", "ipc"] },
  );
  const messages: BrokerMessage[] = [];
  const waiters = new Set<() => void>();
  child.on("message", (message: BrokerMessage) => {
    messages.push(message);
    for (const wake of [...waiters]) wake();
  });
  let drains = 1_000;
  const until = (
    matches: (message: BrokerMessage) => boolean,
    label: string,
  ): Promise<BrokerMessage> =>
    new Promise((resolve, reject) => {
      const check = (): boolean => {
        const found = messages.find(matches);
        if (found === undefined) return false;
        clearTimeout(timer);
        waiters.delete(wake);
        resolve(found);
        return true;
      };
      const wake = (): void => {
        check();
      };
      const timer = setTimeout(() => {
        waiters.delete(wake);
        reject(new Error(`timed out waiting for ${label}`));
      }, 20_000);
      if (!check()) waiters.add(wake);
    });
  return {
    add: async (
      id: number,
      locations: { directory: string; recursive?: boolean }[],
    ): Promise<void> => {
      child.send({ allEvents: true, id, locations, op: "add" });
      const ready = await until(
        (message) => message.id === id && message.ready === true,
        `registration ${id} to be ready`,
      );
      assert.equal(ready.failed, false, `registration ${id} opens`);
    },
    close: () => {
      if (child.connected) child.disconnect();
      child.kill();
    },
    drain: async (): Promise<void> => {
      const id = ++drains;
      child.send({ id, op: "drain" });
      await until(
        (message) => message.id === id && message.drained === true,
        "a drain",
      );
    },
    gaps: (): number[] =>
      messages
        .filter((message) => message.gap === true)
        .map((message) => message.id!)
        .sort((left, right) => left - right),
    remove: (id: number): void => {
      child.send({ id, op: "remove" });
    },
    until,
  };
}
