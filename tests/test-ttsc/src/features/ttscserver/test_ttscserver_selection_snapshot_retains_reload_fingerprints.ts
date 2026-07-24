import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  fingerprintInitialLSPProjectInputSnapshot,
  initialLSPProjectInputSnapshotIsCurrent,
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
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };
