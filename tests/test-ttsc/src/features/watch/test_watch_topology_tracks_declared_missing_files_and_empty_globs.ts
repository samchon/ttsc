import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
  literalGlobRoot,
  projectInputEventShouldNotify,
  projectInputWatchDirectories,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies declared project inputs stay live before any matching file exists.
 *
 * Project rules commonly derive exact Markdown paths and Swagger glob
 * populations from config. The watch topology must observe later creates and
 * edits without rebuilding for unrelated files or compiler outputs.
 *
 * 1. Publish one missing file, one zero-match glob, and one output glob.
 * 2. Create and edit the declared inputs, asserting one project wake-up each.
 * 3. Replace the snapshot and prove removed and unrelated paths stay quiet.
 */
export const test_watch_topology_tracks_declared_missing_files_and_empty_globs =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-project-input-watch-");
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
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
        onTopologyChange: () => {
          throw new Error("external inputs must not alter compiler membership");
        },
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [path.join(root, "docs", "missing.md")],
        globs: [
          path.join(root, "api", "**", "*.json"),
          path.join(root, "dist", "**", "*.json"),
        ],
      });

      if (process.platform === "win32") {
        const volumeRoot = path.parse(root).root;
        assert.equal(
          literalGlobRoot(path.join(volumeRoot, "**", "*.json")),
          volumeRoot,
          "a drive-root glob must not resolve through the drive's current directory",
        );
      }
      const externalRoot = TestProject.tmpdir("ttsc-project-input-anchor-");
      const missingExternalTarget = path.join(
        externalRoot,
        "missing",
        "nested",
      );
      assert.deepEqual(
        projectInputWatchDirectories(
          missingExternalTarget,
          path.dirname(missingExternalTarget),
        ),
        [externalRoot, path.dirname(externalRoot)],
        "an unreachable missing-path anchor must not expand to the volume root",
      );

      fs.writeFileSync(path.join(root, "README.md"), "unrelated\n", "utf8");
      await waitForQuiet(changes);

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

      fs.mkdirSync(path.join(root, "docs"));
      await delay();
      let previousProjectChanges = projectChangeCount(changes);
      fs.writeFileSync(
        path.join(root, "docs", "missing.md"),
        "declared\n",
        "utf8",
      );
      await waitForNextProjectChange(changes, previousProjectChanges);

      fs.mkdirSync(path.join(root, "api", "v1"), { recursive: true });
      await delay();
      previousProjectChanges = projectChangeCount(changes);
      fs.writeFileSync(path.join(root, "api", "v1", "openapi.json"), "{}\n");
      await waitForNextProjectChange(changes, previousProjectChanges);

      fs.writeFileSync(path.join(root, "api", "state.json"), "{}\n");
      fs.writeFileSync(path.join(root, "api", "bundle.json"), "{}\n");
      await waitForQuiet(changes);

      previousProjectChanges = projectChangeCount(changes);
      fs.writeFileSync(path.join(root, "unrelated.tmp"), "unrelated\n");
      fs.writeFileSync(
        path.join(root, "api", "v1", "openapi.json"),
        '{"changed":true}\n',
      );
      await waitForNextProjectChange(changes, previousProjectChanges);

      const movedDocs = path.join(root, "docs-old");
      const replacementDocs = path.join(root, "docs-new");
      fs.mkdirSync(replacementDocs);
      fs.writeFileSync(
        path.join(replacementDocs, "missing.md"),
        "replacement\n",
        "utf8",
      );
      await waitForQuiet(changes);
      previousProjectChanges = projectChangeCount(changes);
      fs.renameSync(path.join(root, "docs"), movedDocs);
      fs.renameSync(replacementDocs, path.join(root, "docs"));
      await waitForNextProjectChange(changes, previousProjectChanges);
      previousProjectChanges = projectChangeCount(changes);
      fs.writeFileSync(
        path.join(root, "docs", "missing.md"),
        "replacement edit\n",
        "utf8",
      );
      await waitForNextProjectChange(changes, previousProjectChanges);
      await delay();
      const afterReplacement = projectChangeCount(changes);
      fs.writeFileSync(
        path.join(movedDocs, "missing.md"),
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
      fs.renameSync(path.join(root, "api"), movedApi);
      await waitForNextProjectChange(changes, previousProjectChanges);
      fs.mkdirSync(path.join(root, "api", "v1"), { recursive: true });
      await delay();
      previousProjectChanges = projectChangeCount(changes);
      fs.writeFileSync(
        path.join(root, "api", "v1", "replacement.json"),
        "{}\n",
      );
      await waitForNextProjectChange(changes, previousProjectChanges);

      fs.mkdirSync(path.join(root, "dist"), { recursive: true });
      fs.writeFileSync(path.join(root, "dist", "generated.json"), "{}\n");
      await waitForQuiet(changes);

      topology.setProjectInputs({
        root,
        files: [path.join(root, "docs", "next.md")],
        globs: [],
      });
      fs.writeFileSync(
        path.join(root, "docs", "missing.md"),
        "removed\n",
        "utf8",
      );
      await waitForQuiet(changes);
      previousProjectChanges = projectChangeCount(changes);
      fs.writeFileSync(path.join(root, "docs", "next.md"), "next\n", "utf8");
      await waitForNextProjectChange(changes, previousProjectChanges);

      assert.equal(
        changes.every((change) => change.kind === "project"),
        true,
      );
    } finally {
      topology.close();
    }
  };

async function waitForNextProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (projectChangeCount(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(`expected a project change after ${previous}`);
    }
    await delay(25);
  }
  await delay();
}

function projectChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

async function waitForQuiet(
  changes: readonly WatchInputChange[],
): Promise<void> {
  const count = changes.length;
  await delay();
  assert.equal(changes.length, count, JSON.stringify(changes.slice(count)));
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
