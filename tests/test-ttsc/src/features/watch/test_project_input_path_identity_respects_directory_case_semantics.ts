import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  createFilesystemPathIdentityContext,
  createProjectInputPathIdentityContext,
} from "../../../../../packages/ttsc/lib/internal/projectInputPathIdentity.js";

/**
 * Verifies missing suffixes inherit their existing ancestor's case semantics.
 *
 * Physical aliases always converge. Missing names converge only when their
 * owning directory is case-insensitive; a case-sensitive directory preserves
 * both declarations.
 *
 * 1. Prove both semantics through injected filesystem operations.
 * 2. Compare the real host directory semantics without mutating the volume.
 * 3. On capable Windows hosts, start a new identity transaction after enabling a
 *    per-directory sensitive override and prove it is observed.
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

    const insensitivePath = path.join(physical, "future", "spec.md");
    const insensitiveVolume = path.parse(insensitivePath).root;
    assert.deepEqual(
      insensitive.resolve(path.join(alias, "Future", "Spec.md")),
      {
        key:
          process.platform === "win32"
            ? `${insensitiveVolume.toLowerCase()}${insensitivePath.slice(insensitiveVolume.length)}`
            : insensitivePath,
        path: insensitivePath,
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

    const missing = (): never => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    };
    const windows = createFilesystemPathIdentityContext({
      platform: "win32",
      caseSensitive: (directory) =>
        path.win32.resolve(directory).toLowerCase().startsWith("c:\\sensitive"),
      realpath: (location) => {
        const resolved = path.win32.resolve(location);
        const folded = resolved.toLowerCase();
        if (folded === "c:\\ordinary") return "C:\\Ordinary";
        if (folded === "c:\\ordinary\\repo") return "C:\\Ordinary\\Repo";
        if (resolved === "C:\\Sensitive") return resolved;
        if (resolved === "C:\\Sensitive\\Project") return resolved;
        if (resolved === "C:\\Sensitive\\project") return resolved;
        if (/^\\\\[^\\]+\\[^\\]+\\Work$/i.test(resolved)) return resolved;
        return missing();
      },
    });
    assert.equal(
      windows.resolve("C:\\ORDINARY\\repo").key,
      windows.resolve("c:\\ordinary\\REPO").key,
      "ordinary Windows aliases converge through physical spelling",
    );
    assert.notEqual(
      windows.resolve("C:\\Sensitive\\Project").key,
      windows.resolve("C:\\Sensitive\\project").key,
      "case-sensitive Windows siblings remain distinct",
    );
    assert.notEqual(
      windows.resolve("C:\\Sensitive\\Project\\Future.ts").key,
      windows.resolve("C:\\Sensitive\\Project\\future.ts").key,
      "missing descendants inherit sensitive ownership",
    );
    assert.equal(
      windows.resolve("C:\\Ordinary\\Repo\\Future.ts").key,
      windows.resolve("c:\\ordinary\\repo\\future.ts").key,
      "missing descendants inherit insensitive ownership",
    );
    assert.equal(
      windows.resolve("\\\\SERVER\\Share\\Work").key,
      windows.resolve("\\\\server\\share\\Work").key,
      "UNC authority and share aliases identify one volume",
    );

    const actualRoot = TestProject.tmpdir(
      "ttsc-project-input-empty-case-semantics-",
    );
    const insensitiveRoot = path.join(actualRoot, "insensitive");
    fs.mkdirSync(insensitiveRoot);
    fs.writeFileSync(path.join(actualRoot, "Marker.txt"), "", "utf8");
    const actual = createProjectInputPathIdentityContext();
    const markerAliasExists = fs.existsSync(
      path.join(actualRoot, "mARKER.TXT"),
    );
    assert.equal(
      actual.resolve(path.join(insensitiveRoot, "Spec.md")).key ===
        actual.resolve(path.join(insensitiveRoot, "spec.md")).key,
      markerAliasExists,
      "an empty directory must inherit its volume's case semantics",
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
    const sensitiveActual = createProjectInputPathIdentityContext();
    assert.notEqual(
      sensitiveActual.resolve(path.join(sensitiveRoot, "Spec.md")).key,
      sensitiveActual.resolve(path.join(sensitiveRoot, "spec.md")).key,
      "an empty sensitive directory must not depend on localized fsutil text",
    );
    fs.writeFileSync(path.join(sensitiveRoot, "Marker.txt"), "", "utf8");
  };
