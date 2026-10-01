import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies lint fix: native project fixture rewrites only the temp copy.
 *
 * Locks the observable `ttsc fix` behavior against a checked-in project
 * fixture. The source fixture must stay immutable; the command runs against a
 * writable copy so the test can inspect real file changes without damaging the
 * repository baseline.
 *
 * 1. Copy `fixtures/fix-projects/native-fixes` into a temp project.
 * 2. Run `ttsc fix` through the real launcher with `@ttsc/lint` linked.
 * 3. Assert the temp source matches `expected/main.ts` and the fixture source is
 *    unchanged.
 *
 * @evidence contracts/testing.md#behavioral-verification The real ttsc fix command must apply no-var, prefer-const and safe eqeqeq edits to the writable project and retain an unfixed eqeqeq warning, while the original fixture stays unchanged.
 * @evidence contracts/testing.md#independent-expectations The authored expected file fixes immutable declarations and typeof equality while preserving the reassigned declaration and unsafe equality, independently specifying the supported autofix policy.
 * @evidence contracts/testing.md#distinguishing-cases Original var and immutable let declarations change to const, typeof equality becomes strict, but the mutated let and unsafe value equality remain; exact whole-file comparison rejects extra edits.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns launcher-to-native fix publication. Rule and edit selection semantics remain in Go units; this boundary verifies edits reach the selected consumer file.
 * @evidence contracts/e2e.md#necessary-boundary The native command must write selected edits and return its remaining warning through the launcher, rather than merely calculating correct in-memory fixes.
 * @evidence contracts/e2e.md#shared-execution One builtin fix command reuses the same immutable lint producer and content-keyed cache as other builtin consumers. Format and contributor fix have distinct write policies or source identities and remain separate commands.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private writable fixture copy receives edits, then is removed in finally. Workspace lint bytes do not mutate, so existing cached native identity is equivalent, and the checked-in baseline is asserted unchanged.
 * @evidence contracts/e2e.md#preserved-coverage The original exit-zero, eqeqeq warning, exact edited bytes and original-fixture immutability assertions remain executable here, including reassignment and unsafe-equality negatives.
 */
export function test_lint_fix_native_project_rewrites_temp_copy_only() {
  const fixture = path.join(
    process.cwd(),
    "fixtures",
    "fix-projects",
    "native-fixes",
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
    TestProject.tmpdir("ttsc-lint-fix-project-"),
    "project",
  );

  try {
    fs.cpSync(fixture, root, { recursive: true });
    linkLintPackage(root);

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
    assert.match(result.stderr, /\[eqeqeq\]/);
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

function linkLintPackage(root: string): void {
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  fs.symlinkSync(
    path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
    path.join(linkDir, "lint"),
    "junction",
  );
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
