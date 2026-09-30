import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies VS Code server process options inject the project tsgo binary.
 *
 * The extension launches the workspace's `ttscserver`, but the native server
 * still needs the matching project-local TypeScript-Go executable. This pins
 * the helper that resolves `typescript` from the project and passes the
 * platform package's `tsc` path through `TTSC_TSGO_BINARY`.
 *
 * 1. Create a package-shaped project with a fake `typescript` package and its
 *    platform package manifests.
 * 2. Import the VS Code resolution helper through Node's TypeScript loader.
 * 3. Assert `serverProcessOptions` keeps `cwd` and injects the resolved binary.
 *
 * @evidence contracts/testing.md#behavioral-verification serverProcessOptions preserves cwd and injects the compiler path resolved from fixture manifests.
 * @evidence contracts/testing.md#independent-expectations the server must use the owning project platform package rather than a workspace compiler; the independently authored absolute binary path is the oracle.
 * @evidence contracts/testing.md#distinguishing-cases the fixture has project-local typescript and the current platform manifest with an existing binary; the returned cwd and TTSC_TSGO_BINARY are independently asserted.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_process_options_inject_project_tsgo_binary function runs under src/unit/ttscserver and calls the authored resolution or launch-planning operations directly; no extension host or child process starts, and real shim spawn remains in E2E.
 */
export function test_vscode_server_process_options_inject_project_tsgo_binary() {
    const root = TestProject.WORKSPACE_ROOT;
    const project = TestProject.physicalPath(
      TestProject.tmpdir("vscode-server-process-options-"),
    );
    const nativePreview = path.join(project, "node_modules", "typescript");
    const platformPackage = path.join(
      project,
      "node_modules",
      "@typescript",
      `typescript-${process.platform}-${process.arch}`,
    );
    const binary = path.join(
      platformPackage,
      "lib",
      process.platform === "win32" ? "tsc.exe" : "tsc",
    );
    fs.mkdirSync(nativePreview, { recursive: true });
    fs.mkdirSync(path.dirname(binary), { recursive: true });
    fs.writeFileSync(
      path.join(nativePreview, "package.json"),
      JSON.stringify({ name: "typescript" }, null, 2),
    );
    fs.writeFileSync(
      path.join(platformPackage, "package.json"),
      JSON.stringify(
        {
          name: `@typescript/typescript-${process.platform}-${process.arch}`,
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(binary, "");

    const observed = (() => {
      const options = mod.serverProcessOptions((project));
      return {
        cwd: options?.cwd,
        tsgo: options?.env?.TTSC_TSGO_BINARY,
      };
    
  })();
    const parsed = observed as {
      cwd?: string;
      tsgo?: string;
    };
    assert.equal(path.normalize(parsed.cwd ?? ""), path.normalize(project));
    assert.equal(path.normalize(parsed.tsgo ?? ""), path.normalize(binary));
}
