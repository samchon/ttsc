import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Verifies lint format: native project fixture rewrites only the temp copy.
 *
 * Locks the observable `ttsc format` behavior against a checked-in project
 * fixture. The source fixture must stay immutable; the command runs against a
 * writable copy so the test can inspect real file changes without damaging the
 * repository baseline. Mirrors the `fix` end-to-end test so any future
 * divergence between the two subcommand contracts is immediately visible.
 *
 * 1. Copy `fixtures/format-projects/format-semi` into a temp project.
 * 2. Run `ttsc format` through the real launcher with `@ttsc/lint` linked.
 * 3. Assert the temp source matches `expected/main.ts` and the fixture source is
 *    unchanged.
 */
export const test_lint_format_native_project_rewrites_temp_copy_only = () => {
  const fixture = path.join(
    process.cwd(),
    "fixtures",
    "format-projects",
    "format-semi",
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
    TestProject.tmpdir("ttsc-lint-format-project-"),
    "project",
  );

  try {
    fs.cpSync(fixture, root, { recursive: true });
    linkLintPackage(root);

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["format", "--cwd", root],
      {
        cwd: root,
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-lint-format-cache-"),
          TTSC_GO_BINARY: goBinary(),
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    // Format is write-only: no diagnostics, no `[formatSemi]` banner.
    assert.doesNotMatch(result.stderr ?? "", /\[format\/semi\]/);
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
