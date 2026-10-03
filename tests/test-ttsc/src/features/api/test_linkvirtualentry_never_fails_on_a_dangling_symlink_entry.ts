import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { linkVirtualEntry } from "../../../../../packages/ttsc/src/launcher/internal/linkVirtualEntry";

/**
 * Verifies `linkVirtualEntry` never fails on a dangling symlink entry.
 *
 * A dangling link reaches the final re-symlink branch (its target cannot be
 * `stat`ed, so the directory-junction path rejects it). A successful native
 * symlink mirrors the original entry. If creation is refused and the original
 * target remains absent, the supported fallback leaves no destination (#306).
 * The fixture uses a junction on Windows to prepare dangling entry metadata
 * without file-symlink privilege; the final result does not identify which
 * errno or capability caused a refusal.
 *
 * 1. Link to a directory (junction on Windows), then delete the target so the
 *    entry dangles.
 * 2. Call `linkVirtualEntry` for it; completing without throwing is the core
 *    assertion.
 * 3. Assert the outcome is one of the two correct ones: re-linked as a symlink, or
 *    skipped entirely.
 *
 * @evidence contracts/testing.md#behavioral-verification linkVirtualEntry completes for a dangling fixture and either creates a symlink to the authored original entry or leaves the destination absent; other stat failures propagate and ordinary destination entries fail.
 * @evidence contracts/testing.md#independent-expectations The supported dangling-entry contract independently permits mirror or skip and rejects a materialized ordinary entry.
 * @evidence contracts/testing.md#distinguishing-cases A native symlink (junction on Windows) has its directory target removed. A mirrored result must be a link to the literal original entry; an absent destination is the other supported result. A non-link destination or non-ENOENT observation failure rejects. The case does not attribute a native refusal to EPERM and does not exercise a live-target or regular-file entry.
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
        if (!fs.lstatSync(virtualEntry).isSymbolicLink()) return "clobbered";
        assert.equal(path.resolve(path.dirname(virtualEntry), fs.readlinkSync(virtualEntry)), realEntry);
        return "mirrored";
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return "skipped";
      }
    })();
    assert.ok(
      outcome === "mirrored" || outcome === "skipped",
      `dangling entry must be re-linked or skipped, got ${outcome}`,
    );
}
