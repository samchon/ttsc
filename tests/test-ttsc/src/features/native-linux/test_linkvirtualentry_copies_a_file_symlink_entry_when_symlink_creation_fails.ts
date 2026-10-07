import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { linkVirtualEntry } from "../../../../../packages/ttsc/src/launcher/internal/linkVirtualEntry";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a real file-symlink entry is copied after occupied-destination
 * refusals.
 *
 * Linux admission retains the original native input population. A real symlink
 * Dirent and occupied destination make both link attempts fail before copying
 * replaces stale bytes. This does not reproduce Windows privilege rejection;
 * non-Linux module admission does not invoke this entry or claim it passed.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual source linkVirtualEntry with a real symlink Dirent and an occupied destination, retaining the original entry existence, symbolic-link kind and exact copied payload assertions.
 * @evidence contracts/testing.md#independent-expectations Authored target payload differs from stale destination bytes; native readdir supplies the entry kind independently of the mirroring operation. Literal payload is not computed by that operation.
 * @evidence contracts/testing.md#distinguishing-cases Existing destination causes native symlink and hard-link refusals for a live file-symlink input before copying. The existing dangling-input unit owns target absence; this body does not claim Windows EPERM, directory-junction equivalence or successful hard-link creation.
 * @evidence contracts/testing.md#execution-ownership The module-local native-linux population admits this original named export only on Linux, retaining the existing CLI filters and a single TestExecutor invocation. Admission selected/unselected records are separate from actual runner invocation/failure/skip results. The owning source operation directly uses real filesystem inputs with no install, native build, metadata child or product host. Owned fixture cleanup collects failures; the E2E donor remains pending execution evidence.
 */
export const test_linkvirtualentry_copies_a_file_symlink_entry_when_symlink_creation_fails =
  () => {
    const realDir = TestProject.tmpdir("ttsc-linkvirtualentry-real-");
    let virtualDir: string | undefined;
    const failures: unknown[] = [];
    try {
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

      virtualDir = TestProject.tmpdir("ttsc-linkvirtualentry-virtual-");
      const virtualEntry = path.join(virtualDir, entryName);
      fs.writeFileSync(virtualEntry, "stale", "utf8");

      linkVirtualEntry(realEntry, virtualEntry, entry);

      assert.equal(fs.readFileSync(virtualEntry, "utf8"), "payload");
    } catch (error) {
      failures.push(error);
    } finally {
      for (const directory of [virtualDir, realDir]) {
        if (directory === undefined) continue;
        try {
          fs.rmSync(directory, { recursive: true, force: true });
        } catch (error) {
          failures.push(error);
        }
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(
        failures,
        "File-symlink fallback and cleanup failed",
      );
  };
