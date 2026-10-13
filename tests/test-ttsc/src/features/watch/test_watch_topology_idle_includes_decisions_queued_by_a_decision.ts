import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the idle barrier includes decisions queued by an earlier decision.
 *
 * One event can expose another input change while the first batch is reporting;
 * waiting only for that batch would acknowledge unfinished topology work.
 *
 * 1. Publish two compiler inputs with recorded subscriptions and a supplied
 *    compiler-input reader, then finish initial registration reconciliation.
 * 2. Edit the first input and have its reporting callback edit and notify the
 *    second; assert one idle barrier observes both changes in order.
 * 3. Deliver an unchanged event and assert quietness, then close with another
 *    event pending and assert the barrier finishes without reopening watchers.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual WatchTopology queues and decides recorded events; the second callback must arrive before whenIdle resolves, unchanged bytes stay quiet and closed subscriptions remain inactive.
 * @evidence contracts/testing.md#independent-expectations Authored changed bytes require their two ordered paths; unchanged bytes require none, and closing withdraws every recorded handle. Expectations do not inspect internal flags.
 * @evidence contracts/testing.md#distinguishing-cases Transitive queued work, unchanged notifications and close during pending work distinguish completion states; E2E worker transport owns cloned publications, thread responsiveness and actual thread loss.
 * @evidence contracts/testing.md#execution-ownership This portable source unit calls the core directly with recorded subscriptions and a supplied compiler-input reader; it starts no real worker, native compiler, host or installed consumer.
 */
export async function test_watch_topology_idle_includes_decisions_queued_by_a_decision(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-topology-idle-"),
  );
  const first = path.join(root, "src", "first.ts");
  const second = path.join(root, "src", "second.ts");
  fs.mkdirSync(path.dirname(first), { recursive: true });
  fs.writeFileSync(first, "export const value = 1;\n");
  fs.writeFileSync(second, "export const value = 1;\n");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { noEmit: true }, include: ["src"] }),
  );
  const recorder = recordWatchers(watchDirectoryThroughFsWatch);
  const changes: string[] = [];
  let armed = false;
  const topology = new WatchTopology(
    { cwd: root, files: [], tsconfig: path.join(root, "tsconfig.json") },
    {
      onError: (_location, error) => {
        throw error;
      },
      onInputChange: (change) => {
        if (change.path !== undefined) changes.push(change.path);
        if (armed && change.path === first) {
          armed = false;
          fs.writeFileSync(second, "export const value = 2;\n");
          deliverWatchEvent(recorder.watchers, second, "change");
        }
      },
      onTopologyChange: () => undefined,
    },
    recorder.openDirectoryWatch,
    recorder.openFileWatch,
    fs.readdirSync,
    () => [first, second],
    () => () => undefined,
  );
  try {
    topology.refresh(false);
    await topology.whenIdle();
    changes.length = 0;
    armed = true;
    fs.writeFileSync(first, "export const value = 2;\n");
    deliverWatchEvent(recorder.watchers, first, "change");
    await topology.whenIdle();
    assert.deepEqual(changes, [first, second]);
    deliverWatchEvent(recorder.watchers, first, "change");
    await topology.whenIdle();
    assert.deepEqual(changes, [first, second]);
    deliverWatchEvent(recorder.watchers, second, "change");
    topology.close();
    await topology.whenIdle();
    assert.equal(
      recorder.watchers.some((watcher) => watcher.active),
      false,
    );
    assert.deepEqual(changes, [first, second]);
  } finally {
    topology.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
