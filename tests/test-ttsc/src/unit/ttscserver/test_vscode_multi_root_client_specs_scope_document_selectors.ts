import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies VS Code multi-root planning keeps project roots separate.
 *
 * The extension used to keep one global language client with a workspace-wide
 * selector, letting whichever root started first handle every TS/JS document.
 * The pure resolution helpers now expose enough state for the extension to
 * start one client per project root and give each client a RelativePattern
 * selector scoped to that literal root, even when the path contains glob
 * metacharacters.
 *
 * 1. Create two workspace roots with independent tsconfig files.
 * 2. Import the VS Code resolution helper through Node's TypeScript loader.
 * 3. Deduplicate candidates the same way the extension does.
 * 4. Assert both roots remain distinct and selectors are root-scoped.
 *
 * @evidence contracts/testing.md#behavioral-verification createResolutionCandidates and createDocumentSelectorPattern keep both independent project clients and instantiate literal-root selectors.
 * @evidence contracts/testing.md#independent-expectations recursive selectors must be anchored to each actual root even when a root name contains glob metacharacters.
 * @evidence contracts/testing.md#distinguishing-cases two configured roots including pkg[one] retain their own tsconfig and pattern base; the injected constructor instance and its complete own fields are checked.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_multi_root_client_specs_scope_document_selectors function runs under src/unit/ttscserver and calls the authored resolution or launch-planning operations directly; no extension host or child process starts, and real shim spawn remains in E2E.
 */
export function test_vscode_multi_root_client_specs_scope_document_selectors() {
    const repo = TestProject.WORKSPACE_ROOT;
    const workspace = TestProject.tmpdir("vscode-multi-root-");
    const left = path.join(workspace, "pkg[one]");
    const right = path.join(workspace, "right");
    for (const root of [left, right]) {
      fs.mkdirSync(path.join(root, "src"), { recursive: true });
      fs.writeFileSync(path.join(root, "tsconfig.json"), "{}\n");
      fs.writeFileSync(path.join(root, "src", "main.ts"), "export {};\n");
    }

    class FakeRelativePattern {
      constructor(public base: string, public pattern: string) {}
    }
    const observed = (() => {
      const candidates = mod.createResolutionCandidates({
        activeFile: (path.join(right, "src", "main.ts")),
        activeWorkspaceRoot: (right),
        workspaceRoots: [(left), (right)],
      });
      
      const unique = [...new Map(candidates.map((entry) => [
        entry.cwd,
        {
          cwd: entry.cwd,
          pattern: mod.createDocumentSelectorPattern(FakeRelativePattern, entry.cwd),
          tsconfig: entry.tsconfig,
        },
      ])).values()];
      return unique;
    
  })();
    const roots = observed as {
      cwd: string;
      pattern: { base: string; pattern: string };
      tsconfig: string;
    }[];
    assert.deepEqual(
      roots.map((entry) => path.normalize(entry.cwd)).sort(),
      [left, right].map((entry) => path.normalize(entry)).sort(),
    );
    for (const entry of roots) {
      assert.equal(
        path.normalize(entry.tsconfig),
        path.normalize(path.join(entry.cwd, "tsconfig.json")),
      );
      assert.ok(entry.pattern instanceof FakeRelativePattern);
      assert.deepEqual({ ...entry.pattern }, { base: entry.cwd, pattern: "**/*" });
    }
}
