import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Verifies VS Code server resolution uses the exported `ttsc/package.json`
 * anchor.
 *
 * The extension used to resolve `ttsc/lib/launcher/ttscserver.js` as a package
 * subpath, which Node rejects when `ttsc` has an `exports` map. This pins the
 * replacement path: resolve the exported package manifest first, then locate
 * the launcher as a sibling file on disk.
 *
 * 1. Create a package-shaped project whose fake `ttsc` exports only
 *    `./package.json`.
 * 2. Assert the old direct subpath resolution fails under package exports.
 * 3. Call the authored VS Code resolution helper in the unit process.
 * 4. Assert the non-exported launcher file is still found.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveTtscServerLauncher reaches the launcher through an exported package manifest when a deep import is blocked.
 * @evidence contracts/testing.md#independent-expectations Node export encapsulation blocks the independently asserted deep import but the public package.json anchor locates its launcher.
 * @evidence contracts/testing.md#distinguishing-cases the same synthetic package refuses the private deep specifier and permits the supported manifest-derived launcher.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_resolution_uses_package_json_anchor function runs under src/features/ttscserver and calls authored serverResolution functions directly; fixture manifests are resolver input, and no language client or product process starts.
 */
export function test_vscode_server_resolution_uses_package_json_anchor() {
  const root = TestProject.WORKSPACE_ROOT;
  const project = TestProject.physicalPath(
  TestProject.tmpdir("vscode-server-resolution-"),
  );
  const ttscPackage = path.join(project, "node_modules", "ttsc");
  const launcher = path.join(ttscPackage, "lib", "launcher", "ttscserver.js");
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(
  path.join(ttscPackage, "package.json"),
  JSON.stringify(
    {
      bin: {
        ttscserver: "lib/launcher/ttscserver.js",
      },
      name: "ttsc",
      exports: {
        "./package.json": "./package.json",
      },
    },
    null,
    2,
  ),
  );
  fs.writeFileSync(launcher, "module.exports = {};\n");

  const requireFromProject = createRequire(
  path.join(project, "__resolution_test__.cjs"),
  );
  assert.throws(
  () => requireFromProject.resolve("ttsc/lib/launcher/ttscserver.js"),
  (error: unknown) =>
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
  );

  const observed = mod.resolveTtscServerLauncher(project) ?? "";
  assert.equal(path.normalize(observed), path.normalize(launcher));
}
