import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies an exact-input tracker withdraws alias-event authority in a Linux
 * filesystem view when the changed native target can no longer be resolved.
 *
 * The explicit POSIX view maps long and short names to one real temporary
 * file. Its deletion removes both spellings before the alias event arrives,
 * so current realpath cannot recover the old relationship. This models native
 * naming uncertainty without mounting VFAT or claiming a real kernel event.
 *
 * 1. Open the real tracker over a fully supplied Linux alias filesystem view.
 * 2. Remove its actual file and deliver the old short-name rename callback.
 * 3. Require unverified authority without inventing a positive membership
 *    mutation, then close the acquired watch once.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual createHostInputMutationTracker must withdraw notification authority after an unresolved ASCII alias rename in a coherent supplied Linux filesystem view.
 * @evidence contracts/testing.md#independent-expectations A literal two-name mapping and real file deletion independently establish the lost native relationship. Literal unverified=true requires reproof; the actual constructor's initial false membership flag must remain distinct from uncertainty.
 * @evidence contracts/testing.md#distinguishing-cases Healthy initial exact-input coverage contrasts with alias notification after both names become absent. The injected watch has no native content authority; no private generation state is changed to manufacture it.
 * @evidence contracts/testing.md#execution-ownership The source unit calls the actual tracker through existing filesystem and watch capabilities. POSIX parsing and every native path-consuming observation translate through the same explicit view; no process.platform, global fs method, real watcher, native Linux mount or compiler runs or changes.
 */
export async function test_host_input_tracker_withdraws_alias_authority_in_a_linux_view(): Promise<void> {
  const nativeRoot = TestProject.createProject({ "LongConfig.config": "before\n" });
  const nativeFile = path.join(nativeRoot, "LongConfig.config");
  const root = "/project";
  const input = "/project/LongConfig.config";
  const native = (location: string): string => {
    const normalized = path.posix.resolve(location).toLowerCase();
    if (normalized === root) return nativeRoot;
    if (normalized === "/project/longconfig.config" || normalized === "/project/longco~1.con") return nativeFile;
    throw Object.assign(new Error("absent authored view path"), { code: "ENOENT" });
  };
  let notify: ((eventType: string, filename: string | null) => void) | undefined;
  let closed = 0;
  const tracker = await createHostInputMutationTracker([input], {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    platform: "linux",
    caseSensitive: () => false,
    exists: (location) => { try { return fs.existsSync(native(location)); } catch { return false; } },
    lstat: (location) => fs.lstatSync(native(location), { bigint: true }),
    readFile: (location) => fs.readFileSync(native(location)),
    readdir: (location) => fs.readdirSync(native(location), { withFileTypes: true }),
    realpath: (location) => {
      const resolved = fs.realpathSync.native(native(location));
      return resolved === fs.realpathSync.native(nativeRoot) ? root : input;
    },
    stat: (location) => fs.statSync(native(location)),
    statBigInt: (location) => fs.statSync(native(location), { bigint: true }),
    watch: (_directory, listener) => {
      notify = listener;
      return { close: () => { ++closed; } };
    },
  }, new Set([input]));
  try {
    assert.equal(tracker.failed, false);
    assert.equal(tracker.contentAuthoritative, false);
    assert.equal(tracker.unverified, undefined);
    assert.ok(notify);
    fs.rmSync(nativeFile);
    notify("rename", "LONGCO~1.CON");
    assert.equal(tracker.unverified, true);
    assert.equal(tracker.membershipChanged, false);
  } finally {
    tracker.close();
  }
  assert.equal(closed, 1);
}
