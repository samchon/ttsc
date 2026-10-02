import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { normalizeGraphInputObservation } from "../../../../../packages/unplugin/src/core/transform/envelope/normalizeGraphInputObservation";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { trackedInputScope } from "../../../../../packages/unplugin/src/core/transform/tracker/trackedInputScope";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies combined compiler observations keep every relevant notification
 * and acquire directory watches only for actual directories.
 *
 * Empty entry lists do not establish directory kind. A successful file read
 * still depends on its contents; a failed read beside a real directory list
 * retains the list's direct-child dependency. An unknown mixed observation
 * must preserve uncertainty through actual watch admission, including when
 * supplied kind classification fails.
 *
 * 1. Normalize four compatible literal predicate combinations over real files.
 * 2. Construct the owning tracker with the derived scope and supplied watches.
 * 3. Assert file content, directory child rename and uncertainty boundaries,
 *    including the directory listing's adjacent own-content negative.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises normalizeGraphInputObservation, trackedInputScope and createHostInputMutationTracker together, then delivers callbacks through the exact directory subscriptions they acquire. Changes and membership flags distinguish lost file reads, lost child notifications and invalid file-as-directory admission.
 * @evidence contracts/testing.md#independent-expectations Literal read/list predicates express independent compiler dependencies; Node SHA-256 supplies the authored file hash and native stat restricts the supplied watch to directories. Exact changed paths and membership booleans follow event meaning, not a generated scope snapshot.
 * @evidence contracts/testing.md#distinguishing-cases Successful read plus empty listing must hear own content. Failed read plus nonempty directory listing hears direct-child rename but ignores directory own content. Failed read plus empty listing with unknown recorded kind must still admit a child rename. A supplied stat failure additionally requires recursive coverage of a nested child while native identity checks stay available; no failed read or stat is fabricated into successful content or absence.
 * @evidence contracts/testing.md#execution-ownership This discoverable source unit owns four sequential rows through existing normalization, scope and filesystem/watch capabilities. Real temporary files support independent metadata; callbacks are authored and no native watcher, compiler, process or host is started. Finally closes each acquired handle.
 */
export async function test_combined_input_observations_preserve_watch_dependencies(): Promise<void> {
  const root = fs.realpathSync.native(TestProject.createProject({
    "input.txt": "observed bytes\n",
    "listed/child.txt": "child\n",
    "unknown/child.txt": "child\n",
    "uncertain/deep/child.txt": "child\n",
  }));
  const file = path.join(root, "input.txt");
  const rows = [
    {
      name: "successful read and empty listing",
      input: file,
      observation: {
        readFile: { ok: true, hash: crypto.createHash("sha256").update("observed bytes\n").digest("hex") },
        accessibleEntries: { directories: [], files: [] },
      },
      directory: root,
      event: "change",
      filename: "input.txt",
      mutation: false,
    },
    {
      name: "failed read and nonempty directory listing",
      input: path.join(root, "listed"),
      observation: {
        readFile: { ok: false },
        accessibleEntries: { directories: [], files: ["child.txt"] },
        stat: "directory",
      },
      directory: path.join(root, "listed"),
      event: "rename",
      filename: "child.txt",
      mutation: true,
    },
    {
      name: "failed read and empty listing with unknown kind",
      input: path.join(root, "unknown"),
      observation: {
        readFile: { ok: false },
        accessibleEntries: { directories: [], files: [] },
      },
      directory: path.join(root, "unknown"),
      event: "rename",
      filename: "child.txt",
      mutation: true,
    },
    {
      name: "failed native kind preserves external subtree coverage",
      input: path.join(root, "uncertain"),
      observation: {
        readFile: { ok: false },
        accessibleEntries: { directories: [], files: [] },
      },
      directory: path.join(root, "uncertain"),
      event: "rename",
      filename: path.join("deep", "child.txt"),
      mutation: true,
    },
  ];
  for (const row of rows) {
    const observation = normalizeGraphInputObservation(row.observation);
    assert.ok(observation, `${row.name}: compatible protocol observation`);
    const listeners = new Map<string, (event: string, filename: string | null) => void>();
    const recursiveSubscriptions = new Set<string>();
    const failKind = row.name === "failed native kind preserves external subtree coverage";
    let opened = 0;
    let closed = 0;
    const filesystem = {
      ...DEFAULT_FILESYSTEM_OPERATIONS,
      caseSensitive: () => true,
      stat: (location: string) => {
        if (failKind && location === row.input) {
          throw Object.assign(new Error("authored kind observation failure"), { code: "EIO" });
        }
        return DEFAULT_FILESYSTEM_OPERATIONS.stat(location);
      },
      watch: (directory: string, listener: (event: string, filename: string | null) => void, _onError?: () => void, recursive?: boolean) => {
        assert.equal(fs.statSync(directory).isDirectory(), true, `${row.name}: watch requires directory`);
        listeners.set(directory, listener);
        if (recursive === true) recursiveSubscriptions.add(directory);
        ++opened;
        return { close: () => { ++closed; } };
      },
    };
    const scope = trackedInputScope(row.input, observation, filesystem);
    const tracker = await createHostInputMutationTracker(
      [row.input], filesystem, new Set([row.input]), "all", undefined,
      new Map([[row.input, scope]]),
    );
    try {
      assert.equal(tracker.failed, false, row.name);
      assert.equal(tracker.membershipChanged, false, row.name);
      if (row.name === "failed read and nonempty directory listing") {
        const parent = listeners.get(root);
        assert.ok(parent, "directory replacement subscription");
        parent("change", "listed");
        assert.deepEqual([...tracker.changes], [], "listing is unchanged by directory own-content event");
        assert.equal(tracker.membershipChanged, false);
      }
      const notify = listeners.get(row.directory);
      assert.ok(notify, `${row.name}: actual notification coverage`);
      if (failKind) {
        assert.equal(recursiveSubscriptions.has(row.directory), true, "nested event requires actual recursive subscription");
      }
      notify(row.event, row.filename);
      assert.deepEqual([...tracker.changes], [path.join(row.directory, row.filename)], row.name);
      assert.equal(tracker.membershipChanged, row.mutation, row.name);
    } finally {
      tracker.close();
    }
    assert.equal(closed, opened, `${row.name}: all acquired handles retired`);
  }
}
