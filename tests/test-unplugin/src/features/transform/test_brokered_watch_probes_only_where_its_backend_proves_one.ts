import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { WATCH_BROKER } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/WATCH_BROKER";
import type { WatchBroker } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/WatchBroker";
import { openBrokeredWatch } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/openBrokeredWatch";

/**
 * Verifies a brokered watch names a probe only where the watch process's
 * backend proves a stream with one, and is left unproven, never failed, where
 * the probe's directory cannot be prepared (samchon/ttsc#1453,
 * samchon/ttsc#1480).
 *
 * Only the macOS backend, FSEvents, writes probes. Every location below a
 * project was still named one on every platform, so the parent prepared the
 * project's `node_modules/.cache/ttsc` on Windows too, where nothing ever wrote
 * there, and a directory it could not create, below a read-only `node_modules`,
 * threw, failing the whole registration: a generation's tracker then proved
 * nothing, and an observer's scope fell back to polling, where a probe the
 * child itself cannot write only leaves its stream unproven.
 *
 * 1. With a backend that writes no probe, open a watch below a project, and assert
 *    its location names none and the project's tool cache is untouched.
 * 2. With a probing backend, open one below a project whose `node_modules` is a
 *    file, and assert it opens with no probe instead of failing.
 * 3. With a probing backend and a writable project, assert the location names a
 *    probe below the project's tool cache.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls openBrokeredWatch with a scripted broker; asserts a nonprobing backend leaves the project cache untouched, an obstructed probe root still registers, and a writable probing root supplies the expected probe location.
 * @evidence contracts/testing.md#independent-expectations The backend capability controls whether probes have meaning; inability to prepare an optional proof must not fail the watch. Literal absent/present probe expectations follow that contract, independently of message construction.
 * @evidence contracts/testing.md#distinguishing-cases Owns nonprobing, probing-but-obstructed and probing-and-writable roots. Each watch closes and WATCH_BROKER.current is restored; these assertions do not prove a native stream receives its probe.
 * @evidence contracts/testing.md#execution-ownership Unit entry test_brokered_watch_probes_only_where_its_backend_proves_one is discovered under src/features/transform by TestExecutor. It invokes the owning operations in the test process against controlled fixture inputs; the assertions moved from features and source imports replace built package imports and this entry owns no dynamically registered cases.
 */
export async function test_brokered_watch_probes_only_where_its_backend_proves_one(): Promise<void> {
  const previous = WATCH_BROKER.current;
  const open = (probes: boolean, root: string) => {
    const sent: { locations?: { probe?: unknown }[]; op: string }[] = [];
    const broker: WatchBroker = {
      child: {
        channel: { ref: () => undefined, unref: () => undefined },
        disconnect: () => undefined,
        kill: () => true,
        ref: () => undefined,
        send: (message: (typeof sent)[number]) => {
          sent.push(message);
          return true;
        },
        unref: () => undefined,
      } as unknown as ChildProcess,
      drains: new Map(),
      nextId: 1,
      pendingDrains: 0,
      pendingRegistrations: 0,
      probes,
      registrations: new Map(),
    };
    WATCH_BROKER.current = broker;
    const watch = openBrokeredWatch([{ directory: path.join(root, "src") }], {
      allEvents: true,
      drains: true,
      filesystem: DEFAULT_FILESYSTEM_OPERATIONS,
      probeRoot: root,
      sink: {
        event: () => undefined,
        failed: () => assert.fail("the watch must not fail"),
        gap: () => undefined,
        unattributed: () => undefined,
        unproven: () => undefined,
      },
    });
    const added = sent.find((message) => message.op === "add");
    watch.close();
    return added?.locations?.[0]?.probe;
  };
  const project = (files: Record<string, string>) => {
    const root = fs.realpathSync.native(
      TestProject.tmpdir("ttsc-unplugin-brokered-probe-"),
    );
    TestProject.writeFiles(root, { "src/main.ts": "export {};\n", ...files });
    return root;
  };
  try {
    // 1. No probe where the backend writes none.
    const windows = project({});
    assert.equal(open(false, windows), undefined);
    assert.equal(
      fs.existsSync(path.join(windows, "node_modules")),
      false,
      "the project's tool cache is untouched",
    );

    // 2. An unpreparable probe leaves the location unproven.
    const readOnly = project({ node_modules: "not a directory\n" });
    assert.equal(open(true, readOnly), undefined);

    // 3. A probe below the project's tool cache otherwise.
    const macos = project({});
    const probe = open(true, macos) as
      | { directory: string; root: string }
      | undefined;
    assert.equal(probe?.root, macos);
    assert.ok(
      probe !== undefined &&
        probe.directory.startsWith(
          path.join(macos, "node_modules", ".cache", "ttsc"),
        ),
      JSON.stringify(probe),
    );
  } finally {
    WATCH_BROKER.current = previous;
  }
}
