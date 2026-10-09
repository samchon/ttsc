import { waitFor } from "../../../../utils/src/internal/waitFor";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { literalGlobRoot } from "../../../../../packages/ttsc/src/launcher/internal/watch/literalGlobRoot";
import { projectInputActiveWatchDirectories } from "../../../../../packages/ttsc/src/launcher/internal/watch/projectInputActiveWatchDirectories";
import { projectInputEventShouldNotify } from "../../../../../packages/ttsc/src/launcher/internal/watch/projectInputEventShouldNotify";
import { projectInputWatchDirectories } from "../../../../../packages/ttsc/src/launcher/internal/watch/projectInputWatchDirectories";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies missing project members and ancestor subscriptions stay semantically
 * live.
 *
 * Recorded source-adapter events drive actual config, glob, fingerprint and
 * subscription ownership decisions. The positional compiler source uses no
 * native reader; existing physical E2E boundaries own uncontrolled delivery.
 *
 * 1. Stage ancestor/descendant declarations and require promotion after removal.
 * 2. Create, edit and replace missing exact/glob inputs and reject unrelated
 *    products.
 * 3. Replace declarations and require removed inputs and retired paths to stay
 *    quiet.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: declared project inputs stay live before any matching file exists. 1. Stage nested external roots and prove only their ancestor stays active. 2. Remove the ancestor declaration and prove the retained child is promoted. 3. Create and edit missing exact and glob inputs. 4. Replace the snapshot and prove removed and unrelated paths stay quiet.
 * @evidence contracts/testing.md#independent-expectations Authored declared input paths, glob roots and file lifecycle steps establish which events must be reported and which must stay quiet; literal project-lane counts, independently expected watcher-root paths and quiet negative twins (removed declarations, unrelated products, retired paths) enforce those roles rather than snapshotting topology output. Exact notification-path attribution is owned by the separate reconciled-project-change unit.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts: a covered descendant stays under its ancestor watcher until the ancestor declaration is removed, then is promoted; a missing exact file and an empty glob wake only once a matching file appears, while README.md, an unrelated .tmp file and the declared path under the compiler outDir stay quiet; a same-bytes event stays quiet while changed declared content wakes; after the declaration is replaced, the removed missing.md and the renamed directory's retired watcher stay quiet while the new next.md wakes.
 * @evidence contracts/testing.md#execution-ownership Actual source topology, literal-glob roots, active directory planning and event predicates execute with recorded source subscriptions. The positional compiler-input provider throws if reached. Every original root, lifecycle, quiet, event-lane and cleanup assertion remains; no compiler or native observer runs.
 */
export const test_watch_topology_tracks_declared_missing_files_and_empty_globs =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-project-input-watch-"),
    );
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          incremental: true,
          outDir: "dist",
          outFile: "api/bundle.json",
          rootDir: "src",
          tsBuildInfoFile: "api/state.json",
        },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    const watchFailures: unknown[] = [];
    let projectInputWatchRoots: readonly string[] = [];
    const observed = recordWatchers(watchDirectoryThroughFsWatch);
    const write = (
      location: string,
      bytes: string,
      encoding?: BufferEncoding,
    ): void => {
      fs.writeFileSync(location, bytes, encoding);
      deliverWatchEvent(observed.watchers, location, "rename");
    };
    const rename = async (source: string, target: string): Promise<void> => {
      await TestProject.rename(source, target);
      deliverWatchEvent(observed.watchers, source, "rename");
      deliverWatchEvent(observed.watchers, target, "rename");
    };
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [source],
        outDir: path.join(root, "dist"),
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (location, error) => {
          watchFailures.push(new Error(`watch error on ${location}`, { cause: error }));
        },
        onInputChange: (change) => changes.push(change),
        onProjectInputWatchRoots: (roots) => {
          projectInputWatchRoots = [...roots];
        },
        onTopologyChange: () => {
          throw new Error("external inputs must not alter compiler membership");
        },
      },
      observed.openDirectoryWatch,
      observed.openFileWatch,
      fs.readdirSync,
      () => {
        throw new Error(
          "positional input units must not list compiler members",
        );
      },
    );
    try {
      topology.refresh(false);
      const stagedRoot = TestProject.physicalPath(
        TestProject.tmpdir("ttsc-project-input-staged-anchor-"),
      );
      const stagedAncestorFile = path.join(stagedRoot, "a", "one.md");
      const stagedDescendantFile = path.join(stagedRoot, "a", "b", "two.md");
      topology.setProjectInputs({
        root,
        files: [stagedAncestorFile],
        globs: [],
      });
      fs.mkdirSync(path.dirname(stagedDescendantFile), { recursive: true });
      write(stagedDescendantFile, "initial\n", "utf8");
      await delay();
      topology.setProjectInputs({
        root,
        files: [stagedAncestorFile, stagedDescendantFile],
        globs: [],
      });
      const stagedAncestorRoots = projectInputWatchDirectories(
        path.dirname(stagedAncestorFile),
        root,
      );
      const stagedDescendantRoots = projectInputWatchDirectories(
        path.dirname(stagedDescendantFile),
        root,
      );
      assert.deepEqual(
        projectInputActiveWatchDirectories([
          ...stagedAncestorRoots,
          ...stagedDescendantRoots,
        ]),
        [stagedRoot],
        "a recursive ancestor must cover its retained descendant root",
      );
      assert.deepEqual(
        projectInputWatchRoots,
        [realpath(stagedRoot)],
        "the live watcher map must contain only the covering ancestor",
      );
      await delay();
      let previousProjectChanges = projectChangeCount(changes);
      write(stagedDescendantFile, "covered edit\n", "utf8");
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);
      topology.setProjectInputs({
        root,
        files: [stagedDescendantFile],
        globs: [],
      });
      assert.deepEqual(
        projectInputWatchRoots,
        [realpath(path.join(stagedRoot, "a"))],
        "the live watcher map must promote the retained child",
      );
      assert.deepEqual(
        projectInputActiveWatchDirectories(stagedDescendantRoots),
        [path.join(stagedRoot, "a")],
        "the retained descendant root must become active on its own",
      );
      await delay();
      previousProjectChanges = projectChangeCount(changes);
      write(stagedDescendantFile, "promoted edit\n", "utf8");
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);

      const externalRoot = TestProject.physicalPath(
        TestProject.tmpdir("ttsc-project-input-anchor-"),
      );
      const externalFile = path.join(
        externalRoot,
        "missing",
        "nested",
        "external.md",
      );
      topology.setProjectInputs({
        root,
        files: [
          path.join(root, "docs", "nested", "missing.md"),
          path.join(root, "dist", "src", "main.js"),
          externalFile,
        ],
        globs: [
          path.join(root, "api", "**", "*.json"),
          path.join(root, "dist", "**", "*.json"),
        ],
      });
      assert.deepEqual(
        projectInputWatchDirectories(
          path.dirname(path.join(root, "docs", "nested", "missing.md")),
          root,
        ),
        [root],
        "an internal declaration must use one stable project-root handle",
      );
      assert.deepEqual(
        projectInputWatchDirectories(path.dirname(externalFile), root),
        [externalRoot],
        "a missing external tree must use one nearest-ancestor handle",
      );

      if (process.platform === "win32") {
        const volumeRoot = path.parse(root).root;
        assert.equal(
          literalGlobRoot(path.join(volumeRoot, "**", "*.json")),
          volumeRoot,
          "a drive-root glob must not resolve through the drive's current directory",
        );
      }
      previousProjectChanges = projectChangeCount(changes);
      fs.mkdirSync(path.dirname(externalFile), { recursive: true });
      write(externalFile, "external\n", "utf8");
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);

      const beforeReadme = changes.length;
      write(path.join(root, "README.md"), "unrelated\n", "utf8");
      await waitForQuiet(changes, beforeReadme);

      assert.equal(
        projectInputEventShouldNotify({
          contentChanged: false,
          directlyMatched: true,
          membershipChanged: false,
        }),
        false,
        "a same-bytes event for a declared path must stay quiet",
      );
      assert.equal(
        projectInputEventShouldNotify({
          contentChanged: false,
          directlyMatched: false,
          membershipChanged: false,
        }),
        false,
        "a filename-less event with unchanged inputs must stay quiet",
      );
      assert.equal(
        projectInputEventShouldNotify({
          contentChanged: true,
          directlyMatched: false,
          membershipChanged: false,
        }),
        true,
        "a filename-less event with changed declared content must wake",
      );

      fs.mkdirSync(path.join(root, "docs", "nested"), { recursive: true });
      await delay();
      previousProjectChanges = projectChangeCount(changes);
      write(
        path.join(root, "docs", "nested", "missing.md"),
        "declared\n",
        "utf8",
      );
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);

      fs.mkdirSync(path.join(root, "api", "v1"), { recursive: true });
      await delay();
      previousProjectChanges = projectChangeCount(changes);
      write(path.join(root, "api", "v1", "openapi.json"), "{}\n");
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);

      const beforeUnrelated = changes.length;
      write(path.join(root, "unrelated.tmp"), "unrelated\n");
      await waitForQuiet(changes, beforeUnrelated);
      previousProjectChanges = projectChangeCount(changes);
      write(path.join(root, "api", "v1", "openapi.json"), '{"changed":true}\n');
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);

      const movedDocs = path.join(root, "docs-old");
      const replacementDocs = path.join(root, "docs-new");
      fs.mkdirSync(path.join(replacementDocs, "nested"), { recursive: true });
      const beforeReplacementPreparation = changes.length;
      write(
        path.join(replacementDocs, "nested", "missing.md"),
        "replacement\n",
        "utf8",
      );
      await waitForQuiet(changes, beforeReplacementPreparation);
      previousProjectChanges = projectChangeCount(changes);
      await rename(path.join(root, "docs"), movedDocs);
      await rename(replacementDocs, path.join(root, "docs"));
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);
      previousProjectChanges = projectChangeCount(changes);
      write(
        path.join(root, "docs", "nested", "missing.md"),
        "replacement edit\n",
        "utf8",
      );
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);
      await delay();
      const afterReplacement = projectChangeCount(changes);
      write(
        path.join(movedDocs, "nested", "missing.md"),
        "orphaned watcher\n",
        "utf8",
      );
      await delay();
      assert.equal(
        projectChangeCount(changes),
        afterReplacement,
        "the watcher for the renamed directory must be retired",
      );

      const movedApi = path.join(root, "api-old");
      previousProjectChanges = projectChangeCount(changes);
      await rename(path.join(root, "api"), movedApi);
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);
      fs.mkdirSync(path.join(root, "api", "v1"), { recursive: true });
      await delay();
      previousProjectChanges = projectChangeCount(changes);
      write(path.join(root, "api", "v1", "replacement.json"), "{}\n");
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);

      fs.mkdirSync(path.join(root, "dist", "src"), { recursive: true });
      const beforeProduct = changes.length;
      write(path.join(root, "dist", "src", "main.js"), "export {};\n");
      await waitForQuiet(changes, beforeProduct);

      topology.setProjectInputs({
        root,
        files: [path.join(root, "docs", "nested", "next.md")],
        globs: [],
      });
      const beforeRemoved = changes.length;
      write(
        path.join(root, "docs", "nested", "missing.md"),
        "removed\n",
        "utf8",
      );
      await waitForQuiet(changes, beforeRemoved);
      previousProjectChanges = projectChangeCount(changes);
      write(path.join(root, "docs", "nested", "next.md"), "next\n", "utf8");
      await waitForNextProjectChange(changes, previousProjectChanges, watchFailures);

      assert.equal(watchFailures.length, 0, "source watch callbacks must preserve their actual failures");
      const foreign = changes.filter((change) => change.kind !== "project");
      assert.deepEqual(
        foreign,
        [],
        "external data must never reach the compiler or reload lanes",
      );
    } finally {
      topology.close();
      assert.ok(observed.watchers.every((watcher) => watcher.active === false));
    }
  };

async function waitForNextProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
  failures: readonly unknown[],
): Promise<void> {
  await waitFor(() => projectChangeCount(changes) > previous, "actual project change", {
    check: () => {
      if (failures.length !== 0) throw new AggregateError(failures, "source watch operation failed");
    },
  });
  await delay();
}

function projectChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

async function waitForQuiet(
  changes: readonly WatchInputChange[],
  previous: number,
): Promise<void> {
  const count = changes.length;
  await delay();
  assert.equal(changes.length, count, JSON.stringify(changes.slice(count)));
  assert.equal(
    changes.length,
    previous,
    JSON.stringify(changes.slice(previous)),
  );
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function realpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}
