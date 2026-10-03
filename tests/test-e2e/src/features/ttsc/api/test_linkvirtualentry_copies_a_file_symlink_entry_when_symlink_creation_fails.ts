import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { linkVirtualEntry } from "../../../../../../packages/ttsc/lib/launcher/internal/linkVirtualEntry.js";

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
 * @evidence contracts/testing.md#execution-ownership This original export remains selected in the Linux E2E population. Its exact authored counterpart now exists at tests/test-ttsc/src/features/native-linux/test_linkvirtualentry_copies_a_file_symlink_entry_when_symlink_creation_fails.ts; module-local positive wiring preserves general features and admits only this native population on Linux. Admission selected/unselected is not actual invocation or PASS.
 * @evidence contracts/e2e.md#necessary-boundary Real symlink Dirent and occupied-destination failures are inputs to the directly called owning mirroring operation, not an installed consumer or product protocol. The direct unit preserves native inputs rather than substituting synthetic Dirents, directory junctions, hardlinks or changed permissions.
 * @evidence contracts/e2e.md#shared-execution Uses the lane's existing compiled SDK and test process, with no installation, native compilation or separate product host. Both fixtures are small directories for this one native transition.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique TestProject directories own the target and destination without shared state. The operation can change only the entry below the virtual root; finally removes each allocated root independently and surfaces operation plus cleanup failures.
 * @evidence contracts/e2e.md#preserved-coverage All three original assertions and native inputs remain here and in the exact authored unit. That unit's Linux-only wiring preserves the existing CLI/empty-selection contracts with scripts/Evidence/globs unchanged; non-Linux is unselected, not executed success. Body and wiring presence are not runtime survival, so this donor remains until actual selected execution is established. Windows privilege behavior is not represented by Linux occupied-destination refusal.
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
