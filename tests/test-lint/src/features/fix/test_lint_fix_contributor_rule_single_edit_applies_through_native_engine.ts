import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Verifies lint fix: contributor rule single-edit applies through the native
 * fix engine.
 *
 * Closes the largest coverage gap on the `@ttsc/lint` contributor surface: the
 * path through `rule.Context.ReportRangeFix` → `contributorAdapter` →
 * `engine.Context.ReportRangeFix` → `runFix` → `applyFindingFixes` is
 * structurally complete but unexercised end-to-end. A regression in any step
 * would either drop the edit silently or apply it to the wrong file; this test
 * pins the contract that a contributor-emitted TextEdit rewrites the source on
 * disk under `ttsc --fix`.
 *
 * 1. Copy `fixtures/fix-projects/contributor-fixes` into a temp project.
 * 2. Symlink both `@ttsc/lint` and `lint-contributor-demo` into the temp project's
 *    `node_modules` so the host's plugin resolver finds them.
 * 3. Run `ttsc --fix` and assert the rewritten source matches the fixture's
 *    `expected/main.ts`, while the on-disk fixture stays untouched.
 */
export const test_lint_fix_contributor_rule_single_edit_applies_through_native_engine =
  () => {
    const fixture = path.join(
      process.cwd(),
      "fixtures",
      "fix-projects",
      "contributor-fixes",
    );
    const originalSource = fs.readFileSync(
      path.join(fixture, "src", "main.ts"),
      "utf8",
    );
    const expectedSource = fs.readFileSync(
      path.join(fixture, "expected", "main.ts"),
      "utf8",
    );
    const root = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-fix-contrib-")),
      "project",
    );

    try {
      fs.cpSync(fixture, root, { recursive: true });
      linkWorkspacePackage(root, "@ttsc/lint", ["packages", "lint"]);
      linkWorkspacePackage(root, "lint-contributor-demo", [
        "tests",
        "lint-contributor-demo",
      ]);

      const result = TestProject.spawn(
        TestProject.TTSC_BIN,
        ["--cwd", root, "--fix"],
        {
          cwd: root,
          env: {
            PATH: goPath(),
            TTSC_CACHE_DIR: fs.mkdtempSync(
              path.join(os.tmpdir(), "ttsc-lint-fix-contrib-cache-"),
            ),
            TTSC_GO_BINARY: goBinary(),
          },
        },
      );

      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        fs.readFileSync(path.join(root, "src", "main.ts"), "utf8"),
        expectedSource,
      );
      assert.equal(
        fs.readFileSync(path.join(fixture, "src", "main.ts"), "utf8"),
        originalSource,
      );
    } finally {
      fs.rmSync(path.dirname(root), { recursive: true, force: true });
    }
  };

function linkWorkspacePackage(
  projectRoot: string,
  packageName: string,
  workspaceSegments: string[],
): void {
  const target = path.join(TestProject.WORKSPACE_ROOT, ...workspaceSegments);
  const linkPath = path.join(projectRoot, "node_modules", packageName);
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(target, linkPath, "junction");
}

function goPath(): string | undefined {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

function goBinary(): string {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin", "go");
  return fs.existsSync(localGo) ? localGo : "go";
}
