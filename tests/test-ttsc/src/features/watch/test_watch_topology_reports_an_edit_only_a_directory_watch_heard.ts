import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import {
  recordWatchers,
  settleWatchEvents,
} from "../../internal/recorded-watchers";

/**
 * Verifies an edit to a tracked file is reported when only a directory watch
 * heard it.
 *
 * On POSIX a tracked file has a watcher of its own, and a directory watch that
 * named the file's content change left it to that watcher. On macOS the file's
 * watcher missed a `tsconfig.json` edit the root's directory watch heard, and
 * `ttsc --watch` never rebuilt (samchon/ttsc#1583). Every watcher now decides a
 * named change from the bytes, so the first to see the edit reports it once.
 *
 * 1. Resolve a project with watchers that record their listeners.
 * 2. Edit `tsconfig.json`, and deliver its `change` to the directory watchers of
 *    its parent alone, never to a watcher of the file itself.
 * 3. Assert the edit is reported once, and, where the file has a watcher of its
 *    own, a second delivery of the same bytes is not reported again.
 *
 * @evidence contracts/testing.md#behavioral-verification A changed config heard only by its directory produces one report; duplicate delivery of the admitted bytes produces none.
 * @evidence contracts/testing.md#independent-expectations The independent strict true-to-false config edit and literal single report establish directory-first ownership.
 * @evidence contracts/testing.md#distinguishing-cases A changed config heard only by its directory produces one report; duplicate delivery of the admitted bytes produces none; the native observer's uncontrolled event scheduling remains exercised by the separate actual fs.watch watch boundaries.
 * @evidence contracts/testing.md#execution-ownership The named features/watch entry executes the shipped WatchTopology with real tsgo refresh and explicit owned subscription operations; its original assertions and subcase identities remain in this E2E population.
 * @evidence contracts/e2e.md#necessary-boundary Real tsgo refresh loads the project configuration and tracked membership; a config edit heard through its directory alone must select one config transition and suppress duplicate admitted bytes.
 * @evidence contracts/e2e.md#shared-execution Subcases share one E2E process, installed compiler and compiled launcher; different project origins, config transitions or membership mutations require their current compiler request. Observer registration itself installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable inputs; each topology owns its supplied subscriptions and existing finally/close paths release them. Explicit providers retain the original callback and failure behavior without global observer state leaking between cases.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and subcase input remains; the operation-provider rewrite changes only where observations are acquired, while actual compiler selection, content fingerprints, recovery and cleanup decisions remain the original semantic path.
 */
export async function test_watch_topology_reports_an_edit_only_a_directory_watch_heard() {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-directory-only-"),
    );
    const config = path.join(root, "tsconfig.json");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: { module: "commonjs", noEmit: true, strict: true },
        include: ["src"],
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      "export const value = 1;\n",
      "utf8",
    );

    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers();
    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (_location, error) => {
          throw error;
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      openDirectoryWatch,
      openFileWatch,
    );
    const deliverToDirectoryWatchers = (): void => {
      const directories = watchers.filter(
        (watcher) =>
          watcher.location !== config &&
          path.relative(watcher.location, config) === "tsconfig.json",
      );
      assert.notEqual(directories.length, 0, "no directory watch covers it");
      for (const watcher of directories)
        watcher.listener("change", "tsconfig.json");
    };
    try {
      topology.refresh(false);
      await settleWatchEvents();
      changes.length = 0;

      fs.writeFileSync(
        config,
        JSON.stringify({
          compilerOptions: { module: "commonjs", noEmit: true, strict: false },
          include: ["src"],
        }),
        "utf8",
      );
      deliverToDirectoryWatchers();
      await settleWatchEvents();
      assert.equal(
        changes.filter((change) => change.path === config).length,
        1,
        `an edit only a directory watch heard: ${JSON.stringify(changes)}`,
      );

      // Where the file has a watcher of its own, both decide from the bytes, so
      // hearing the same bytes again reports nothing. A backend with directory
      // watches alone uses the same fingerprint decision.
      if (!watchers.some((watcher) => watcher.location === config)) return;
      deliverToDirectoryWatchers();
      await settleWatchEvents();
      assert.equal(
        changes.filter((change) => change.path === config).length,
        1,
        `the same bytes were reported again: ${JSON.stringify(changes)}`,
      );
    } finally {
      topology.close();
    }
}
