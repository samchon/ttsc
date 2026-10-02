import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies lexical and target anchors for manually declared reload symlinks.
 *
 * 1. Author an external target and its project-local symbolic declaration.
 * 2. Verify both actual registration arguments and deliver a target byte edit.
 * 3. Retarget the declaration and require the original cold config transition.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source topology, directory adapter and fingerprint decisions consume supplied target and lexical notifications, reporting config transitions for both original stimuli.
 * @evidence contracts/testing.md#independent-expectations Authored target, replacement and declaration paths establish independent subscription arguments and byte changes; positional compiler listing throws if reached.
 * @evidence contracts/testing.md#distinguishing-cases External target content differs from lexical link replacement; both anchors are checked separately, and unsupported symlinks return false.
 * @evidence contracts/testing.md#execution-ownership This unit owns manually supplied reload declarations and their actual source decisions through recorded observers. It performs no compiler query or native observer registration; the retained native cases own actual OS delivery.
 */
export const test_watch_topology_watches_reload_symlink_targets =
  async (): Promise<void | false> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-reload-symlink-"),
    );
    const externalRoot = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-reload-target-"),
    );
    const target = path.join(externalRoot, "selected", "selection.json");
    const replacement = path.join(externalRoot, "other", "selection.json");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.mkdirSync(path.dirname(replacement), { recursive: true });
    fs.writeFileSync(target, '{"plugin":"first"}\n', "utf8");
    fs.writeFileSync(replacement, '{"plugin":"second"}\n', "utf8");

    const declaration = path.join(root, "selection.json");
    try {
      fs.symlinkSync(target, declaration, "file");
    } catch (error) {
      // The filesystem cannot express the alias this case is about: a file
      // symlink needs a privilege Windows may withhold, and no junction or
      // hard link has the same lexical-versus-target identity.
      console.warn(
        `SKIPPED reload symlink targets: ${(error as NodeJS.ErrnoException).code ?? String(error)}`,
      );
      return false;
    }

    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    const config = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: { noEmit: true },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
      watchDirectoryThroughFsWatch,
    );
    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [source],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      openDirectoryWatch,
      openFileWatch,
      fs.readdirSync,
      () => {
        assert.fail("positional inputs must not query compiler membership");
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [],
        globs: [],
        reloadFiles: [declaration],
      });

      assert.ok(
        watchers.some(
          (watcher) =>
            watcher.active &&
            watcher.location === externalRoot &&
            watcher.recursive,
        ),
        "the external target must have an independently registered anchor",
      );
      assert.ok(
        watchers.some((watcher) => watcher.active && watcher.location === root),
        "the lexical declaration must keep its parent anchor",
      );
      await waitForConfigChange(changes, "target edit", () => {
        fs.writeFileSync(target, '{"plugin":"first-edited"}\n', "utf8");
        deliverWatchEvent(watchers, target, "change");
      });
      await waitForConfigChange(changes, "link retarget", () => {
        fs.rmSync(declaration, { force: true });
        fs.symlinkSync(replacement, declaration, "file");
        deliverWatchEvent(watchers, declaration, "rename");
      });
      assert.ok(
        watchers.some(
          (watcher) =>
            watcher.active &&
            watcher.location === externalRoot &&
            watcher.recursive,
        ),
        "retargeting must retain the external anchor covering the replacement",
      );
    } finally {
      topology.close();
    }
  };

async function waitForConfigChange(
  changes: WatchInputChange[],
  label: string,
  stimulus: () => void,
): Promise<void> {
  // Let any event still in flight from the previous phase land before the
  // ledger is cleared, so a late arrival cannot satisfy the next expectation.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const deadline = Date.now() + 30_000;
  changes.length = 0;
  while (!changes.some((change) => change.kind === "config")) {
    if (Date.now() >= deadline) {
      assert.fail(
        `expected a cold config transition after a ${label}: ${JSON.stringify(changes)}`,
      );
    }
    stimulus();
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
