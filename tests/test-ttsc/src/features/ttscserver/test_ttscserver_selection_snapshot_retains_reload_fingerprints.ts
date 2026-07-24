import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  fingerprintInitialLSPProjectInputSnapshot,
  initialLSPProjectInputSnapshotIsCurrent,
  materializeLSPPluginManifest,
} from "../../../../../packages/ttsc/lib/launcher/internal/runTtscserver.js";

/**
 * Verifies a server selection snapshot fingerprints both reload input lanes.
 *
 * The JavaScript launcher selects and builds contributors before the native
 * host registers editor watchers. A current-filesystem baseline created later
 * can therefore bless a selection that is already stale. This test pins the
 * launcher-owned baseline that crosses that startup gap.
 *
 * 1. Capture one exact reload file and one reload directory.
 * 2. Prove an ordinary child-content edit leaves immediate topology current.
 * 3. Change the exact file and prove the captured selection becomes stale.
 * 4. Recapture, add one immediate directory entry, and prove topology drift also
 *    makes the selection stale.
 * 5. Where supported, retarget an exact-file symlink and prove its lexical
 *    identity remains part of the selection fingerprint.
 * 6. Where the filesystem preserves them, prove raw non-UTF-8 symlink-target bytes
 *    use the same explicit digest framing as the Go validator.
 * 7. Materialize a manifest larger than a practical Windows environment block,
 *    prove the transport carries it by private file, and dispose it
 *    idempotently.
 */
export const test_ttscserver_selection_snapshot_retains_reload_fingerprints =
  (): void => {
    const root = TestProject.tmpdir("ttscserver-selection-snapshot-");
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
      } catch {
        // Windows can deny symlink creation without Developer Mode. The
        // ordinary exact-file vector above remains mandatory everywhere.
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

      const invalidTarget = Buffer.from([0xff, 0x78]);
      const invalidLink = path.join(root, "invalid-target-link");
      let rawTargetSupported = true;
      try {
        fs.symlinkSync(invalidTarget, Buffer.from(invalidLink));
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
