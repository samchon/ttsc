import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { fseventsBindingPath } from "../../../../../../packages/unplugin/lib/core/transform/tracker/broker/fseventsBindingPath.mjs";
import { watchBrokerSource } from "../../../../../../packages/unplugin/lib/core/transform/tracker/broker/watchBrokerSource.mjs";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";

const { spawn } = E2eProcessTrace;

/**
 * Verifies readiness, native drain frontiers and root-change gaps through one
 * real platform watch broker (samchon/ttsc#1272, #1418, #1425, #1428, #1453,
 * #1454).
 *
 * Each phase owns distinct paths and registration IDs. Removal followed by a
 * drain retires earlier registrations before the next phase; in particular,
 * macOS's proved-stream drain must not include earlier unprobed streams. Root
 * rename runs last because it deliberately destroys watch authority.
 *
 * 1. Open overlapping watches, write immediately after ready, then check recursive
 *    nested delivery, nonrecursive silence and absence of gaps.
 * 2. On Windows, measure all 200 synchronous write/drain pairs. On macOS, measure
 *    historical suppression, empty unproven and after-write ordering.
 * 3. On macOS, rename a separately registered root and await its actual gap.
 * 4. Collect independent failures, remove registrations and join IPC disconnect
 *    plus the actual process exit; ignored stdio contributes no pipe lifetime.
 *    release every parent wait timer and message listener even on failure.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual built watchBrokerSource child uses native fs.watch or the installed fsevents binding. Overlapping post-ready delivery, nested delivery/nonrecursive silence and no-gap remain; Windows measures 200 event-exists and event-before-drain pairs, while macOS retains historical suppression, empty unproven, post-write ordering and actual root-rename gap.
 * @evidence contracts/testing.md#independent-expectations Authored filenames, write timing and received IPC indices establish ordering independently of broker bookkeeping. Ready permits trusting subsequent silence; Windows completion ordering and ordered macOS probes supply the drain premise. RootChanged is a real flag transport proxy, not induced dropped-event overflow or a universal kernel proof.
 * @evidence contracts/testing.md#distinguishing-cases Overlapping/nonrecursive/recursive ready cases run on supported platforms. Windows alone owns 200 unique write frontiers; macOS alone owns before-ready suppression, proved drain and terminal root identity change. Independent phase and per-round assertion failures accumulate; failed registration prerequisites block only their dependent phase.
 * @evidence contracts/testing.md#execution-ownership The selected Vite batch calls this consolidated body once with its already owned cache subtree. One additional real broker subprocess owns all native filesystem/IPC phases, without a child per phase or write. Windows/macOS-specific phases remain gated; portable scripted scheduling and probe state-machine cases retain their existing unit owners. No compiler or contributor runs.
 * @evidence contracts/e2e.md#necessary-boundary Native completion ordering, binding stream latency and system flags can fail across actual IPC despite correct scripted callbacks. The entry measures those real backend connections and keeps the binding-presence oracle; scripted units cannot establish these connections.
 * @evidence contracts/e2e.md#shared-execution One child/backend serves all applicable phases through supported add/remove/drain IPC. Actual baseline processes were two on Windows, three on macOS and one on other platforms; the implementation prepares one, with no per-round spawn or old-entry wrappers. Reduced runtime counts still require execution observation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each phase has private paths and disjoint registration/drain IDs. FIFO remove then drain retires earlier registration state before proved-stream assertions, and root rename is last. The harness buffers IPC and cancels waits on exit. This ignored-stdio broker requires public disconnect, null channel, exact exit0/no signal and actual PID ESRCH; it does not claim a ChildProcess.close event from Node's local-disconnect accounting. Pipe-owning workers retain their separate close contracts. The existing bounded grace rejects unresolved shutdown; forced cleanup remains a failure and uncertain inputs are retained. The selected cache subtree is outside Vite source inputs; standalone calls retain their exact TestProject allocation key.
 * @evidence contracts/e2e.md#preserved-coverage The four original bodies map to readiness, Windows 400 assertions, macOS probe historical/empty-unproven/two ordering assertions and macOS root gap phases here. Registration-open and binding-presence checks remain, with per-phase failure labels. Genuine queue overflow is still untested; this batch does not infer it from root rename. No meaningful native assertion transfers to a scripted unit.
 */
export async function test_watch_broker_hears_what_follows_ready(
  preparedRoot?: string,
  retain?: (reason: string) => void,
): Promise<void> {
  const allocation = preparedRoot ?? TestProject.tmpdir("ttsc-unplugin-watch-broker-");
  const root = fs.realpathSync.native(allocation);
  const binding =
    process.platform === "darwin" ? fseventsBindingPath() : undefined;
  assert.notEqual(binding, null, "the fsevents binding is installed on macOS");
  const broker = openBroker(binding);
  const errors: Error[] = [];
  const check = (label: string, assertion: () => void): void => {
    try {
      assertion();
    } catch (error) {
      errors.push(new Error(label, { cause: error }));
    }
  };
  const phase = async (
    label: string,
    ids: number[],
    body: () => Promise<void>,
  ): Promise<void> => {
    try {
      await body();
    } catch (error) {
      errors.push(new Error(label, { cause: error }));
    } finally {
      try {
        await broker.remove(ids);
      } catch (error) {
        errors.push(new Error(`${label}: remove/drain`, { cause: error }));
      }
    }
  };
  try {
    // Original ready case: overlapping watches, then the production recursive boundary.
    await phase("ready/overlap/nested/no-gap", [1, 2, 3], async () => {
      const watched = path.join(root, "ready");
      const nested = path.join(watched, "nested");
      fs.mkdirSync(nested, { recursive: true });
      const start = broker.messages.length;
      await broker.add(1, [{ directory: watched }]);
      await broker.add(2, [{ directory: watched }]);
      fs.writeFileSync(path.join(watched, "after-ready.txt"), "x");
      for (const id of [1, 2]) {
        try {
          await broker.until(
            (message) =>
              message.id === id &&
              message.directory === watched &&
              message.filename === "after-ready.txt",
            `registration ${id} to hear an entry written right after ready`,
          );
        } catch (error) {
          errors.push(
            new Error(`ready: registration ${id} immediate write`, {
              cause: error,
            }),
          );
        }
      }
      if (process.platform === "win32" || process.platform === "darwin") {
        await broker.add(3, [{ directory: watched, recursive: true }]);
        fs.writeFileSync(path.join(nested, "deep.txt"), "x");
        try {
          await broker.until(
            (message) =>
              message.id === 3 &&
              message.filename === path.join("nested", "deep.txt"),
            "a nested entry written right after ready",
          );
        } catch (error) {
          errors.push(
            new Error("ready: recursive nested write", { cause: error }),
          );
        }
        try {
          await broker.drain();
        } catch (error) {
          errors.push(new Error("ready: nested drain", { cause: error }));
        }
        check("ready: nonrecursive silence", () =>
          assert.equal(
            broker.messages
              .slice(start)
              .some(
                (message) =>
                  message.id !== 3 &&
                  message.filename?.includes("deep.txt") === true,
              ),
            false,
            "a non-recursive registration hears no nested entry",
          ),
        );
      }
      check("ready: no gap", () =>
        assert.equal(
          broker.messages.slice(start).some((message) => message.gap === true),
          false,
          "opening a watch disturbs no other",
        ),
      );
    });
    if (process.platform === "win32") {
      // Original Windows case: each synchronous write is immediately followed by its drain.
      await phase("Windows synchronous write/drain", [10], async () => {
        const watched = path.join(root, "windows");
        fs.mkdirSync(watched);
        await broker.add(10, [{ directory: watched, recursive: true }]);
        for (let round = 0; round < 200; round++) {
          const name = `write-${round}.ts`;
          const drainId = 10_000 + round;
          try {
            fs.writeFileSync(path.join(watched, name), "export {};\n");
            await broker.drain(drainId);
          } catch (error) {
            errors.push(
              new Error(`Windows round ${round}: drain`, { cause: error }),
            );
          }
          const answered = broker.messages.findIndex(
            (message) => message.id === drainId && message.drained === true,
          );
          const heard = broker.messages.findIndex(
            (message) => message.id === 10 && message.filename === name,
          );
          check(`Windows round ${round}: event exists`, () =>
            assert.ok(heard !== -1, `round ${round}: the write is delivered`),
          );
          check(`Windows round ${round}: event order`, () =>
            assert.ok(
              heard < answered,
              `round ${round}: the write is delivered before the drain that followed it is answered`,
            ),
          );
        }
      });
    }
    if (process.platform === "darwin") {
      // Original probe case: no other registration can contribute an unproven stream.
      await phase(
        "macOS historical suppression/proved drain",
        [20],
        async () => {
          assert.notEqual(
            binding,
            null,
            "the fsevents binding is installed on macOS",
          );
          const probeRoot = path.join(root, "macos-probe");
          const watched = path.join(probeRoot, "src");
          fs.mkdirSync(watched, { recursive: true });
          const start = broker.messages.length;
          fs.writeFileSync(path.join(watched, "before.ts"), "export {};\n");
          await broker.add(20, [
            {
              directory: watched,
              probe: {
                directory: path.join(
                  probeRoot,
                  "node_modules",
                  ".cache",
                  "probes",
                ),
                root: probeRoot,
              },
            },
          ]);
          let first: BrokerMessage | undefined;
          try {
            first = await broker.drain(20_000);
          } catch (error) {
            errors.push(new Error("macOS historical drain", { cause: error }));
          }
          check("macOS pre-ready historical absence", () =>
            assert.deepEqual(
              broker.messages
                .slice(start)
                .filter(
                  (message) =>
                    message.id === 20 && message.filename !== undefined,
                ),
              [],
              "a write before the registration is the past, not an event",
            ),
          );
          check("macOS proved stream", () =>
            assert.deepEqual(first?.unproven, [], "a probed stream is proven"),
          );
          fs.writeFileSync(path.join(watched, "after.ts"), "export {};\n");
          try {
            await broker.drain(20_001);
          } catch (error) {
            errors.push(new Error("macOS after-write drain", { cause: error }));
          }
          const drained = broker.messages.findIndex(
            (message) => message.id === 20_001 && message.drained === true,
          );
          const event = broker.messages.findIndex(
            (message) => message.id === 20 && message.filename === "after.ts",
          );
          check("macOS post-ready event exists", () =>
            assert.ok(event !== -1, "the write is delivered"),
          );
          check("macOS post-ready event order", () =>
            assert.ok(
              event < drained,
              "the write is delivered before the drain that followed it is answered",
            ),
          );
        },
      );
      // Original real RootChanged case is terminal: moving the root destroys its identity.
      await phase("macOS root-change gap", [30], async () => {
        assert.notEqual(
          binding,
          null,
          "the fsevents binding is installed on macOS",
        );
        const parent = path.join(root, "macos-root");
        const watched = path.join(parent, "watched");
        fs.mkdirSync(watched, { recursive: true });
        await broker.add(30, [{ directory: watched, recursive: true }]);
        const gap = broker.until(
          (message) => message.id === 30 && message.gap === true,
          "a gap for the moved root",
        );
        // Attach rejection immediately if rename itself fails before the awaited gap.
        void gap.catch(() => undefined);
        await TestProject.rename(watched, path.join(parent, "moved"));
        await gap;
      });
    }
  } finally {
    try {
      await broker.close();
    } catch (error) {
      errors.push(new Error("broker child exit", { cause: error }));
      if (broker.unresolvedChild()) {
        const reason = "Watch broker supported shutdown has not joined its process and IPC channel";
        if (preparedRoot === undefined) TestProject.retainTemporaryDirectory(allocation, reason);
        else {
          // The selected subtree belongs to the shared plugin cache, outside
          // the prepared source root. Both uncertain owners must survive exit.
          TestProject.retainSharedPluginCache(reason);
          retain?.(reason);
        }
      }
    }
  }
  if (errors.length !== 0)
    throw new AggregateError(errors, "watch broker native family failures");
}

/**
 * Buffered IPC observation; unproven belongs to a drain reply, not a file
 * event.
 */
interface BrokerMessage {
  directory?: string;
  drained?: boolean;
  failed?: boolean;
  filename?: string | null;
  gap?: boolean;
  id?: number;
  ready?: boolean;
  unproven?: unknown;
}

/**
 * One actual child with ignored stdio. Parent waits are cancelled at exit;
 * shutdown joins public IPC disconnect and process exit independently. Node's
 * local disconnect need not produce ChildProcess.close; no such receipt is
 * inferred. Pipe-owning workers keep their separate actual close contracts.
 */
function openBroker(fsevents: string | null | undefined) {
  const child = spawn(process.execPath, ["-e", watchBrokerSource(fsevents)], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    windowsHide: true,
  });
  const messages: BrokerMessage[] = [];
  const waiters = new Set<{ wake: () => void; fail: (error: Error) => void }>();
  let stopped: Error | undefined;
  const fail = (error: Error): void => {
    stopped = error;
    for (const waiter of [...waiters]) waiter.fail(error);
  };
  const receive = (message: BrokerMessage): void => {
    messages.push(message);
    for (const waiter of [...waiters]) waiter.wake();
  };
  child.on("message", receive);
  let closing = false;
  let childFailure: Error | undefined;
  let joined = false;
  let finishExit!: () => void, finishDisconnect!: () => void;
  const exited = new Promise<void>((resolve) => { finishExit = resolve; });
  const disconnected = new Promise<void>((resolve) => { finishDisconnect = resolve; });
  const childError = (error: Error): void => {
    childFailure = error;
    fail(error);
    // Failed spawn has no PID or process to join, and remains a real failure.
    if (child.pid === undefined) { finishExit(); finishDisconnect(); }
  };
  const childExit = (
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void => {
    const error = new Error(
      `watch broker exited: code ${code}, signal ${signal}`,
    );
    if (!closing || code !== 0 || signal !== null) childFailure ??= error;
    fail(error);
    finishExit();
  };
  const childDisconnect = (): void => finishDisconnect();
  child.on("error", childError);
  child.once("exit", childExit);
  child.once("disconnect", childDisconnect);
  if (child.exitCode !== null || child.signalCode !== null) {
    childFailure = new Error(
      "watch broker exited before lifecycle listeners opened",
    );
    fail(childFailure);
  }
  const until = (
    matches: (message: BrokerMessage) => boolean,
    label: string,
  ): Promise<BrokerMessage> =>
    new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const release = (): void => {
        clearTimeout(timer);
        waiters.delete(waiter);
      };
      const waiter = {
        wake: (): void => {
          const found = messages.find(matches);
          if (found !== undefined) {
            release();
            resolve(found);
          }
        },
        fail: (error: Error): void => {
          release();
          reject(error);
        },
      };
      timer = setTimeout(
        () => waiter.fail(new Error(`timed out waiting for ${label}`)),
        20_000,
      );
      waiters.add(waiter);
      if (stopped !== undefined) waiter.fail(stopped);
      else waiter.wake();
    });
  const send = (message: object): void => {
    if (stopped !== undefined) throw stopped;
    if (!child.connected) throw new Error("watch broker IPC disconnected");
    child.send(message, (error: Error | null) => {
      if (error !== null && error !== undefined) fail(error);
    });
  };
  let drains = 1_000;
  const drain = async (id = ++drains): Promise<BrokerMessage> => {
    send({ id, op: "drain" });
    return until(
      (message) => message.id === id && message.drained === true,
      `drain ${id}`,
    );
  };
  return {
    messages,
    until,
    drain,
    add: async (
      id: number,
      locations: {
        directory: string;
        recursive?: boolean;
        probe?: { directory: string; root: string };
      }[],
    ): Promise<void> => {
      send({ allEvents: true, id, locations, op: "add" });
      const ready = await until(
        (message) => message.id === id && message.ready === true,
        `registration ${id} to be ready`,
      );
      assert.equal(ready.failed, false, `registration ${id} opens`);
    },
    remove: async (ids: number[]): Promise<void> => {
      for (const id of ids) {
        send({ id, op: "remove" });
      }
      await drain();
    },
    unresolvedChild: (): boolean => child.pid !== undefined && !joined,
    close: async (): Promise<void> => {
      // The product disconnect handler removes all remaining registrations.
      closing = true;
      fail(new Error("watch broker fixture closing"));
      let timer: ReturnType<typeof setTimeout> | undefined;
      const shutdown = Promise.all([exited, disconnected]).then(() => { joined = true; });
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("watch broker did not join process and IPC shutdown after supported disconnect");
          childFailure ??= error;
          child.kill("SIGKILL");
          reject(error); // Forced cleanup and timeout are failures, never proof.
        }, 2_000);
      });
      let disconnectError: unknown;
      try {
        if (child.connected) child.disconnect();
      } catch (error) {
        disconnectError = error;
        child.kill("SIGKILL");
      }
      try {
        await Promise.race([shutdown, deadline]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        child.off("message", receive);
        child.off("error", childError);
        if (joined) {
          child.off("exit", childExit);
          child.off("disconnect", childDisconnect);
        }
      }
      if (disconnectError !== undefined) throw disconnectError;
      if (childFailure !== undefined) throw childFailure;
      assert.deepEqual(child.stdio, [null, null, null, null], "this broker owns no stdio pipes requiring a stream-close join");
      assert.equal(child.connected, false);
      assert.equal(child.channel, null);
      assert.equal(child.exitCode, 0);
      assert.equal(child.signalCode, null);
      assert.ok(child.pid !== undefined);
      assert.throws(() => process.kill(child.pid!, 0), (error: unknown) => (error as NodeJS.ErrnoException).code === "ESRCH", "the actually exited broker PID must be gone");
    },
  };
}
