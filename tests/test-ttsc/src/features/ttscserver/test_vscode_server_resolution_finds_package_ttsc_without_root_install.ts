import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies VS Code server resolution finds a per-package ttsc when the root has
 * none.
 *
 * A common monorepo shape installs `ttsc` in each `packages/*` package but not
 * in the root package.json. The extension resolves the launcher by walking up
 * from the open file's directory, not from the workspace root, so an open
 * package file still finds `packages/app/node_modules/ttsc`. The root-anchored
 * candidate must fail to resolve without throwing — the extension drops it and
 * relies on the file-anchored candidate, so a bare root never blocks a package
 * that carries its own ttsc.
 *
 * 1. Create a workspace whose root has no ttsc but a package installs its own.
 * 2. Resolve the launcher from the package file's directory and from the root.
 * 3. Assert the package file finds the nested launcher and the root finds none.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveTtscServerLauncher finds the file-anchored package launcher while the empty workspace root resolves nothing.
 * @evidence contracts/testing.md#independent-expectations Node package resolution follows ancestors from the supplied absolute anchor.
 * @evidence contracts/testing.md#distinguishing-cases nested package manifest and launcher contrast with an uninstalled workspace-root anchor.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_resolution_finds_package_ttsc_without_root_install function runs under src/features/ttscserver and calls authored serverResolution functions directly; fixture manifests are resolver input, and no language client or product process starts.
 */
export function test_vscode_server_resolution_finds_package_ttsc_without_root_install() {
  const repo = TestProject.WORKSPACE_ROOT;
  const workspace = TestProject.physicalPath(
    TestProject.tmpdir("vscode-nested-ttsc-"),
  );
  const packageDir = path.join(workspace, "packages", "app");
  const fileDir = path.join(packageDir, "src");
  const ttscPackage = path.join(packageDir, "node_modules", "ttsc");
  const launcher = path.join(ttscPackage, "lib", "launcher", "ttscserver.js");

  fs.writeFileSync(
    path.join(workspace, "package.json"),
    JSON.stringify({ private: true, name: "workspace-root" }, null, 2),
  );
  fs.mkdirSync(fileDir, { recursive: true });
  fs.writeFileSync(path.join(fileDir, "main.ts"), "export {};\n");
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(
    path.join(ttscPackage, "package.json"),
    JSON.stringify(
      {
        name: "ttsc",
        bin: { ttscserver: "lib/launcher/ttscserver.js" },
        exports: { "./package.json": "./package.json" },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(launcher, "module.exports = {};\n");

  const observed = (() => {
    return {
      fromFile: mod.resolveTtscServerLauncher(fileDir) ?? "",
      fromRoot: mod.resolveTtscServerLauncher(workspace) ?? "",
    };
  })();
  const resolved = observed as {
    fromFile: string;
    fromRoot: string;
  };
  assert.equal(
    path.normalize(resolved.fromFile),
    path.normalize(launcher),
    "package file walks up to its own node_modules ttsc launcher",
  );
  assert.equal(
    resolved.fromRoot,
    "",
    "root without ttsc resolves no launcher and is dropped, not thrown",
  );
}
