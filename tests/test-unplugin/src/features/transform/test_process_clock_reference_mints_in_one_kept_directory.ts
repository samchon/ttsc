import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { filesystemClockReferences } from "../../../../../packages/unplugin/src/core/transform/clock/filesystemClockReferences";
import { refreshProcessClockReference } from "../../../../../packages/unplugin/src/core/transform/clock/refreshProcessClockReference";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/src/core/transform/filesystem/TtscTransformFilesystemOperations";
import { userStateDirectory } from "../../../../../packages/unplugin/src/core/transform/filesystem/userStateDirectory";

/**
 * Verifies a proof that holds no generation mints its clock reference in the
 * one probe directory its process keeps, outside the project, and keeps no
 * older reference when that directory would lie inside the proof's root.
 *
 * A failed generation's replay, a record's proof at a build start, and the
 * observer's proof of a plugin source run at any moment, beside compiles that
 * read the metadata of the directories around them: the absence of a
 * `package.json` in the temporary directory is proven by that directory's own
 * metadata holding still while a plugin descriptor is evaluated. A mint that
 * created and removed a directory there per proof moved that metadata, so it
 * mints in one directory per process below this user's state root, named by the
 * process id, created once and rewritten in place
 * (`refreshProcessClockReference`). A reference kept from an earlier proof
 * while the directory cannot serve would still let a signature stand for
 * content, the very trust a rollback defeats, so the references are cleared.
 *
 * 1. Mint twice through a filesystem that records every path it states, and assert
 *    both probes are the same file, in this process's directory below the state
 *    root, outside the project, and that the directory is kept.
 * 2. Mint for a root that holds the state root, and assert no reference is left,
 *    the earlier one included.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls refreshProcessClockReference through counted lstat operations; asserts two mints rewrite one process-owned probe outside the project and a root enclosing the state directory clears even an earlier reference.
 * @evidence contracts/testing.md#independent-expectations A clock proof must avoid mutating the project it proves and must fail closed when no outside probe can exist. Native path relationships and reference count are independent of the refreshed timestamp.
 * @evidence contracts/testing.md#distinguishing-cases Owns repeated valid mints and an enclosing-root refusal with prior state. The supplied filesystem is case-local; the process-owned probe is deliberately retained by production until process exit, beyond TestProject directory cleanup.
 * @evidence contracts/testing.md#execution-ownership Unit test: a synchronous function calls the real refreshProcessClockReference, filesystemClockReferences and userStateDirectory with an lstat-recording copy of the default filesystem, touching a real temporary project and this user's process state directory. No generation, compiler or watcher is involved.
 */
export function test_process_clock_reference_mints_in_one_kept_directory(): void {
  const project = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-process-clock-"),
  );
  const stated: string[] = [];
  const filesystem: TtscTransformFilesystemOperations = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    lstat: (location) => {
      stated.push(path.resolve(location));
      return DEFAULT_FILESYSTEM_OPERATIONS.lstat(location);
    },
  };
  const kept = userStateDirectory(`${process.pid}-clock`);
  assert.ok(kept !== undefined, "this user has a state root");

  // 1. One directory, kept, outside the project.
  refreshProcessClockReference(project, filesystem);
  refreshProcessClockReference(project, filesystem);
  assert.equal(filesystemClockReferences(filesystem).size, 1);
  assert.equal(stated.length, 2, "one probe stated per mint");
  assert.equal(stated[0], stated[1], "both mints rewrite the same probe");
  assert.equal(path.dirname(stated[0]!), kept, "the process's own directory");
  const relative = path.relative(project, stated[0]!);
  assert.ok(
    relative.startsWith("..") || path.isAbsolute(relative),
    "the probe lies outside the project",
  );
  assert.equal(fs.statSync(kept).isDirectory(), true, "the directory is kept");

  // 2. A root holding the directory: no reference, the earlier one included.
  refreshProcessClockReference(fs.realpathSync.native(os.tmpdir()), filesystem);
  assert.equal(
    filesystemClockReferences(filesystem).size,
    0,
    "an earlier proof's reference is not kept",
  );
}
