import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { PackedUnpluginPackage } from "./PackedUnpluginPackage";

/**
 * Pack `@ttsc/unplugin` exactly as it would be published and extract it.
 *
 * `pnpm pack` is offline and deterministic, and it rewrites `workspace:^` to
 * the concrete caret range a real consumer's package manager sees, the
 * published dependency contract. Reading that manifest, rather than the source
 * one, proves the contract a clean install would receive without a network
 * install.
 */
export function packUnpluginPackage(): PackedUnpluginPackage {
  const unpluginDir = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "unplugin",
  );
  const dest = TestProject.tmpdir("ttsc-unplugin-pack-");
  const packArgs = ["pack", "--pack-destination", dest];
  const pack = spawnSync(
    process.platform === "win32" ? "cmd.exe" : "pnpm",
    process.platform === "win32"
      ? ["/d", "/s", "/c", "pnpm", ...packArgs]
      : packArgs,
    {
      cwd: unpluginDir,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(pack.status, 0, `pnpm pack failed:\n${pack.stderr}`);

  const tarball = fs.readdirSync(dest).find((name) => name.endsWith(".tgz"));
  assert.ok(tarball, "pnpm pack produced no tarball");

  // Extract through the platform tar (bsdtar on Windows, GNU tar elsewhere).
  // Run with `cwd: dest` and a relative tarball name so a Windows drive-letter
  // colon is never mistaken for a remote `host:path` spec by GNU tar.
  const extract = path.join(dest, "extract");
  fs.mkdirSync(extract);
  const unpack = spawnSync("tar", ["-xzf", tarball, "-C", "extract"], {
    cwd: dest,
    encoding: "utf8",
  });
  assert.equal(unpack.status, 0, `tar extraction failed:\n${unpack.stderr}`);
  const packageRoot = path.join(extract, "package");
  return {
    manifest: JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    ),
    packageRoot,
  };
}
