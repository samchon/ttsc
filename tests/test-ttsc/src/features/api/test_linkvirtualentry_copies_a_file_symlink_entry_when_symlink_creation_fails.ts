import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { linkVirtualEntry } from "../../../../../packages/ttsc/lib/launcher/internal/prepareExecution.js";

/**
 * Verifies `linkVirtualEntry` falls back to copying a file-symlink entry when
 * re-symlinking it fails.
 *
 * On Windows without `SeCreateSymbolicLinkPrivilege`, the final branch's bare
 * `fs.symlinkSync` throws EPERM and used to abort the whole run (#306). The
 * fallback must materialize the entry's content instead. CI cannot produce that
 * EPERM (Linux, and creating the fixture on Windows needs the very privilege
 * the fallback avoids), so this drives the identical symlink-fails →
 * hard-link-fails → copy chain with EEXIST: a file already squatting on the
 * virtual path.
 *
 * 1. Create a file symlink and read its `Dirent` from the real directory.
 * 2. Pre-create the virtual path so symlink and hard-link creation both fail.
 * 3. Call `linkVirtualEntry`; assert the copy fallback replaced the content with
 *    the symlink target's payload.
 */
export const test_linkvirtualentry_copies_a_file_symlink_entry_when_symlink_creation_fails =
  () => {
    const realDir = TestProject.tmpdir("ttsc-linkvirtualentry-real-");
    const target = path.join(realDir, "target.txt");
    fs.writeFileSync(target, "payload", "utf8");
    const entryName = "entry.link";
    const realEntry = path.join(realDir, entryName);
    fs.symlinkSync(target, realEntry);
    const entry = fs
      .readdirSync(realDir, { withFileTypes: true })
      .find((candidate) => candidate.name === entryName);
    assert.ok(entry, "fixture entry must exist");
    assert.ok(entry.isSymbolicLink(), "fixture must be a symlink entry");

    const virtualDir = TestProject.tmpdir("ttsc-linkvirtualentry-virtual-");
    const virtualEntry = path.join(virtualDir, entryName);
    fs.writeFileSync(virtualEntry, "stale", "utf8");

    linkVirtualEntry(realEntry, virtualEntry, entry);

    assert.equal(fs.readFileSync(virtualEntry, "utf8"), "payload");
  };
