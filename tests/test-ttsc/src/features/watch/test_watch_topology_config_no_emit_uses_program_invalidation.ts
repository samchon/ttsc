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

const WATCH_EVENT_DEADLINE_MS = 30_000;

/**
 * Verifies configured project-lane decisions through the owning source.
 *
 * Supplied compiler membership and observer notifications isolate the actual
 * config, output-containment and project invalidation decisions.
 *
 * 1. Author the config, compiler member and declared project input.
 * 2. Supply literal compiler membership and record the actual source adapter
 *    subscriptions.
 * 3. Change the declared input and require the original project transition.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual WatchTopology reports the removed, supplied resolveJsonModule compiler member as one project change with Program invalidation under configured noEmit, without a topology-reload callback. A resident Program or native compiler is not executed.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig noEmit/resolveJsonModule options, explicit compiler-membership arrays and declared JSON input establish this source-unit boundary. The literal expectations are one project-kind change carrying invalidate and the removed JSON path, and zero topology changes; the source import is fixture data rather than evidence of native membership discovery. Content-only and CLI-option controls belong to separate owning units.
 * @evidence contracts/testing.md#distinguishing-cases An imported resolveJsonModule member declared as a project input is removed under configured noEmit; the emitted change must invalidate the Program without an execution reload.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology runs with authored absolute compiler members and explicitly recorded source directory operations. No compiler child or native observer executes; retained E2E owns population and physical delivery. Original event, membership and cleanup assertions remain.
 */
export const test_watch_topology_config_no_emit_uses_program_invalidation =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-config-no-emit-"),
    );
    const source = path.join(root, "src", "main.ts");
    const json = path.join(root, "src", "member.json");
    const config = path.join(root, "tsconfig.json");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(
      source,
      'import member from "./member.json";\nexport default member;\n',
      "utf8",
    );
    fs.writeFileSync(json, '{"value":1}\n', "utf8");
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          esModuleInterop: true,
          noEmit: true,
          resolveJsonModule: true,
        },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    let topologyChanges = 0;
    let compilerInputs = [source, json];
    const observed = recordWatchers(watchDirectoryThroughFsWatch);
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => {
          topologyChanges++;
        },
      },
      observed.openDirectoryWatch,
      observed.openFileWatch,
      fs.readdirSync,
      () => compilerInputs,
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        files: [json],
        globs: [],
        root,
      });
      fs.rmSync(json);
      compilerInputs = [source];
      deliverWatchEvent(observed.watchers, json, "rename");
      await waitFor(() =>
        changes.some(
          (change) => change.kind === "project" && change.invalidate === true,
        ),
      );
      await Promise.resolve();
      assert.deepEqual(changes, [
        { kind: "project", invalidate: true, path: json },
      ]);
      assert.equal(
        topologyChanges,
        0,
        "config noEmit must not escalate Program membership to execution reload",
      );
    } finally {
      topology.close();
    }
    assert.ok(observed.watchers.every((watcher) => !watcher.active));
  };

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("timed out waiting for Program invalidation");
}
