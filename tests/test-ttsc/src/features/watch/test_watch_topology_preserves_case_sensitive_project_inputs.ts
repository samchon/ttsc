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
import { prepareCaseSensitiveFixture } from "../../../../utils/src/prepareCaseSensitiveFixture";

/**
 * Verifies authored case-sensitive project declarations with actual identities.
 *
 * Native capability preparation preserves case-only twins when representable.
 * A refused collision proves identity and bytes remain unchanged; distinct-name
 * recovery still exercises the complete input and output role sequence.
 *
 * 1. Establish the required native case-distinct physical paths.
 * 2. Preserve exact and glob input roles and assert their live observer roots.
 * 3. Deliver authored byte changes through the actual source directory adapter.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source topology retains the original exact/glob registration and project callback assertions using supplied notifications.
 * @evidence contracts/testing.md#independent-expectations Authored case-distinct paths, independently checked filesystem identities and literal compiler membership establish the exact and glob input expectations independently.
 * @evidence contracts/testing.md#distinguishing-cases Case-distinct roots and nested glob roots must not collapse. Both exact inputs and both glob members report, then removing only the lower glob makes its next edit quiet. Native preparation independently probes case-only entries. An observed EEXIST must preserve identity and bytes; distinct-name recovery still exercises both exact/glob roles and removal. Unavailable case-only coverage is reported, not certified.
 * @evidence contracts/testing.md#execution-ownership This source unit owns manually supplied project declarations and actual path/content decisions through recorded observers. No compiler process or native observer runs; the original platform capability operation remains actual.
 */
export const test_watch_topology_preserves_case_sensitive_project_inputs =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-project-input-case-project-"),
    );
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          outDir: "dist",
          rootDir: "src",
        },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const externalParent = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-project-input-case-external-"),
    );
    const { directory: external, caseDistinct } = prepareCaseSensitiveFixture(externalParent);
    const upperRoot = path.join(external, "Project");
    const lowerRoot = path.join(external, caseDistinct ? "project" : "declared-project");
    fs.mkdirSync(upperRoot);
    fs.mkdirSync(lowerRoot);
    assert.notEqual(realpath(upperRoot), realpath(lowerRoot));
    const upperApi = path.join(upperRoot, "Api");
    const lowerApi = path.join(upperRoot, caseDistinct ? "api" : "declared-api");
    fs.mkdirSync(upperApi);
    fs.mkdirSync(lowerApi);
    assert.notEqual(realpath(upperApi), realpath(lowerApi));

    const upperExact = path.join(upperRoot, "nested", "evidence.md");
    const lowerExact = path.join(lowerRoot, "nested", "evidence.md");
    const upperGlob = path.join(upperApi, "**", "*.json");
    const lowerGlob = path.join(lowerApi, "**", "*.json");
    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
      watchDirectoryThroughFsWatch,
    );
    const changes: WatchInputChange[] = [];
    let liveRoots: readonly string[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [source],
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
        onTopologyChange: () => {
          throw new Error("external inputs must not alter compiler membership");
        },
      },
      openDirectoryWatch,
      openFileWatch,
      fs.readdirSync,
      () => {
        assert.fail("positional inputs must not query compiler membership");
      },
    );
    subscriptions.set(topology, watchers);
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [upperExact, lowerExact],
        globs: [upperGlob, lowerGlob],
      });
      assert.deepEqual(
        liveRoots,
        [realpath(upperRoot), realpath(lowerRoot)].sort(),
      );

      await writeAndWait(topology, changes, upperExact, "upper\n");
      await writeAndWait(topology, changes, lowerExact, "lower\n");
      const upperJson = path.join(upperApi, "openapi.json");
      const lowerJson = path.join(lowerApi, "openapi.json");
      await writeAndWait(topology, changes, upperJson, "{}\n");
      await writeAndWait(topology, changes, lowerJson, "{}\n");

      topology.setProjectInputs({
        root,
        files: [upperExact, lowerExact],
        globs: [upperGlob],
      });
      const count = changes.length;
      fs.writeFileSync(lowerJson, '{"removed":true}\n', "utf8");
      notify(topology, lowerJson, false);
      await delay();
      assert.equal(changes.length, count, JSON.stringify(changes.slice(count)));
    } finally {
      topology.close();
      assert.ok(watchers.every((watcher) => watcher.active === false));
    }
  };

const subscriptions = new WeakMap<WatchTopology, readonly IRecordedWatcher[]>();

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
