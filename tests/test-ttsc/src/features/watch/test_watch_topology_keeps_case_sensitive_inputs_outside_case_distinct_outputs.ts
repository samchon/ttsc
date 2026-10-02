import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  type IRecordedWatcher,
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

const subscriptions = new WeakMap<WatchTopology, readonly IRecordedWatcher[]>();

/**
 * Verifies authored case-sensitive project declarations with actual identities.
 *
 * 1. Create the original case-distinct physical paths under measured capabilities.
 * 2. Preserve literal input and output roles and assert their live observer roots.
 * 3. Deliver authored byte changes through the actual source directory adapter.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source topology retains the original exact/glob registration and project callback assertions using supplied notifications.
 * @evidence contracts/testing.md#independent-expectations Authored case-distinct paths, actual filesystem identities and literal compiler membership establish input and output expectations independently.
 * @evidence contracts/testing.md#distinguishing-cases Case-distinct roots or output twins must not collapse; original host guards and partial-return behavior remain unchanged, with no coverage claimed when initial capabilities are unavailable.
 * @evidence contracts/testing.md#execution-ownership This source unit owns manually supplied project declarations and actual path/content decisions through recorded observers. No compiler process or native observer runs; the original platform capability operation remains actual.
 */
export const test_watch_topology_keeps_case_sensitive_inputs_outside_case_distinct_outputs =
  async (): Promise<void | false> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-project-input-output-project-"),
    );
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");

    const external = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-project-input-output-external-"),
    );
    if (enableWindowsCaseSensitivity(external) === false) return false;
    const outputRoot = path.join(external, "Output");
    const inputRoot = path.join(external, "output");
    fs.mkdirSync(outputRoot);
    if (createCaseDistinctDirectory(inputRoot) === false) return false;
    assert.notEqual(realpath(outputRoot), realpath(inputRoot));
    const exactRoot = path.join(external, "Exact");
    const exactDirectory = path.join(exactRoot, "nested");
    const exactOutput = path.join(exactDirectory, "State.json");
    const exactInput = path.join(exactDirectory, "state.json");
    fs.mkdirSync(exactDirectory, { recursive: true });
    if (enableWindowsCaseSensitivity(exactDirectory) === false) return;
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          declaration: true,
          declarationDir: outputRoot,
          incremental: true,
          rootDir: "src",
          tsBuildInfoFile: exactOutput,
        },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const exact = path.join(inputRoot, "nested", "evidence.md");
    const globRoot = path.join(inputRoot, "api");
    fs.mkdirSync(globRoot);
    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
      watchDirectoryThroughFsWatch,
    );
    const changes: WatchInputChange[] = [];
    let liveRoots: readonly string[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onProjectInputWatchRoots: (roots) => {
          liveRoots = [...roots];
        },
        onTopologyChange: () => undefined,
      },
      openDirectoryWatch,
      openFileWatch,
      fs.readdirSync,
      () => [source],
    );
    subscriptions.set(topology, watchers);
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [exact, exactInput],
        globs: [path.join(globRoot, "**", "*.json")],
      });
      assert.deepEqual(
        liveRoots,
        [realpath(exactRoot), realpath(inputRoot)].sort(),
      );

      await writeAndWait(topology, changes, exact, "exact\n");
      await writeAndWait(
        topology,
        changes,
        exactInput,
        "case-distinct output\n",
      );
      await writeAndWait(
        topology,
        changes,
        path.join(globRoot, "openapi.json"),
        "{}\n",
      );
    } finally {
      topology.close();
    }
  };

async function writeAndWait(
  topology: WatchTopology,
  changes: readonly WatchInputChange[],
  location: string,
  content: string,
): Promise<void> {
  const count = changes.length;
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(location, content, "utf8");
  notify(topology, location);
  const deadline = Date.now() + 30_000;
  while (
    changes
      .slice(count)
      .some(
        (change) =>
          change.kind === "project" &&
          change.path !== undefined &&
          pathMatchesOrContains(change.path, location),
      ) === false
  ) {
    if (Date.now() >= deadline) {
      assert.fail(
        `expected project change for ${location}: ${JSON.stringify(
          changes.slice(count),
        )}`,
      );
    }
    await delay(25);
  }
  await delay();
}

function pathMatchesOrContains(changed: string, target: string): boolean {
  const root = realpath(changed);
  const candidate = realpath(target);
  return (
    candidate === root ||
    candidate.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`)
  );
}

function enableWindowsCaseSensitivity(directory: string): boolean {
  if (process.platform !== "win32") return true;
  const result = childProcess.spawnSync(
    "fsutil.exe",
    ["file", "setCaseSensitiveInfo", directory, "enable"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
  return result.status === 0;
}

function createCaseDistinctDirectory(directory: string): boolean {
  try {
    fs.mkdirSync(directory);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

function realpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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
