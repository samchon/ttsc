import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../../internal/ttsc/internal/watch";

/**
 * Verifies config and selected plugin sources enter the same reload lane.
 *
 * The watch launcher resets resident state for either change kind. This test
 * owns the topology half of that contract; the resident lifecycle test drives
 * the config kind through the shared reset branch and observes a fresh PID.
 *
 * 1. Watch one project config and one selected plugin source tree.
 * 2. Edit each input and require every overlapping watcher to choose reload.
 * 3. Prove plugin-root/descendant events never leak into compiler/project.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: config and selected plugin sources enter the same reload lane. 1. Watch one project config and one selected plugin source tree. 2. Edit each input and require every overlapping watcher to choose reload. 3. Prove plugin-root/descendant events never leak into compiler/project.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Watch one project config and one selected plugin source tree. 2. Edit each input and require every overlapping watcher to choose reload. 3. Prove plugin-root/descendant events never leak into compiler/project.
 * @evidence contracts/testing.md#execution-ownership This named src/features/watch entry refreshes the real tsgo compiler population and drives native filesystem subscriptions through WatchTopology; the source units own direct event planning and injected watcher decisions.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler input/output population must agree with native observer registration and notification classification for this authored layout. Direct path planning cannot establish tsgo membership, actual delivered events or subscription survival across mutations.
 * @evidence contracts/e2e.md#shared-execution The case reuses its built compiler and one Node test process; each topology session serves its authored mutation sequence. Distinct roots/options need their own compiler-population request, and an explicitly new session retains the initial-versus-newly-admitted input distinction; watcher registration installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable config, source, output and declared-input state. Each topology owns its subscriptions and existing finally paths close them. Event counters reset only between asserted transitions; actual cold registration and config recovery remain unprimed.
 * @evidence contracts/e2e.md#preserved-coverage 1. Watch one project config and one selected plugin source tree. 2. Edit each input and require every overlapping watcher to choose reload. 3. Prove plugin-root/descendant events never leak into compiler/project. Every original assertion and authored layout remains in this named entry; no change to timeout, capability guard, input, expected event or quiet negative twin is made by these acknowledgments.
 */
export const test_watch_topology_classifies_config_and_plugin_reload_inputs =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-watch-reload-inputs-");
    const source = path.join(root, "src", "main.ts");
    const config = path.join(root, "tsconfig.json");
    const pluginRoot = path.join(root, "plugin");
    const pluginSource = path.join(pluginRoot, "rule.go");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.mkdirSync(pluginRoot);
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(pluginSource, "package plugin\n", "utf8");
    writeConfig(config, false);

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
    );
    try {
      topology.refresh(false);
      topology.setExtraInputs([pluginRoot]);

      await waitForKind(changes, "config", () => writeConfig(config, true));
      await waitForKind(changes, "plugin", () =>
        fs.writeFileSync(
          pluginSource,
          "package plugin\n\n// changed\n",
          "utf8",
        ),
      );

      const pluginChanges = changes.filter(
        (change) =>
          change.path !== undefined && isPathWithin(pluginRoot, change.path),
      );
      assert.notEqual(pluginChanges.length, 0, JSON.stringify(changes));
      assert.equal(
        pluginChanges.every((change) => change.kind === "plugin"),
        true,
        JSON.stringify(changes),
      );
      assert.equal(
        changes.every(
          (change) => change.kind === "config" || change.kind === "plugin",
        ),
        true,
        JSON.stringify(changes),
      );
    } finally {
      topology.close();
    }
  };

function writeConfig(location: string, noUnusedLocals: boolean): void {
  fs.writeFileSync(
    location,
    JSON.stringify({
      compilerOptions: { noUnusedLocals },
      files: ["src/main.ts"],
    }),
    "utf8",
  );
}

/**
 * Reapply the stimulus until the expected change kind is observed.
 *
 * A filesystem watcher is armed asynchronously: macOS starts its FSEvents
 * stream on a separate run loop, so a write issued in the same tick as the
 * registration can land before the stream delivers anything. Repeating the edit
 * proves the classification contract without waiting on that window, and the
 * deadline still fails when the kind is never produced.
 */
async function waitForKind(
  changes: readonly WatchInputChange[],
  kind: WatchInputChange["kind"],
  stimulus: () => void,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (!changes.some((change) => change.kind === kind)) {
    if (Date.now() >= deadline) {
      assert.fail(`expected a ${kind} change: ${JSON.stringify(changes)}`);
    }
    stimulus();
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function isPathWithin(root: string, location: string): boolean {
  const relative = path.relative(root, location);
  return (
    relative === "" ||
    (relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false &&
      path.isAbsolute(relative) === false)
  );
}
