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
 * 2. Retarget a native exact-entry link (Windows junction, POSIX file symlink) and a
 *    same-topology reload-directory link and prove lexical and physical identity
 *    invalidate the selection.
 * 3. Prove a platform-representable exact-entry link target
 *    and (on POSIX only) a backslash directory name and a raw non-UTF-8
 *    directory-link target digest to independently framed sha256 values.
 * 4. Materialize a manifest larger than a Windows environment block, prove it
 *    travels by private file and dispose it idempotently.
 *
 * @evidence contracts/testing.md#behavioral-verification Snapshot operations distinguish child-content edits from reload-file, immediate-topology and link-identity drift and preserve framed raw identities; manifest transport carries 8192 inputs and disposes its directory twice safely.
 * @evidence contracts/testing.md#independent-expectations Authored file and directory mutations define whether each snapshot must stay current or become stale; the raw-symlink and POSIX directory digests are re-derived in the test with sha256 over the documented framing (`symlink\0`/`directory\0`, target or path bytes, NUL, `missing\0` or the empty-topology hash), so a change to that framing fails. The test cannot prove agreement with the Go validator itself, only with this written framing; the manifest expectation is the literal count 8192 and a size above 64 KiB.
 * @evidence contracts/testing.md#distinguishing-cases Child contents remain current while exact-file edits and immediate topology invalidate. Exact-entry retarget uses a Windows leaf junction or POSIX leaf file symlink: both own link identity, but junction framing has missing content while the POSIX link reaches file bytes. POSIX preserves original different-content and added same-content retargets; Windows empty-directory retarget isolates identity. Native directory-link retarget is mandatory. POSIX raw bytes/backslash names and Windows Unicode junction bytes retain their distinct native input domains. Preparation errors are failures; manifest contents and repeated disposal are asserted separately.
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
      const failures: unknown[] = [];
      const verify = (name: string, run: () => void): void => {
        try { run(); } catch (cause) { failures.push(new Error(name, { cause })); }
      };
      verify("ordinary reload content and topology", () => {
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
      });

      verify("native exact-file link retarget", () => {
      const firstTarget = path.join(root, "first-target.cjs");
      const secondTarget = path.join(root, "second-target.cjs");
      const reloadLink = path.join(root, "reload-link.cjs");
      const linkKind = process.platform === "win32" ? "junction" : "file";
      if (process.platform === "win32") {
        fs.mkdirSync(firstTarget);
        fs.mkdirSync(secondTarget);
      } else {
        fs.writeFileSync(firstTarget, "first", "utf8");
        fs.writeFileSync(secondTarget, "second", "utf8");
      }
      fs.symlinkSync(firstTarget, reloadLink, linkKind);
        const linked = fingerprintInitialLSPProjectInputSnapshot({
          files: [reloadLink],
          globs: [],
          reloadFiles: [reloadLink],
          root,
        });
        assert.equal(initialLSPProjectInputSnapshotIsCurrent(linked), true);
        assert.equal(fs.lstatSync(reloadLink).isSymbolicLink(), true);
        if (process.platform === "win32") {
          assert.throws(() => fs.readFileSync(reloadLink));
          const framed = createHash("sha256").update(Buffer.concat([Buffer.from("symlink\0"), fs.readlinkSync(reloadLink, { encoding: "buffer" }), Buffer.from([0]), Buffer.from("missing\0")])).digest("hex");
          assert.equal(linked.reloadFileDigests[reloadLink], framed, "Windows leaf junction is a link frame with unavailable file content");
        }
        fs.rmSync(reloadLink, { recursive: true, force: true });
        fs.symlinkSync(secondTarget, reloadLink, linkKind);
        assert.equal(
          initialLSPProjectInputSnapshotIsCurrent(linked),
          false,
          "exact reload-file symlink retarget must invalidate startup selection",
        );
        const equalContentTarget = path.join(root, "equal-content-target.cjs");
        if (process.platform === "win32") {
          fs.mkdirSync(equalContentTarget);
          assert.deepEqual(fs.readdirSync(secondTarget), []);
          assert.deepEqual(fs.readdirSync(equalContentTarget), []);
        } else {
          fs.writeFileSync(equalContentTarget, "second", "utf8");
          assert.equal(fs.readFileSync(secondTarget, "utf8"), fs.readFileSync(equalContentTarget, "utf8"));
        }
        const equalContent = fingerprintInitialLSPProjectInputSnapshot({ files: [reloadLink], globs: [], reloadFiles: [reloadLink], root });
        assert.equal(initialLSPProjectInputSnapshotIsCurrent(equalContent), true);
        fs.rmSync(reloadLink, { recursive: true, force: true });
        fs.symlinkSync(equalContentTarget, reloadLink, linkKind);
        assert.equal(initialLSPProjectInputSnapshotIsCurrent(equalContent), false, "same-content leaf retarget must change link identity");
      });

      verify("native same-topology directory retarget", () => {
      const firstDirectoryTarget = path.join(root, "first-directory-target");
      const secondDirectoryTarget = path.join(root, "second-directory-target");
      const reloadDirectoryLink = path.join(root, "reload-directory-link");
      fs.mkdirSync(firstDirectoryTarget);
      fs.mkdirSync(secondDirectoryTarget);
        fs.symlinkSync(
          firstDirectoryTarget,
          reloadDirectoryLink,
          process.platform === "win32" ? "junction" : "dir",
        );
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
      });

      if (process.platform !== "win32") {
        verifyRawDirectoryIdentity(root, verify);
      }

      verify("native target-byte file framing", () => {
      const unicodeDirectory = path.join(root, "\uD3EC\uD568-target");
      const invalidTarget = process.platform === "win32" ? Buffer.from(unicodeDirectory) : Buffer.from([0xff, 0x78]);
      const invalidLink = path.join(root, "invalid-target-link");
        if (process.platform === "win32") fs.mkdirSync(unicodeDirectory);
        fs.symlinkSync(invalidTarget, Buffer.from(invalidLink), process.platform === "win32" ? "junction" : "file");
        assert.deepEqual(fs.readlinkSync(Buffer.from(invalidLink), { encoding: "buffer" }), invalidTarget);
        assert.throws(() => fs.readFileSync(invalidLink));
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
      });

      verify("large manifest transport and disposal", () => {
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
        assert.deepEqual(parsed.initialProjectInputs.transport.files, largeFiles);
      } finally {
        transport.dispose();
        transport.dispose();
      }
      assert.equal(fs.existsSync(manifestDirectory), false);
      });
      if (failures.length !== 0) throw new AggregateError(failures, "Selection snapshot boundary failures");
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };

function verifyRawDirectoryIdentity(root: string, verify: (name: string, run: () => void) => void): void {
  const topology = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
  verify("POSIX backslash directory identity", () => {
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
  });

  verify("POSIX raw directory identity", () => {
  const rawTarget = Buffer.concat([
    Buffer.from(root),
    Buffer.from(path.sep),
    Buffer.from([0xff, 0x2d, 0x64, 0x69, 0x72]),
  ]);
  const rawLink = path.join(root, "raw-directory-link");
  fs.mkdirSync(rawTarget);
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
  });
}
