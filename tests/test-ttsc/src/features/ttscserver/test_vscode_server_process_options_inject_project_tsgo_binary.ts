import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies VS Code server process options inject the project tsgo binary.
 *
 * The extension launches the workspace's `ttscserver`, but the native server
 * still needs the matching project-local TypeScript-Go executable. This pins
 * the helper that resolves `@typescript/native-preview` from the project and
 * passes the platform package's `tsgo` path through `TTSC_TSGO_BINARY`.
 *
 * 1. Create a package-shaped project with fake `@typescript/native-preview` and
 *    platform package manifests.
 * 2. Import the VS Code resolution helper through Node's TypeScript loader.
 * 3. Assert `serverProcessOptions` keeps `cwd` and injects the resolved binary.
 */
export const test_vscode_server_process_options_inject_project_tsgo_binary =
  () => {
    const root = TestProject.WORKSPACE_ROOT;
    const project = TestProject.tmpdir("vscode-server-process-options-");
    const nativePreview = path.join(
      project,
      "node_modules",
      "@typescript",
      "native-preview",
    );
    const platformPackage = path.join(
      project,
      "node_modules",
      "@typescript",
      `native-preview-${process.platform}-${process.arch}`,
    );
    const binary = path.join(
      platformPackage,
      "lib",
      process.platform === "win32" ? "tsgo.exe" : "tsgo",
    );
    fs.mkdirSync(nativePreview, { recursive: true });
    fs.mkdirSync(path.dirname(binary), { recursive: true });
    fs.writeFileSync(
      path.join(nativePreview, "package.json"),
      JSON.stringify({ name: "@typescript/native-preview" }, null, 2),
    );
    fs.writeFileSync(
      path.join(platformPackage, "package.json"),
      JSON.stringify(
        {
          name: `@typescript/native-preview-${process.platform}-${process.arch}`,
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(binary, "");

    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(root, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      const options = mod.serverProcessOptions(${JSON.stringify(project)});
      console.log(JSON.stringify({
        cwd: options?.cwd,
        tsgo: options?.env?.TTSC_TSGO_BINARY,
      }));
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
    const parsed = JSON.parse(result.stdout) as {
      cwd?: string;
      tsgo?: string;
    };
    assert.equal(path.normalize(parsed.cwd ?? ""), path.normalize(project));
    assert.equal(path.normalize(parsed.tsgo ?? ""), path.normalize(binary));
  };
