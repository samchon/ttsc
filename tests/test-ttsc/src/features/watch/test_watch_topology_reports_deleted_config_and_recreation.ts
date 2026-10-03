import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies config deletion, recreation and replacement in one source session.
 *
 * 1. Remove the actual config and retain its failed refresh and config report.
 * 2. Recreate and atomically replace it through the same recorded subscriptions.
 * 3. Edit the replacement and require another config transition.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source topology parses changed configs and survives deletion, recreation, replacement and ordinary editing in one session; refresh errors remain observable.
 * @evidence contracts/testing.md#independent-expectations Authored source membership and literal config bytes establish independent expected config transitions and failed-refresh errors.
 * @evidence contracts/testing.md#distinguishing-cases Missing config parsing, restored config, rename replacement and ordinary changed bytes remain separate stimuli and retain every original assertion.
 * @evidence contracts/testing.md#execution-ownership Source topology and adapter consume recorded callbacks with independently supplied compiler membership; no native compiler or OS subscription executes here. The existing configured CLI boundary owns real membership and native session survival.
 */
export const test_watch_topology_reports_deleted_config_and_recreation =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-config-recovery-"),
    );
    const source = path.join(root, "src", "main.ts");
    const config = path.join(root, "tsconfig.json");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    const configText = JSON.stringify({ files: ["src/main.ts"] });
    fs.writeFileSync(config, configText, "utf8");

    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
      watchDirectoryThroughFsWatch,
    );
    const changes: WatchInputChange[] = [];
    const errors: unknown[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (_location, error) => errors.push(error),
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      openDirectoryWatch,
      openFileWatch,
      fs.readdirSync,
      () => [source],
    );
    try {
      topology.refresh(false);
      fs.rmSync(config);
      deliverWatchEvent(watchers, config, "rename");
      await waitFor(
        () => changes.some((change) => change.kind === "config"),
        "config deletion",
      );
      assert.ok(errors.length > 0, "the failed refresh must remain observable");

      const deletionCount = changes.filter(
        (change) => change.kind === "config",
      ).length;
      fs.writeFileSync(config, configText, "utf8");
      deliverWatchEvent(watchers, config, "rename");
      await waitFor(
        () =>
          changes.filter((change) => change.kind === "config").length >
          deletionCount,
        "config recreation",
      );
      await settle();

      const replacement = path.join(root, "tsconfig.next.json");
      fs.writeFileSync(replacement, configText, "utf8");
      await settle();
      const beforeReplacement = configChangeCount(changes);
      const previousOwner = fs.statSync(config);
      const replacementOwner = fs.statSync(replacement);
      assert.notEqual(
        `${replacementOwner.dev}:${replacementOwner.ino}`,
        `${previousOwner.dev}:${previousOwner.ino}`,
        "native replacement fixture must have a distinct physical owner",
      );
      fs.renameSync(replacement, config);
      deliverWatchEvent(watchers, config, "rename");
      await waitFor(
        () => configChangeCount(changes) > beforeReplacement,
        "atomic config replacement",
      );
      await settle();

      const beforeOrdinaryWrite = configChangeCount(changes);
      fs.appendFileSync(config, "\n", "utf8");
      deliverWatchEvent(watchers, config, "change");
      await waitFor(
        () => configChangeCount(changes) > beforeOrdinaryWrite,
        "post-replacement config edit",
      );
      assert.ok(
        changes.every(
          (change) => change.kind === "config" && change.path === config,
        ),
      );
    } finally {
      topology.close();
      assert.ok(watchers.every((watcher) => watcher.active === false));
    }
  };

function configChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "config").length;
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250));
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`timed out waiting for ${label}`);
}
