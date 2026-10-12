import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCaseSensitivityObservations } from "../../../../../packages/ttsc/src/internal/pathIdentity/createCaseSensitivityObservations";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies every identity context one watch decision creates shares that
 * decision's directory case observations, and a later decision observes again
 * (samchon/ttsc#1742).
 *
 * A decision built a fresh identity context per declaration, per candidate and
 * per helper, and each asked every directory's case policy again. On Windows a
 * directory whose names carry no ASCII case costs an `fsutil` process per
 * question, and one decision asked the same directory up to seventeen times.
 *
 * 1. Publish project inputs that declare many files of one directory, half of them
 *    not yet created, through a topology whose case observations count each
 *    directory they list.
 * 2. Assert the publication, one synchronous decision, listed the documents
 *    directory exactly once.
 * 3. Publish the same inputs again: that decision lists the directory once more,
 *    through a new observation set, rather than reusing the earlier answer.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual WatchTopology runs its project-input decisions through the real case probe; directory listings counted per publication are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations One listing per directory per decision follows from the sharing contract; the authored declarations fix which directory must be observed.
 * @evidence contracts/testing.md#distinguishing-cases One decision over many declarations and a later decision over the same declarations are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its temporary project and recorded watchers; the compiler-input operation is supplied, so no compiler or OS subscription starts.
 */
export async function test_watch_topology_shares_case_observations_within_a_decision(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-case-observations-"),
  );
  const docs = path.join(root, "docs");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(root, "src", "main.ts"), "export const a = 1;\n");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { noEmit: true }, include: ["src"] }),
  );
  // Declared files that do not exist yet are resolved below their nearest
  // existing directory, whose case policy decides their spelling.
  const files = Array.from({ length: 12 }, (_, index) => {
    const file = path.join(docs, `doc-${index}.md`);
    if (index % 2 === 0) fs.writeFileSync(file, `# ${index}\n`);
    return file;
  });

  const listings: Map<string, number>[] = [];
  const recorder = recordWatchers(watchDirectoryThroughFsWatch);
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
      onInputChange: () => undefined,
      onTopologyChange: () => undefined,
    },
    recorder.openDirectoryWatch,
    recorder.openFileWatch,
    fs.readdirSync,
    () => [path.join(root, "src", "main.ts")],
    () => {
      const listed = new Map<string, number>();
      listings.push(listed);
      return createCaseSensitivityObservations({
        readdir: (directory) => {
          const key = path.resolve(directory);
          listed.set(key, (listed.get(key) ?? 0) + 1);
          return fs.readdirSync(directory);
        },
      });
    },
  );
  const inputs = {
    files,
    globs: [],
    reloadDirectories: [],
    reloadFiles: [],
    root,
  };
  const docsListings = () =>
    listings.reduce(
      (total, listed) => total + (listed.get(path.resolve(docs)) ?? 0),
      0,
    );
  try {
    topology.refresh(false);
    await settleWatchEvents();
    const sets = listings.length;
    const before = docsListings();
    topology.setProjectInputs(inputs);
    assert.equal(
      docsListings() - before,
      1,
      "one decision lists the documents directory once",
    );
    await settleWatchEvents();

    const again = docsListings();
    topology.setProjectInputs({ ...inputs, files: [...files] });
    assert.equal(
      docsListings() - again,
      1,
      "a later decision lists the directory again",
    );
    assert.ok(listings.length > sets + 1, "each decision has its own set");
  } finally {
    topology.close();
  }
  assert.ok(recorder.watchers.every((watcher) => !watcher.active));
}
