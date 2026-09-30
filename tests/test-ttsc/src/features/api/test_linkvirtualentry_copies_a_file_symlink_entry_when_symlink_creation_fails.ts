import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { linkVirtualEntry } from "../../../../../packages/ttsc/lib/launcher/internal/linkVirtualEntry.js";

/**
 * Verifies a file-symlink entry is copied when both native link attempts fail.
 *
 * A real symlink Dirent selects the fallback added for Windows file-symlink
 * restrictions. Linux can create that input without Windows privileges; an
 * occupied destination then makes symlink and hard-link creation fail with
 * EEXIST before the copy replaces its stale contents. This checks that actual
 * kernel transition, without claiming to reproduce Windows EPERM.
 *
 * 1. Create a file symlink and read its Dirent from the real directory.
 * 2. Occupy the virtual destination so both native link attempts fail.
 * 3. Call linkVirtualEntry and require the target payload to replace stale data.
 * 4. Release both owned fixture directories, collecting cleanup failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the compiled linkVirtualEntry with an actual symlink Dirent and an occupied destination; the original entry-existence, symbolic-link-kind and copied-payload assertions distinguish a skipped or aborted fallback.
 * @evidence contracts/testing.md#independent-expectations The authored target payload differs from the stale destination bytes. Native readdir reports the input kind independently of the operation under test.
 * @evidence contracts/testing.md#distinguishing-cases A file symlink and existing destination force native symlink and hard-link failures before copying. This case does not claim Windows privilege rejection, dangling-target behavior or successful hard-link creation.
 * @evidence contracts/testing.md#execution-ownership The named features/api export is discovered by the ttsc-core Linux E2E population and selected by the E2E function glob; no src/unit counterpart remains.
 * @evidence contracts/e2e.md#necessary-boundary The compiled mirroring operation crosses Node's native filesystem APIs with a real symlink Dirent and EEXIST failures. Portable synthetic entries cannot establish this kernel fallback and content replacement.
 * @evidence contracts/e2e.md#shared-execution Uses the lane's existing compiled SDK and test process, with no installation, native compilation or separate product host. Both fixtures are small directories for this one native transition.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique TestProject directories own the target and destination without shared state. The operation can change only the entry below the virtual root; finally removes each allocated root independently and surfaces operation plus cleanup failures.
 * @evidence contracts/e2e.md#preserved-coverage All three original assertions and their native fixture inputs remain in this Linux boundary entry. It is removed from source-unit discovery rather than skipped on Windows; Windows privilege behavior is not represented by this Linux EEXIST case.
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
