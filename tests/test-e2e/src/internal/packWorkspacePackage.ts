import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { pnpmInvocation } from "./pnpmInvocation";

const { spawnSync } = E2eProcessTrace;

/**
 * Materialize a published workspace package at a fixture's dependency path.
 * Packing resolves workspace ranges and publication overrides and carries every
 * asset the package ships. The fixture supplies its dependency graph.
 */
export function packWorkspacePackage(directory: string, target: string): void {
  const archiveDir = TestProject.tmpdir("ttsc-package-archive-");
  const archiveName = "package.tgz";
  const invocation = pnpmInvocation([
    "pack",
    "--out",
    path.join(archiveDir, archiveName),
  ]);
  const pack = spawnSync(invocation.binary, invocation.args, {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.ifError(pack.error);
  assert.equal(pack.status, 0, pack.stdout + pack.stderr);

  // A relative archive name works with both bsdtar and GNU tar on Windows.
  fs.mkdirSync(target, { recursive: true });
  const unpack = spawnSync(
    "tar",
    ["-xzf", archiveName, "--strip-components=1", "-C", target],
    { cwd: archiveDir, encoding: "utf8", windowsHide: true },
  );
  assert.ifError(unpack.error);
  assert.equal(unpack.status, 0, unpack.stdout + unpack.stderr);
}
