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
 * 2. Call `serverProcessOptions` with the project directory.
 * 3. Assert it keeps `cwd` and sets `env.TTSC_TSGO_BINARY` to the platform
 *    package's binary.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the real serverProcessOptions, which resolves typescript and its platform package from the temp project's node_modules, and asserts the returned cwd and env.TTSC_TSGO_BINARY.
 * @evidence contracts/testing.md#independent-expectations The expected binary is the authored path of the lib/tsc (lib/tsc.exe on win32) file the test wrote inside the fixture's @typescript/typescript-<platform>-<arch> package, not a value read back from the resolver.
 * @evidence contracts/testing.md#distinguishing-cases A single positive case: a project-local typescript package and platform package with an existing binary. The absent-binary case (environment left unchanged) and an empty cwd (undefined) are not covered here, and no second compiler is present to contrast with.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it calls serverProcessOptions over package.json files and an empty binary written into a TestProject.tmpdir tree, never executing the binary, and starts no extension host or child process.
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
