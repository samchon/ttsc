import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { linkVirtualEntry } from "../../../../../packages/ttsc/src/launcher/internal/linkVirtualEntry";

/**
 * Verifies `linkVirtualEntry` never fails on a dangling symlink entry.
 *
 * A dangling link reaches the final re-symlink branch (its target cannot be
 * `stat`ed, so the directory-junction path rejects it). POSIX re-symlinks it
 * as-is; Windows without symlink privilege throws EPERM there, and none of the
 * fallbacks can materialize a target that no longer exists — so the entry must
 * be skipped rather than crashing the run (#306). The fixture is a junction on
 * Windows, so this case exercises the real EPERM path without requiring
 * `SeCreateSymbolicLinkPrivilege`.
 *
 * 1. Link to a directory (junction on Windows), then delete the target so the
 *    entry dangles.
 * 2. Call `linkVirtualEntry` for it; completing without throwing is the core
 *    assertion.
 * 3. Assert the outcome is one of the two correct ones: re-linked as a symlink, or
 *    skipped entirely.
 *
 * @evidence contracts/testing.md#behavioral-verification linkVirtualEntry completes for a dangling fixture and either mirrors the link or skips it without clobbering the virtual entry.
 * @evidence contracts/testing.md#independent-expectations The supported dangling-entry contract independently permits mirror or skip and rejects a materialized ordinary entry.
 * @evidence contracts/testing.md#distinguishing-cases One case: a symlink (junction on Windows) whose directory target was removed. On POSIX or a privileged Windows account linkVirtualEntry re-symlinks it ('mirrored'); on Windows without symlink privilege it reaches the EPERM catch and skips it ('skipped'); either outcome passes and only a non-link entry ('clobbered') or a thrown error fails. No live-target or regular-file entries are exercised.
 * @evidence contracts/testing.md#execution-ownership A unit test calling linkVirtualEntry directly on a real dangling link in private temp directories; no ttsx run, native build or installed package.
 */
export function test_linkvirtualentry_never_fails_on_a_dangling_symlink_entry() {
    const realDir = TestProject.tmpdir("ttsc-linkvirtualentry-dangling-");
    const target = path.join(realDir, "target");
    fs.mkdirSync(target);
    const entryName = "entry.link";
    const realEntry = path.join(realDir, entryName);
    fs.symlinkSync(
      target,
      realEntry,
      process.platform === "win32" ? "junction" : undefined,
    );
    fs.rmdirSync(target);
    const entry = fs
      .readdirSync(realDir, { withFileTypes: true })
      .find((candidate) => candidate.name === entryName);
    assert.ok(entry, "fixture entry must exist");
    assert.ok(entry.isSymbolicLink(), "fixture must be a symlink entry");

    const virtualDir = TestProject.tmpdir("ttsc-linkvirtualentry-virtual-");
    const virtualEntry = path.join(virtualDir, entryName);

    linkVirtualEntry(realEntry, virtualEntry, entry);

    const outcome = (() => {
      try {
        return fs.lstatSync(virtualEntry).isSymbolicLink()
          ? "mirrored"
          : "clobbered";
      } catch {
        return "skipped";
      }
    })();
    assert.ok(
      outcome === "mirrored" || outcome === "skipped",
      `dangling entry must be re-linked or skipped, got ${outcome}`,
    );
}