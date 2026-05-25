import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
 */
export const test_vscode_multi_root_client_specs_scope_document_selectors =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const workspace = TestProject.tmpdir("vscode-multi-root-");
    const left = path.join(workspace, "pkg[one]");
    const right = path.join(workspace, "right");
    for (const root of [left, right]) {
      fs.mkdirSync(path.join(root, "src"), { recursive: true });
      fs.writeFileSync(path.join(root, "tsconfig.json"), "{}\n");
      fs.writeFileSync(path.join(root, "src", "main.ts"), "export {};\n");
    }

    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      const candidates = mod.createResolutionCandidates({
        activeFile: ${JSON.stringify(path.join(right, "src", "main.ts"))},
        activeWorkspaceRoot: ${JSON.stringify(right)},
        workspaceRoots: [${JSON.stringify(left)}, ${JSON.stringify(right)}],
      });
      class FakeRelativePattern {
        constructor(base, pattern) {
          this.base = base;
          this.pattern = pattern;
        }
      }
      const unique = [...new Map(candidates.map((entry) => [
        entry.cwd,
        {
          cwd: entry.cwd,
          pattern: mod.createDocumentSelectorPattern(FakeRelativePattern, entry.cwd),
          tsconfig: entry.tsconfig,
        },
      ])).values()];
      console.log(JSON.stringify(unique));
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
        cwd: repo,
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const roots = JSON.parse(result.stdout) as {
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
      assert.deepEqual(entry.pattern, { base: entry.cwd, pattern: "**/*" });
    }
  };
