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
 * 2. Call createResolutionCandidates with the second root as the active file's
 *    workspace and both roots as workspace roots.
 * 3. Build one selector per distinct candidate cwd with a fake RelativePattern
 *    constructor passed to createDocumentSelectorPattern.
 * 4. Assert both roots remain distinct and selectors are root-scoped.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createResolutionCandidates and createDocumentSelectorPattern from the real serverResolution module over two temp workspace roots on disk and asserts the resulting cwd, tsconfig and selector objects.
 * @evidence contracts/testing.md#independent-expectations The expected cwd set is the two authored roots, the expected tsconfig is each root's own tsconfig.json, and the expected selector is a constructor instance with the literal base equal to that root and the pattern "**/*", so a root containing glob metacharacters (pkg[one]) must not be folded into the glob string.
 * @evidence contracts/testing.md#distinguishing-cases Two roots, one named pkg[one] and one plain `right` (also the active file's root), must both survive as separate candidates, each with its own tsconfig and its own selector base; the fake constructor is checked with instanceof and its own fields are compared completely.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it calls the pure resolution helpers over files written to a TestProject.tmpdir, with a fake RelativePattern class, and starts no VS Code extension host, language client or child process.
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
