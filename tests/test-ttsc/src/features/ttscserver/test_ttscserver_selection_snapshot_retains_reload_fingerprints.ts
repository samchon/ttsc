import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { fingerprintInitialLSPProjectInputSnapshot } from "../../../../../packages/ttsc/src/launcher/internal/ttscserver/fingerprintInitialLSPProjectInputSnapshot";
import { initialLSPProjectInputSnapshotIsCurrent } from "../../../../../packages/ttsc/src/launcher/internal/ttscserver/initialLSPProjectInputSnapshotIsCurrent";
import { materializeLSPPluginManifest } from "../../../../../packages/ttsc/src/launcher/internal/ttscserver/materializeLSPPluginManifest";

/**
 * Verifies a server selection snapshot fingerprints both reload input lanes.
 *
 * The JavaScript launcher selects and builds contributors before the native
 * host registers editor watchers. A current-filesystem baseline created later
 * can therefore bless a selection that is already stale. This test pins the
 * launcher-owned baseline that crosses that startup gap.
 *
 * 1. Capture one exact reload file and one reload directory, prove a child-content
 *    edit leaves immediate topology current, then prove an exact-file edit and an
 *    added directory entry each make the selection stale.
 * 2. Where link creation is permitted, retarget an exact-file symlink and a
 *    same-topology reload-directory link and prove lexical and physical identity
 *    invalidate the selection.
 * 3. On POSIX, where the filesystem stores them, prove backslash names and raw
 *    non-UTF-8 target bytes are digested with the framing of the Go validator.
 * 4. Materialize a manifest larger than a Windows environment block, prove it
 *    travels by private file and dispose it idempotently.
 *
 * @evidence contracts/testing.md#behavioral-verification Snapshot operations distinguish child-content edits from reload-file, immediate-topology and link-identity drift and preserve framed raw identities; manifest transport carries 8192 inputs and disposes its directory twice safely.
 * @evidence contracts/testing.md#independent-expectations Authored file/tree mutations define currency independently, and explicit Go-compatible digest framing plus literal input count establish transport expectations.
 * @evidence contracts/testing.md#distinguishing-cases A child-content edit leaves the captured topology current while an exact-file edit and an added directory entry each make it stale; an exact-file symlink retarget and a reload-directory link retarget are covered where link creation is permitted and reported as SKIPPED otherwise; on POSIX, backslash names and raw non-UTF-8 target bytes are digested with the Go validator's framing where the filesystem stores them; an 8192-input manifest larger than a Windows environment block travels by private file and is disposed twice.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/ttscserver entry exercises the owning operations directly on isolated fixture inputs; no product host, native artifact build or consumer installation executes.
 */
export const test_ttscserver_selection_snapshot_retains_reload_fingerprints =
  (): void => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttscserver-selection-snapshot-"),
    );
    const reloadFile = path.join(root, "lint.config.cjs");
    const reloadDirectory = path.join(root, "config-deps");
    const child = path.join(reloadDirectory, "selection.cjs");
    fs.mkdirSync(reloadDirectory, { recursive: true });
    fs.writeFileSync(reloadFile, "module.exports = {};", "utf8");
    fs.writeFileSync(child, "alpha", "utf8");

    try {
      const first = fingerprintInitialLSPProjectInputSnapshot({
        files: [reloadFile],
        globs: [],
        reloadDirectories: [reloadDirectory],
        reloadFiles: [reloadFile],
        root,
      });
      assert.equal(initialLSPProjectInputSnapshotIsCurrent(first), true);

      fs.writeFileSync(child, "beta", "utf8");
      assert.equal(
        initialLSPProjectInputSnapshotIsCurrent(first),
        true,
        "child contents must not change immediate directory topology",
      );

      fs.writeFileSync(reloadFile, "module.exports = { rules: {} };", "utf8");
      assert.equal(
        initialLSPProjectInputSnapshotIsCurrent(first),
        false,
        "exact reload-file drift must invalidate startup selection",
      );

      const second = fingerprintInitialLSPProjectInputSnapshot({
        files: [reloadFile],
        globs: [],
        reloadDirectories: [reloadDirectory],
        reloadFiles: [reloadFile],
        root,
      });
      fs.writeFileSync(path.join(reloadDirectory, "nearer.cjs"), "", "utf8");
      assert.equal(
        initialLSPProjectInputSnapshotIsCurrent(second),
        false,
        "immediate directory topology drift must invalidate startup selection",
      );

      const firstTarget = path.join(root, "first-target.cjs");
      const secondTarget = path.join(root, "second-target.cjs");
      const reloadLink = path.join(root, "reload-link.cjs");
      fs.writeFileSync(firstTarget, "first", "utf8");
      fs.writeFileSync(secondTarget, "second", "utf8");
      let symlinkSupported = true;
      try {
        fs.symlinkSync(firstTarget, reloadLink, "file");
      } catch (error) {
        // Windows can deny symlink creation without Developer Mode. The
        // ordinary exact-file vector above remains mandatory everywhere, and
        // the skipped link vector is reported rather than silent.
        console.warn(
          `SKIPPED exact-file symlink retarget: ${(error as NodeJS.ErrnoException).code ?? String(error)}`,
        );
        symlinkSupported = false;
      }
      if (symlinkSupported) {
        const linked = fingerprintInitialLSPProjectInputSnapshot({
          files: [reloadLink],
          globs: [],
          reloadFiles: [reloadLink],
          root,
        });
        fs.rmSync(reloadLink);
        fs.symlinkSync(secondTarget, reloadLink, "file");
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(linked),
          false,
          "exact reload-file symlink retarget must invalidate startup selection",
        );
      }

      const firstDirectoryTarget = path.join(root, "first-directory-target");
      const secondDirectoryTarget = path.join(root, "second-directory-target");
      const reloadDirectoryLink = path.join(root, "reload-directory-link");
      fs.mkdirSync(firstDirectoryTarget);
      fs.mkdirSync(secondDirectoryTarget);
      let directoryLinkSupported = true;
      try {
        fs.symlinkSync(
          firstDirectoryTarget,
          reloadDirectoryLink,
          process.platform === "win32" ? "junction" : "dir",
        );
      } catch (error) {
        console.warn(
          `SKIPPED reload-directory link retarget: ${(error as NodeJS.ErrnoException).code ?? String(error)}`,
        );
        directoryLinkSupported = false;
      }
      if (directoryLinkSupported) {
        const linkedDirectory = fingerprintInitialLSPProjectInputSnapshot({
          files: [],
          globs: [],
          reloadDirectories: [reloadDirectoryLink],
          root,
        });
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(linkedDirectory),
          true,
        );
        fs.rmSync(reloadDirectoryLink, { force: true, recursive: true });
        fs.symlinkSync(
          secondDirectoryTarget,
          reloadDirectoryLink,
          process.platform === "win32" ? "junction" : "dir",
        );
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(linkedDirectory),
          false,
          "same-topology reload-directory retarget must invalidate startup selection",
        );
      }

      if (process.platform !== "win32") {
        verifyRawDirectoryIdentity(root);
      }

      const invalidTarget = Buffer.from([0xff, 0x78]);
      const invalidLink = path.join(root, "invalid-target-link");
      let rawTargetSupported = true;
      try {
        fs.symlinkSync(invalidTarget, Buffer.from(invalidLink));
        // Windows stores a link target as UTF-16, so the bytes that are not
        // UTF-8 come back as a replacement character and there is no raw
        // target left to digest.
        rawTargetSupported = fs
          .readlinkSync(Buffer.from(invalidLink), { encoding: "buffer" })
          .equals(invalidTarget);
      } catch {
        rawTargetSupported = false;
      }
      if (rawTargetSupported) {
        const rawLinked = fingerprintInitialLSPProjectInputSnapshot({
          files: [invalidLink],
          globs: [],
          reloadFiles: [invalidLink],
          root,
        });
        const expected = createHash("sha256")
          .update(
            Buffer.concat([
              Buffer.from("symlink\0"),
              invalidTarget,
              Buffer.from([0]),
              Buffer.from("missing\0"),
            ]),
          )
          .digest("hex");
        assert.equal(rawLinked.reloadFileDigests[invalidLink], expected);
      }

      const largeFiles = Array.from({ length: 8_192 }, (_, index) =>
        path.join(root, "inputs", `${index.toString().padStart(5, "0")}.json`),
      );
      const transport = materializeLSPPluginManifest({
        initialProjectInputs: {
          transport: {
            files: largeFiles,
            globs: [],
            root,
          },
        },
        lspPlugins: [],
        plugins: [],
      });
      const manifestDirectory = path.dirname(transport.path);
      try {
        const body = fs.readFileSync(transport.path, "utf8");
        assert.ok(
          Buffer.byteLength(body) > 64 * 1024,
          "fixture must exceed a practical Windows environment payload",
        );
        const parsed = JSON.parse(body) as {
          initialProjectInputs: {
            transport: { files: string[] };
          };
        };
        assert.equal(parsed.initialProjectInputs.transport.files.length, 8_192);
      } finally {
        transport.dispose();
        transport.dispose();
      }
      assert.equal(fs.existsSync(manifestDirectory), false);
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };

function verifyRawDirectoryIdentity(root: string): void {
  const topology = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
  const backslashDirectory = path.join(root, String.raw`back\slash`);
  fs.mkdirSync(backslashDirectory);
  const backslashSnapshot = fingerprintInitialLSPProjectInputSnapshot({
    files: [],
    globs: [],
    reloadDirectories: [backslashDirectory],
    root,
  });
  const expectedBackslash = createHash("sha256")
    .update(
      Buffer.concat([
        Buffer.from("directory\0"),
        Buffer.from(backslashDirectory),
        Buffer.from([0]),
        Buffer.from(topology),
      ]),
    )
    .digest("hex");
  assert.equal(
    backslashSnapshot.reloadDirectoryDigests[backslashDirectory],
    expectedBackslash,
    "POSIX backslash filename was rewritten as a path separator",
  );

  const rawTarget = Buffer.concat([
    Buffer.from(root),
    Buffer.from(path.sep),
    Buffer.from([0xff, 0x2d, 0x64, 0x69, 0x72]),
  ]);
  const rawLink = path.join(root, "raw-directory-link");
  try {
    fs.mkdirSync(rawTarget);
  } catch (error) {
    // A filesystem that stores names only as valid UTF-8, such as macOS's
    // APFS, refuses the name, and there are no raw bytes to preserve.
    if ((error as NodeJS.ErrnoException).code === "EILSEQ") return;
    throw error;
  }
  fs.symlinkSync(rawTarget, Buffer.from(rawLink), "dir");
  const rawSnapshot = fingerprintInitialLSPProjectInputSnapshot({
    files: [],
    globs: [],
    reloadDirectories: [rawLink],
    root,
  });
  const expectedRaw = createHash("sha256")
    .update(
      Buffer.concat([
        Buffer.from("directory\0"),
        (fs.realpathSync.native ?? fs.realpathSync)(Buffer.from(rawLink), {
          encoding: "buffer",
        }),
        Buffer.from([0]),
        Buffer.from(topology),
      ]),
    )
    .digest("hex");
  assert.equal(
    rawSnapshot.reloadDirectoryDigests[rawLink],
    expectedRaw,
    "POSIX physical directory identity lost non-UTF-8 bytes",
  );
}
