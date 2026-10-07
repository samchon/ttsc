import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { linkVirtualEntry } from "../../../../../packages/ttsc/src/launcher/internal/linkVirtualEntry";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies real file-link fallback independently of file-symlink permission.
 *
 * A regular-file input requires no symbolic-link privilege. An occupied output
 * independently refuses hard-link creation and exercises actual copying. A
 * separate native file-symlink attempt establishes that input's prerequisite:
 * success exercises the live symlink route; Windows EPERM records unavailable
 * input preparation and unchanged fixture state, without claiming that route.
 *
 * 1. Read a genuine regular-file entry and observe occupied-output link refusal.
 * 2. Mirror it, then verify copied bytes, source preservation and copy isolation.
 * 3. Probe file-symlink creation and exercise its live fallback when representable.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls source linkVirtualEntry with native readdir Dirents and actual files. Occupied output must receive the authored payload while later writes leave the source unchanged. A permitted live symlink additionally reaches the final symlink/hard-link/copy route.
 * @evidence contracts/testing.md#independent-expectations Literal payload and stale bytes differ. Independent native link attempts establish occupied-destination refusal before the product call; subsequent writes distinguish independent copies from shared hard links. The symlink prerequisite is observed through actual creation, not fabricated Dirent metadata.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts stale occupied output with copied payload and verifies source preservation and copy independence. Only actual Windows EPERM permits unavailable file-symlink input, requiring no added entry and unchanged source/output bytes; all other preparation errors fail. Successful preparation requires a genuine symbolic-link Dirent and verifies both native link refusals before copied payload and independence. The separate dangling-entry unit owns the absent-target junction control, and the native-linux unit retains its original live file-symlink regression.
 * @evidence contracts/testing.md#execution-ownership The package's ordinary API unit population invokes the owning source operation on private real filesystem entries, with no mock filesystem, install, native artifact build or product host. Cleanup releases the owned root in finally and aggregates any operation and cleanup failures.
 */
export function test_linkvirtualentry_observes_native_file_link_and_copy_capabilities(): void {
  const root = TestProject.tmpdir("ttsc-native-file-fallback-");
  const failures: unknown[] = [];
  try {
    const source = path.join(root, "source.txt");
    fs.writeFileSync(source, "authored payload\n", { flag: "wx" });
    const entry = fs.readdirSync(root, { withFileTypes: true })[0];
    assert.ok(entry);
    assert.equal(entry.name, "source.txt");
    assert.ok(entry.isFile());

    const copied = path.join(root, "copied.txt");
    fs.writeFileSync(copied, "stale output\n", { flag: "wx" });
    assert.throws(() => fs.linkSync(source, copied), { code: "EEXIST" });
    assert.equal(fs.readFileSync(copied, "utf8"), "stale output\n");
    assert.equal(fs.readFileSync(source, "utf8"), "authored payload\n");
    linkVirtualEntry(source, copied, entry);
    assert.ok(fs.lstatSync(copied).isFile());
    assert.equal(fs.readFileSync(copied, "utf8"), "authored payload\n");
    fs.writeFileSync(copied, "independent copy\n");
    assert.equal(fs.readFileSync(source, "utf8"), "authored payload\n");

    const realLink = path.join(root, "input.link");
    const before = fs.readdirSync(root).sort();
    let permitted = false;
    try {
      fs.symlinkSync(source, realLink, "file");
      permitted = true;
    } catch (error) {
      assert.equal(process.platform, "win32");
      assert.ok(error instanceof Error && "code" in error);
      assert.equal(error.code, "EPERM");
      assert.deepEqual(fs.readdirSync(root).sort(), before);
      assert.equal(fs.readFileSync(source, "utf8"), "authored payload\n");
      assert.equal(fs.readFileSync(copied, "utf8"), "independent copy\n");
      console.log(
        "native file-symlink prerequisite refused: EPERM; regular-file copy fallback verified, live symlink route unavailable",
      );
    }
    if (permitted) {
      const symbolic = fs
        .readdirSync(root, { withFileTypes: true })
        .find((candidate) => candidate.name === "input.link");
      assert.ok(symbolic);
      assert.ok(symbolic.isSymbolicLink());
      assert.equal(fs.realpathSync(realLink), fs.realpathSync(source));
      const destination = path.join(root, "symbolic-copy.txt");
      fs.writeFileSync(destination, "stale symbolic output\n", { flag: "wx" });
      assert.throws(() => fs.symlinkSync(realLink, destination));
      assert.throws(() => fs.linkSync(realLink, destination), { code: "EEXIST" });
      assert.equal(fs.readFileSync(destination, "utf8"), "stale symbolic output\n");
      linkVirtualEntry(realLink, destination, symbolic);
      assert.ok(fs.lstatSync(destination).isFile());
      assert.equal(fs.readFileSync(destination, "utf8"), "authored payload\n");
      fs.writeFileSync(destination, "independent symbolic copy\n");
      assert.equal(fs.readFileSync(realLink, "utf8"), "authored payload\n");
      assert.equal(fs.readFileSync(source, "utf8"), "authored payload\n");
      console.log("native live file-symlink copy fallback verified");
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Native file fallback and cleanup failed");
}
