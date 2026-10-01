import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

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
 * disk under `ttsc fix`.
 *
 * 1. Copy `fixtures/fix-projects/contributor-fixes` into a temp project.
 * 2. Symlink both `@ttsc/lint` and `lint-contributor-demo` into the temp project's
 *    `node_modules` so the host's plugin resolver finds them.
 * 3. Run `ttsc fix` and assert the rewritten source matches the fixture's
 *    `expected/main.ts`, while the on-disk fixture stays untouched.
 *
 * @evidence contracts/testing.md#behavioral-verification The real ttsc fix command links the demo contributor and must capitalize both exported value identifiers through contributor TextEdits, matching the expected file and preserving the original fixture.
 * @evidence contracts/testing.md#independent-expectations The demo capitalize-exports rule and authored Value/Other fixture output define the expected edits independently of the native bridge.
 * @evidence contracts/testing.md#distinguishing-cases Two lowercase exported identifiers require distinct edits; whole-file equality preserves numeric initializer meaning and rejects lost or additional rewrites. Contributor option/report-only distinctions execute in the shared contributor diagnostic batch.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns contributor source linking, rule registration, edit transport and actual file publication; direct Go contributor rule units do not publish through the launcher.
 * @evidence contracts/e2e.md#necessary-boundary The contributor adapter must carry TextEdits into the native fix engine and selected consumer file; correct direct rule output alone cannot prove this connection.
 * @evidence contracts/e2e.md#shared-execution The immutable workspace demo source gives the same contributor producer identity as the shared diagnostic batch. One separate fix invocation remains because check cannot prove writable publication.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the private fixture copy is writable. The builtin-plus-demo cache key includes actual contributor, SDK and toolchain inputs; no mutation or cold-cache claim is made, and the copy is removed in finally.
 * @evidence contracts/e2e.md#preserved-coverage Original success exit, exact capitalized output and checked-in source immutability assertions remain. The readonly contributor batch preserves diagnostics and option transport while this entry preserves write transport.
 */
export function test_lint_fix_contributor_rule_single_edit_applies_through_native_engine() {
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
      TestProject.tmpdir("ttsc-lint-fix-contrib-"),
      "project",
    );

    try {
      fs.cpSync(fixture, root, { recursive: true });
      linkWorkspacePackage(root, "@ttsc/lint", ["packages", "lint"]);
      linkWorkspacePackage(root, "lint-contributor-demo", [
        "packages",
        "lint",
        "test",
        "lint-contributor-demo",
      ]);

      const result = TestProject.spawn(
        TestProject.TTSC_BIN,
        ["fix", "--cwd", root],
        {
          cwd: root,
          env: {
            PATH: goPath(),
            TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
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
  }

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
