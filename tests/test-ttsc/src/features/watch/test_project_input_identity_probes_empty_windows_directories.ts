import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  createProjectInputPathIdentityContext,
  probeProjectInputDirectoryCaseSensitivity,
} from "../../../../../packages/ttsc/lib/internal/projectInputPathIdentity.js";

/**
 * Verifies empty Windows directories expose their real case semantics.
 *
 * Localized `fsutil` output cannot be parsed reliably, and an empty directory
 * has no existing name to compare. A temporary non-source sentinel pair must
 * distinguish default and per-directory-sensitive lookup without residue.
 *
 * 1. Create empty default and case-sensitive Windows directories.
 * 2. Probe both directly and assert opposite case semantics.
 * 3. Resolve missing case aliases and assert both directories remain empty.
 */
export const test_project_input_identity_probes_empty_windows_directories =
  (): void => {
    if (process.platform !== "win32") return;
    const root = TestProject.tmpdir("ttsc-project-input-empty-case-");
    const insensitive = path.join(root, "insensitive");
    const sensitive = path.join(root, "sensitive");
    fs.mkdirSync(insensitive);
    fs.mkdirSync(sensitive);
    const enabled = childProcess.spawnSync(
      "fsutil.exe",
      ["file", "setCaseSensitiveInfo", sensitive, "enable"],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(enabled.status, 0, enabled.error?.message ?? enabled.stderr);

    assert.equal(probeProjectInputDirectoryCaseSensitivity(insensitive), false);
    assert.equal(probeProjectInputDirectoryCaseSensitivity(sensitive), true);
    const identities = createProjectInputPathIdentityContext();
    assert.equal(
      identities.resolve(path.join(insensitive, "Spec.md")).key,
      identities.resolve(path.join(insensitive, "spec.md")).key,
    );
    assert.notEqual(
      identities.resolve(path.join(sensitive, "Spec.md")).key,
      identities.resolve(path.join(sensitive, "spec.md")).key,
    );
    assert.deepEqual(fs.readdirSync(insensitive), []);
    assert.deepEqual(fs.readdirSync(sensitive), []);
  };
