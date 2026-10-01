import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { fseventsBindingPath } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/fseventsBindingPath.mjs";
import { watchBrokerSource } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/watchBrokerSource.mjs";

/**
 * Verifies the watch broker, on the platform's own backend, hears an entry
 * written right after it reports a registration ready (samchon/ttsc#1418,
 * samchon/ttsc#1425).
 *
 * A registration's `ready` is what lets a delivery trust the watch's silence
 * from then on. On macOS the broker watches through the `fsevents` binding, one
 * stream per watch, so a registration is ready once its streams have started,
 * and opening another watch disturbs none of them. libuv, which the broker used
 * before, re-created one shared stream whenever a watch opened or closed.
 *
 * 1. Resolve the platform's backend, and on macOS assert the binding is installed,
 *    since without it every macOS registration is failed.
 * 2. Register a directory, and a second one over the same directory, and write an
 *    entry at once; assert both registrations report it.
 * 3. Where the broker watches in production, Windows and macOS, register the
 *    directory recursively and assert a nested entry is reported by its path
 *    below the directory, and never to the non-recursive registrations.
 *
 * @evidence contracts/testing.md#behavioral-verification Spawns watchBrokerSource with the platform backend; asserts two registrations hear an immediate post-ready write, production recursive backends hear nested paths while nonrecursive ones do not, and opening watches reports no gap.
 * @evidence contracts/testing.md#independent-expectations Ready authorizes trusting silence from that point, so an immediate authored filename must reach both registrations. Literal directory/filename identities and absence of gap are independent IPC observations, not predicted broker messages.
 * @evidence contracts/testing.md#distinguishing-cases Owns first/overlapping readiness, immediate writes, production recursive versus nonrecursive delivery and opening a second watch without disturbing the first. Nested production coverage runs only on Windows/macOS.
 * @evidence contracts/testing.md#execution-ownership E2E entry owns a real broker subprocess, filesystem watches and IPC messages; TestExecutor discovers it under features and the built binding is required on macOS.
 * @evidence contracts/e2e.md#necessary-boundary Native watcher readiness and overlapping-stream transport can lose events despite correct scripted classification. This connects actual backend callbacks to parent IPC, complementing controlled broker unit cases.
 * @evidence contracts/e2e.md#shared-execution One broker and directory batch two overlapping and one recursive registration; no install or compiler preparation repeats. Recursive registration is added only on production broker platforms; message waits reuse the child.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A unique root separates filenames; waits start before commands and ready precedes each write. broker.close in finally disconnects/kills the child; TestProject removes directories at exit. Timed-out wait cleanup remains bounded by the fixture timeout rather than proving graceful cancellation.
 * @evidence contracts/e2e.md#preserved-coverage All immediate-write, nested/nonrecursive and no-gap assertions remain with the real broker. Scripted overflow/drop/probe decisions moved to unit entries; their inputs and assertions are retained there.
 */
export async function test_watch_broker_hears_what_follows_ready(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-watch-broker-"),
  );
  const nested = path.join(root, "nested");
  fs.mkdirSync(nested);
  const binding =
    process.platform === "darwin" ? fseventsBindingPath() : undefined;
  assert.notEqual(binding, null, "the fsevents binding is installed on macOS");

  const broker = openBroker(binding);
  try {
    await broker.add(1, [{ directory: root }]);
    await broker.add(2, [{ directory: root }]);
    fs.writeFileSync(path.join(root, "after-ready.txt"), "x");
    for (const id of [1, 2]) {
      await broker.until(
        (message) =>
          message.id === id &&
          message.directory === root &&
          message.filename === "after-ready.txt",
        `registration ${id} to hear an entry written right after ready`,
      );
    }

    if (process.platform === "win32" || process.platform === "darwin") {
      await broker.add(3, [{ directory: root, recursive: true }]);
      fs.writeFileSync(path.join(nested, "deep.txt"), "x");
      await broker.until(
        (message) =>
          message.id === 3 &&
          message.filename === path.join("nested", "deep.txt"),
        "a nested entry written right after ready",
      );
      await broker.drain();
      assert.equal(
        broker.messages.some(
          (message) =>
            message.id !== 3 && message.filename?.includes("deep.txt") === true,
        ),
        false,
        "a non-recursive registration hears no nested entry",
      );
    }
    assert.equal(
      broker.messages.some((message) => message.gap === true),
      false,
      "opening a watch disturbs no other",
    );
  } finally {
    broker.close();
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
function openBroker(fsevents: string | null | undefined) {
  const child: ChildProcess = spawn(
    process.execPath,
    ["-e", watchBrokerSource(fsevents)],
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
    messages,
    until,
  };
}
