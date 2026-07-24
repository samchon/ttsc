import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/lib/internal/projectInputPathIdentity.js";

/**
 * Verifies missing suffixes inherit their existing ancestor's case semantics.
 *
 * Physical aliases always converge. Missing names converge only when their
 * owning directory is case-insensitive; a case-sensitive directory preserves
 * both declarations.
 *
 * 1. Prove both semantics through injected filesystem operations.
 * 2. Compare the real host directory semantics without mutating the volume.
 * 3. On capable Windows hosts, cover a per-directory sensitive override.
 */
export const test_project_input_path_identity_respects_directory_case_semantics =
  (): void => {
    const root = path.resolve("virtual-project-input-root");
    const physical = path.join(root, "Physical");
    const alias = path.join(root, "Alias");
    const realpath = (location: string): string => {
      if (location === physical || location === alias) return physical;
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    };
    const insensitive = createProjectInputPathIdentityContext({
      caseSensitive: () => false,
      realpath,
    });
    const sensitive = createProjectInputPathIdentityContext({
      caseSensitive: () => true,
      realpath,
    });

    assert.deepEqual(
      insensitive.resolve(path.join(alias, "Future", "Spec.md")),
      {
        key: path.join(physical, "future", "spec.md"),
        path: path.join(physical, "future", "spec.md"),
      },
    );
    assert.equal(
      insensitive.resolve(path.join(alias, "future", "spec.md")).key,
      insensitive.resolve(path.join(alias, "Future", "Spec.md")).key,
    );
    assert.notEqual(
      sensitive.resolve(path.join(alias, "future", "spec.md")).key,
      sensitive.resolve(path.join(alias, "Future", "Spec.md")).key,
    );

    const actualRoot = TestProject.tmpdir(
      "ttsc-project-input-empty-case-semantics-",
    );
    const insensitiveRoot = path.join(actualRoot, "insensitive");
    fs.mkdirSync(insensitiveRoot);
    fs.writeFileSync(path.join(insensitiveRoot, "Marker.txt"), "", "utf8");
    const actual = createProjectInputPathIdentityContext();
    const markerAliasExists = fs.existsSync(
      path.join(insensitiveRoot, "mARKER.TXT"),
    );
    assert.equal(
      actual.resolve(path.join(insensitiveRoot, "Spec.md")).key ===
        actual.resolve(path.join(insensitiveRoot, "spec.md")).key,
      markerAliasExists,
    );

    if (process.platform !== "win32") return;
    const sensitiveRoot = path.join(actualRoot, "sensitive");
    fs.mkdirSync(sensitiveRoot);
    const enabled = childProcess.spawnSync(
      "fsutil.exe",
      ["file", "setCaseSensitiveInfo", sensitiveRoot, "enable"],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(enabled.status, 0, enabled.error?.message ?? enabled.stderr);
    fs.writeFileSync(path.join(sensitiveRoot, "Marker.txt"), "", "utf8");
    assert.notEqual(
      actual.resolve(path.join(sensitiveRoot, "Spec.md")).key,
      actual.resolve(path.join(sensitiveRoot, "spec.md")).key,
    );
  };
