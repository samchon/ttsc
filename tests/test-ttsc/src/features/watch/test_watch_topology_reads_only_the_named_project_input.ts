import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a named project-input notification reads the named file's bytes and
 * only the files whose metadata moved, while a notification naming nothing
 * reads every file (samchon/ttsc#1748).
 *
 * Every project-input notification hashed every matched file, so one edit read
 * the whole declared population once per notification.
 *
 * 1. Rewrite one document with equal size and restored times, then deliver a
 *    notification naming another, edited document: only the edited one is
 *    reported, because the rewritten one was not read.
 * 2. Deliver a notification naming the rewritten document: its bytes are read and
 *    it is reported.
 * 3. Rewrite a document the same way and deliver a notification that names
 *    nothing: every file is read and the rewrite is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual WatchTopology decides recorded notifications over real files; the reported project changes show which bytes were read.
 * @evidence contracts/testing.md#independent-expectations The authored rewrites keep size and times equal, so only a byte read can reveal them.
 * @evidence contracts/testing.md#distinguishing-cases A notification naming another file, one naming the rewritten file and one naming nothing are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its temporary project and recorded watchers; the compiler-input operation is supplied, so no compiler or OS subscription starts.
 */
export async function test_watch_topology_reads_only_the_named_project_input(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-named-project-input-"),
  );
  const docs = path.join(root, "docs");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(root, "src", "main.ts"), "export const a = 1;\n");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { noEmit: true }, include: ["src"] }),
  );
  const edited = path.join(docs, "edited.md");
  const rewritten = path.join(docs, "rewritten.md");
  const fixed = new Date("2020-01-02T03:04:05.000Z");
  for (const file of [edited, rewritten]) {
    fs.writeFileSync(file, "before\n");
    fs.utimesSync(file, fixed, fixed);
  }
  const rewrite = (file: string): void => {
    fs.writeFileSync(file, "BEFORE\n");
    fs.utimesSync(file, fixed, fixed);
  };

  const changes: WatchInputChange[] = [];
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
      onInputChange: (change) => changes.push(change),
      onTopologyChange: () => undefined,
    },
    recorder.openDirectoryWatch,
    recorder.openFileWatch,
    fs.readdirSync,
    () => [path.join(root, "src", "main.ts")],
  );
  const reported = () =>
    changes.flatMap((change) =>
      change.kind === "project" && change.path !== undefined
        ? [path.basename(change.path)]
        : [],
    );
  try {
    topology.refresh(false);
    topology.setProjectInputs({
      files: [edited, rewritten],
      globs: [],
      reloadDirectories: [],
      reloadFiles: [],
      root,
    });
    await settleWatchEvents();
    changes.length = 0;

    rewrite(rewritten);
    fs.writeFileSync(edited, "after, longer\n");
    deliverWatchEvent(recorder.watchers, edited, "change");
    await settleWatchEvents();
    assert.deepEqual(reported(), ["edited.md"], "only the named file is read");

    changes.length = 0;
    deliverWatchEvent(recorder.watchers, rewritten, "change");
    await settleWatchEvents();
    assert.deepEqual(reported(), ["rewritten.md"], "the named file is read");

    changes.length = 0;
    fs.writeFileSync(edited, "AFTER, LONGER\n");
    fs.utimesSync(edited, fixed, fixed);
    const observers = recorder.watchers.filter((entry) => {
      const relative = path.relative(entry.location, edited);
      return (
        entry.active && !relative.startsWith("..") && !path.isAbsolute(relative)
      );
    });
    assert.notEqual(observers.length, 0, "a watcher observes the documents");
    for (const observer of observers)
      observer.listener("change", null as unknown as string);
    await settleWatchEvents();
    assert.ok(
      changes.some((change) => change.kind === "project"),
      `a notification naming nothing reads every file: ${JSON.stringify(changes)}`,
    );
  } finally {
    topology.close();
  }
  assert.ok(recorder.watchers.every((watcher) => !watcher.active));
}
