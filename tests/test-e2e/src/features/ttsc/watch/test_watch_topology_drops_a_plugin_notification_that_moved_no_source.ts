import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../internal/ttsc/internal/recorded-watchers";

/**
 * Verifies a notification about a plugin source directory is reported only when
 * what the plugin build reads moved.
 *
 * A watcher reports more than an edit. Windows reports a directory's entry as
 * changed when only its metadata moved, such as its access time after a build
 * enumerated it, and `ttsc --watch` took that as a plugin change: it rebuilt
 * the plugin and restarted the resident check host for sources nobody edited. A
 * plugin input is now decided by the digest its build keys it on.
 *
 * 1. Resolve a project whose plugin source lives in `plugin-go`, with watchers
 *    that record their listeners instead of watching.
 * 2. Deliver a `change` for the source directory's own entry while nothing in it
 *    moved, and assert no plugin change is reported.
 * 3. Edit `plugin-go/main.go` and deliver, as Windows does for one write, a
 *    `change` for the file and one for its directory's entry; assert the edited
 *    file is reported as a plugin change.
 *
 * @evidence contracts/testing.md#behavioral-verification Unchanged plugin bytes and metadata-only directory attention stay quiet, while changed contributor source produces a plugin notification.
 * @evidence contracts/testing.md#independent-expectations The authored Go source bytes and subsequent literal source edit define the unchanged and changed plugin build inputs independently.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged plugin bytes and metadata-only directory attention stay quiet, while changed contributor source produces a plugin notification; the native observer's uncontrolled event scheduling remains exercised by the separate actual fs.watch watch boundaries.
 * @evidence contracts/testing.md#execution-ownership The named features/watch entry executes the shipped WatchTopology with real tsgo refresh and explicit owned subscription operations; its original assertions and subcase identities remain in this E2E population.
 * @evidence contracts/e2e.md#necessary-boundary Real tsgo refresh supplies compiler membership alongside a separately admitted plugin source directory; contributor-source fingerprint changes must select the plugin lane while unchanged directory attention remains quiet.
 * @evidence contracts/e2e.md#shared-execution Subcases share one E2E process, installed compiler and compiled launcher; different project origins, config transitions or membership mutations require their current compiler request. Observer registration itself installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable inputs; each topology owns its supplied subscriptions and existing finally/close paths release them. Explicit providers retain the original callback and failure behavior without global observer state leaking between cases.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and subcase input remains; the operation-provider rewrite changes only where observations are acquired, while actual compiler selection, content fingerprints, recovery and cleanup decisions remain the original semantic path.
 */
export async function test_watch_topology_drops_a_plugin_notification_that_moved_no_source() {
    const root = fs.realpathSync.native(
      TestProject.tmpdir("ttsc-watch-plugin-metadata-"),
    );
    const plugin = path.join(root, "plugin-go");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
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
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    const source = path.join(plugin, "main.go");
    fs.writeFileSync(source, "package main\n", "utf8");

    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers();
    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
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
    try {
      topology.refresh(false);
      topology.setExtraInputs([plugin]);
      await settleWatchEvents();
      changes.length = 0;

      deliverWatchEvent(watchers, plugin, "change");
      await settleWatchEvents();
      assert.deepEqual(
        changes.filter((change) => change.kind === "plugin"),
        [],
        "a notification that moved no plugin source was reported",
      );

      fs.writeFileSync(source, "package main\n\n// edited\n", "utf8");
      deliverWatchEvent(watchers, source, "change");
      deliverWatchEvent(watchers, plugin, "change");
      await settleWatchEvents();
      assert.ok(
        changes.some(
          (change) => change.kind === "plugin" && change.path === source,
        ),
        JSON.stringify(changes),
      );
    } finally {
      topology.close();
    }
}
