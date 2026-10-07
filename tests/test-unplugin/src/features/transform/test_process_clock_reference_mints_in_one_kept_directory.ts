import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { filesystemClockReferences } from "../../../../../packages/unplugin/src/core/transform/clock/filesystemClockReferences";
import { refreshProcessClockReference } from "../../../../../packages/unplugin/src/core/transform/clock/refreshProcessClockReference";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/src/core/transform/filesystem/TtscTransformFilesystemOperations";
import { userStateDirectory } from "../../../../../packages/unplugin/src/core/transform/filesystem/userStateDirectory";
import { TestProject } from "../../../../utils/src/TestProject";

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
 * 3. Reach the state parent through a real directory link; refuse a probe
 *    physically inside that root, then refuse an EIO/EACCES root identity.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls refreshProcessClockReference through counted lstat operations; asserts two mints rewrite one process-owned probe outside the project and roots enclosing the state directory lexically or through a real native directory link clear earlier references without another probe write. Unavailable supplied root identity also clears authority.
 * @evidence contracts/testing.md#independent-expectations A clock proof must avoid mutating the project it proves and must fail closed when no outside probe can exist. Native realpath relationships, unchanged probe bytes, metadata-observation count and reference count are independent of the refreshed timestamp; aliases are proven through the real filesystem, not a synthetic private flag.
 * @evidence contracts/testing.md#distinguishing-cases Owns repeated valid mints, lexical and physical-alias enclosing-root refusals with prior state, and root realpath EIO/EACCES refusals. An unrelated root can mint again before each refusal, so empty prior state cannot satisfy withdrawal. The supplied filesystem is case-local; the process-owned probe is deliberately retained by production until process exit, beyond TestProject directory cleanup.
 * @evidence contracts/testing.md#execution-ownership Unit test: a synchronous function calls the real refreshProcessClockReference, filesystemClockReferences and userStateDirectory with an lstat-recording copy of the default filesystem, touching a real temporary project and this user's process state directory. One actual native directory link (junction on Windows) reaches the state parent; only root realpath errors are supplied in a separate coherent view. No generation, compiler, watcher or native artifact is involved.
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

  // 2. A lexical root holding the directory clears the earlier reference.
  refreshProcessClockReference(fs.realpathSync.native(os.tmpdir()), filesystem);
  assert.equal(
    filesystemClockReferences(filesystem).size,
    0,
    "an earlier proof's reference is not kept",
  );

  // 3. A different lexical spelling reaches the same physical state parent.
  const alias = path.join(
    TestProject.tmpdir("ttsc-unplugin-clock-root-alias-"),
    "root",
  );
  fs.symlinkSync(
    path.dirname(kept),
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(fs.lstatSync(alias).isSymbolicLink(), true);
  assert.equal(
    fs.realpathSync.native(alias),
    fs.realpathSync.native(path.dirname(kept)),
  );
  refreshProcessClockReference(project, filesystem);
  assert.equal(filesystemClockReferences(filesystem).size, 1);
  const probe = stated[stated.length - 1]!;
  const originalProbe = fs.readFileSync(probe);
  const beforeAlias = stated.length;
  refreshProcessClockReference(alias, filesystem);
  assert.equal(
    filesystemClockReferences(filesystem).size,
    0,
    "a native alias cannot conceal an enclosing observed root",
  );
  assert.equal(
    stated.length,
    beforeAlias,
    "refused physical containment never observes a new probe",
  );
  assert.deepEqual(
    fs.readFileSync(probe),
    originalProbe,
    "refusal leaves actual probe bytes untouched",
  );

  // 4. Unknown root identity cannot prove that a probe lies outside it.
  for (const code of ["EIO", "EACCES"]) {
    const deniedRoot = path.join(project, "unresolved-root");
    fs.mkdirSync(deniedRoot, { recursive: true });
    assert.equal(fs.statSync(deniedRoot).isDirectory(), true);
    let rootResolutions = 0;
    const deniedFilesystem: TtscTransformFilesystemOperations = {
      ...filesystem,
      realpath: (location) => {
        if (path.resolve(location) === deniedRoot) {
          rootResolutions++;
          throw Object.assign(new Error("authored root identity unavailable"), {
            code,
          });
        }
        return DEFAULT_FILESYSTEM_OPERATIONS.realpath(location);
      },
    };
    refreshProcessClockReference(project, deniedFilesystem);
    assert.equal(filesystemClockReferences(deniedFilesystem).size, 1);
    const original = fs.readFileSync(probe);
    const beforeDenied = stated.length;
    refreshProcessClockReference(deniedRoot, deniedFilesystem);
    assert.equal(
      rootResolutions > 0,
      true,
      "the supplied root identity was actually consulted",
    );
    assert.equal(
      filesystemClockReferences(deniedFilesystem).size,
      0,
      `${code}: unknown root withdraws prior reference`,
    );
    assert.equal(
      stated.length,
      beforeDenied,
      `${code}: unknown root never observes a new probe`,
    );
    assert.deepEqual(
      fs.readFileSync(probe),
      original,
      `${code}: refusal leaves actual probe bytes untouched`,
    );
  }
}
