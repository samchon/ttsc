import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTrackedInputScope } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscTrackedInputScope";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies repeated native alias notifications are judged against the current
 * target instead of a physical identity memoized by an earlier event.
 *
 * One supplied alternate spelling first selects an observed presence-only
 * directory, then selects an actual content input whose bytes have changed.
 * Every native path-consuming operation follows that same current mapping.
 *
 * 1. Open a tracker with independently authored presence and content scopes.
 * 2. Deliver the alias's directory content notice and require a quiet verdict.
 * 3. Retarget the supplied native alias, edit actual input bytes and deliver
 *    the same name again; require a content witness or explicit uncertainty.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual createHostInputMutationTracker classifies two callbacks for the same alternate native spelling. The first presence-only own-content event stays quiet; the second must preserve the changed content input's witness or withdraw notification authority, rather than reuse the first event's identity.
 * @evidence contracts/testing.md#independent-expectations A literal current alias mapping shared by exists/lstat/stat/statBigInt/readFile/readdir/realpath and real before/after file bytes establish each event's meaning. Exact quiet state and literal witness-or-unverified alternatives follow supported scope and uncertainty contracts without reading private maps.
 * @evidence contracts/testing.md#distinguishing-cases Same name and event kind contrast across a directory presence dependency and a changed file content dependency. The adjacent first-event negative prevents blanket mutation; custom-watch contentAuthoritative=false remains unchanged, and no generation or tracker authority is planted to force the result.
 * @evidence contracts/testing.md#execution-ownership One direct source entry calls the real tracker through its maintained filesystem/watch seam over actual temporary corpus files. This is an authored native alias view, not a real platform alias reproduction. One directory callback is supplied and every acquired handle is closed in finally; no native watcher, compiler, process or host is started.
 */
export async function test_host_input_tracker_rechecks_retargeted_event_aliases(): Promise<void> {
  const root = fs.realpathSync.native(TestProject.createProject({
    "presence/kept.txt": "directory remains present\n",
    "content.txt": "before\n",
  }));
  const directory = path.join(root, "presence");
  const file = path.join(root, "content.txt");
  const alias = path.join(root, "EVENTALIAS");
  let target = directory;
  const native = (location: string): string => location === alias ? target : location;
  let notify: ((eventType: string, filename: string | null) => void) | undefined;
  let opened = 0;
  let closed = 0;
  const filesystem = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    caseSensitive: () => true,
    exists: (location: string) => fs.existsSync(native(location)),
    lstat: (location: string) => fs.lstatSync(native(location), { bigint: true }),
    readFile: (location: string) => fs.readFileSync(native(location)),
    readdir: (location: string) => fs.readdirSync(native(location), { withFileTypes: true }),
    realpath: (location: string) => fs.realpathSync.native(native(location)),
    stat: (location: string) => fs.statSync(native(location)),
    statBigInt: (location: string) => fs.statSync(native(location), { bigint: true }),
    watch: (location: string, listener: (eventType: string, filename: string | null) => void) => {
      assert.equal(location, root, "both exact inputs share one parent subscription");
      notify = listener;
      ++opened;
      return { close: () => { ++closed; } };
    },
  };
  const tracker = await createHostInputMutationTracker(
    [directory, file], filesystem, new Set([directory, file]), "all", undefined,
    new Map<string, TtscTrackedInputScope>([[directory, "presence"], [file, "content"]]),
  );
  try {
    assert.equal(tracker.failed, false);
    assert.equal(tracker.contentAuthoritative, false);
    assert.ok(notify);
    assert.equal(filesystem.realpath(alias), directory);
    notify("change", "EVENTALIAS");
    assert.deepEqual([...tracker.changes], [], "presence-only content notice stays quiet");
    assert.equal(tracker.unverified, undefined);
    assert.equal(tracker.membershipChanged, false);
    target = file;
    fs.writeFileSync(file, "after\n");
    assert.equal(filesystem.realpath(alias), file);
    assert.equal(filesystem.readFile(alias).toString(), "after\n");
    notify("change", "EVENTALIAS");
    assert.equal(tracker.membershipChanged, false, "content edit is not membership mutation");
    assert.equal(tracker.contentAuthoritative, false);
    if (tracker.changes.size === 0) {
      assert.equal(tracker.unverified, true, "without a content witness, native uncertainty must withdraw authority");
    } else {
      assert.deepEqual([...tracker.changes], [alias], "current native content target must produce a witness");
    }
  } finally {
    tracker.close();
  }
  assert.equal(opened, 1);
  assert.equal(closed, 1);
}
