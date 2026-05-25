import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
 * 3. Import the VS Code resolution helper through Node's TypeScript loader.
 * 4. Assert the non-exported launcher file is still found.
 */
export const test_vscode_server_resolution_uses_package_json_anchor = () => {
  const root = TestProject.WORKSPACE_ROOT;
  const project = TestProject.tmpdir("vscode-server-resolution-");
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

  const script = `
    import { pathToFileURL } from "node:url";
    const mod = await import(pathToFileURL(${JSON.stringify(
      path.join(root, "packages", "vscode", "src", "serverResolution.ts"),
    )}).href);
    console.log(mod.resolveTtscServerLauncher(${JSON.stringify(project)}) ?? "");
  `;
  const result = spawnSync(
    process.execPath,
    [
      "--disable-warning=ExperimentalWarning",
      "--experimental-transform-types",
      "--input-type=module",
      "--eval",
      script,
    ],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(path.normalize(result.stdout.trim()), path.normalize(launcher));
};
