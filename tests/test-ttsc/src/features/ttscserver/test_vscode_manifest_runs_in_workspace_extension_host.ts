import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies VS Code manifest runs the extension in the workspace host.
 *
 * The extension resolves project-local `ttsc`, `ttscserver`, TypeScript-Go, and
 * plugin files from the active workspace. Remote VS Code sessions must
 * therefore load it where the workspace filesystem and tools live, not only
 * beside the UI.
 *
 * 1. Read the packaged VS Code extension manifest.
 * 2. Inspect the `extensionKind` declaration.
 * 3. Assert it prefers the workspace extension host.
 */
export const test_vscode_manifest_runs_in_workspace_extension_host = () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        "vscode",
        "package.json",
      ),
      "utf8",
    ),
  ) as {
    extensionKind?: string[];
  };

  assert.deepEqual(manifest.extensionKind, ["workspace"]);
};
