import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  type IRecordedWatcher,
  deliverWatchEvent,
  recordWatchers,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

const WATCH_EVENT_DEADLINE_MS = 30_000;
const subscriptions = new WeakMap<WatchTopology, IRecordedWatcher[]>();

/**
 * Verifies an output directory containing the project cannot erase its compiler
 * watch inputs.
 *
 * Directory-level output exclusion is sound only for a product-only subtree.
 * The project root and its ancestors also contain source files, so applying
 * that exclusion there leaves no per-file watcher on POSIX and no tracked-file
 * match behind the recursive watcher on Windows.
 *
 * 1. Model output at the project root and prove source edits remain live.
 * 2. Model output at the project's parent and prove the same boundary.
 * 3. Put a source inside a descendant output directory and retain it.
 * 4. Keep a product-only output subtree unchanged.
 * 5. Keep the no-emit lane unchanged.
 * 6. In every case, keep an authored JavaScript output-shaped path quiet.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual WatchTopology consumes five authored output layouts and explicitly supplied source membership: a source edit reaches the compiler lane, authored JavaScript attention adds no compiler change, and declared project inputs inside overlapping output trees still report. No compiler emits these files; the no-emit control has no inferred JavaScript product.
 * @evidence contracts/testing.md#independent-expectations Authored outDir values, explicit main.ts membership and literal declared-input/output-shaped paths define the source-unit inputs. Compiler change count stays equal after the JavaScript write and project count rises after the declared edit, independently of topology output.
 * @evidence contracts/testing.md#distinguishing-cases The five layouts differ only in where the output tree sits relative to the project: containing the project root, containing its parent, overlapping the source directory, a product-only subtree and no emit. The product-only subtree and the no-emit lane are the controls that must behave as before; a case without a declared project input skips the project lane assertion.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology consumes the explicitly authored main.ts compiler member and actual config/output/physical-path decisions. Recorded source-adapter operations own notification and handle lifetimes without a native subscription or compiler child. The retained E2E owns native population and delivery until a shared corpus replaces it.
 */
export const test_watch_topology_keeps_compiler_inputs_when_outdir_contains_project =
  async (): Promise<void> => {
    const failures: unknown[] = [];
    for (const test of [
      {
        emit: true,
        name: "project root",
        outDir: ".",
        projectInput: (root: string) => path.join(root, "external.json"),
        output: (container: string, root: string) =>
          path.join(root, "src", "main.js"),
      },
      {
        emit: true,
        name: "project ancestor",
        outDir: "..",
        projectInput: (root: string) => path.join(root, "external.json"),
        output: (container: string) => path.join(container, "src", "main.js"),
      },
      {
        emit: true,
        name: "source-overlapping output subtree",
        outDir: "src",
        projectInput: (root: string) => path.join(root, "src", "external.json"),
        output: (_container: string, root: string) =>
          path.join(root, "src", "src", "main.js"),
      },
      {
        emit: true,
        name: "proper output subtree",
        outDir: "dist",
        projectInput: undefined,
        output: (_container: string, root: string) =>
          path.join(root, "dist", "src", "main.js"),
      },
      {
        emit: false,
        name: "no emit",
        outDir: ".",
        projectInput: (root: string) => path.join(root, "external.json"),
        output: (_container: string, root: string) =>
          path.join(root, "src", "main.js"),
      },
    ] as const) {
      try {
        const container = TestProject.physicalPath(
          TestProject.tmpdir("ttsc-compiler-outdir-watch-"),
        );
        const root = path.join(container, "project");
        const source = path.join(root, "src", "main.ts");
        const config = path.join(root, "tsconfig.json");
        fs.mkdirSync(path.dirname(source), { recursive: true });
        fs.writeFileSync(source, "export const value = 1;\n", "utf8");
        fs.writeFileSync(
          config,
          JSON.stringify({
            compilerOptions: {
              outDir: test.outDir,
              rootDir: ".",
            },
            files: ["src/main.ts"],
          }),
          "utf8",
        );
        const projectInput = test.projectInput?.(root);
        if (projectInput !== undefined)
          fs.writeFileSync(projectInput, '{"external":false}\n', "utf8");

        const changes: WatchInputChange[] = [];
        const observed = recordWatchers(watchDirectoryThroughFsWatch);
        const topology = new WatchTopology(
          {
            cwd: root,
            emit: test.emit,
            files: [],
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
          observed.openDirectoryWatch,
          observed.openFileWatch,
          fs.readdirSync,
          () => [source],
        );
        subscriptions.set(topology, observed.watchers);
        try {
          topology.refresh(false);
          await writeUntilCompilerChange(
            topology,
            source,
            changes,
            changes.length,
            test.name,
          );
          const previous = await waitForStableCount(
            () => compilerChangeCount(changes),
            test.name,
            "compiler watch lane",
          );

          const output = test.output(container, root);
          fs.mkdirSync(path.dirname(output), { recursive: true });
          fs.writeFileSync(output, "export const value = 2;\n", "utf8");
          notify(topology, output, false);
          await delay();
          assert.equal(
            compilerChangeCount(changes),
            previous,
            `${test.name}: emitted JavaScript retriggered the compiler lane`,
          );

          if (projectInput !== undefined) {
            topology.setProjectInputs({
              root,
              files: [projectInput],
              globs: [],
            });
            const projectChanges = await waitForStableCount(
              () => projectChangeCount(changes),
              test.name,
              "project watch lane",
            );
            fs.writeFileSync(projectInput, '{"external":true}\n', "utf8");
            notify(topology, projectInput);
            await waitForProjectChange(changes, projectChanges, test.name);
          }
        } finally {
          topology.close();
        }
        assert.ok(observed.watchers.every((watcher) => !watcher.active));
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        "output-directory source preservation matrix failed",
      );
  };

async function writeUntilCompilerChange(
  topology: WatchTopology,
  source: string,
  changes: readonly WatchInputChange[],
  previousLength: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  const physicalSource = physicalPath(source);
  let revision = 2;
  while (Date.now() < deadline) {
    fs.writeFileSync(source, `export const value = ${revision++};\n`, "utf8");
    notify(topology, source);
    const retryAt = Math.min(deadline, Date.now() + 250);
    while (Date.now() < retryAt) {
      if (
        changes
          .slice(previousLength)
          .some(
            (change) =>
              change.kind === "compiler" &&
              change.path !== undefined &&
              physicalPath(change.path) === physicalSource,
          )
      )
        return;
      await delay(25);
    }
  }
  assert.fail(`${label}: source edit did not reach compiler watch lane`);
}

function compilerChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "compiler").length;
}

async function waitForProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (projectChangeCount(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(
        `${label}: project input inside source output was not observed`,
      );
    }
    await delay(25);
  }
}

function projectChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

async function waitForStableCount(
  count: () => number,
  label: string,
  lane: string,
): Promise<number> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  let current = count();
  let stableSince = Date.now();
  while (Date.now() - stableSince < 750) {
    if (Date.now() >= deadline)
      assert.fail(`${label}: ${lane} did not reach a quiet boundary`);
    await delay(25);
    const next = count();
    if (next !== current) {
      current = next;
      stableSince = Date.now();
    }
  }
  return current;
}

function delay(milliseconds = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function physicalPath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}

/**
 * Deliver attention only through a recorded subscription covering the entry.
 * Positive input mutations require a subscription. Products can have none:
 * their omitted registration itself keeps that path outside observer delivery.
 */
function notify(
  topology: WatchTopology,
  changed: string,
  requireSubscription = true,
): void {
  const watchers = subscriptions.get(topology);
  assert.ok(watchers);
  let entry = TestProject.physicalPath(changed);
  while (
    !watchers.some((watcher) => {
      if (!watcher.active) return false;
      const relative = path.relative(watcher.location, entry);
      return (
        relative === "" ||
        relative === path.basename(entry) ||
        (watcher.recursive &&
          !relative.startsWith("..") &&
          !path.isAbsolute(relative))
      );
    })
  ) {
    const parent = path.dirname(entry);
    if (parent === entry) {
      assert.equal(
        requireSubscription,
        false,
        `no subscription covers ${changed}`,
      );
      return;
    }
    entry = parent;
  }
  deliverWatchEvent(watchers, entry, "rename");
}
