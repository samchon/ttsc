import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Verifies lint format whitespace: cleans code around multi-line and nested
 * template literals without touching their interiors.
 *
 * The fixture interleaves leading blank lines, trailing-whitespace runs, and a
 * three-blank-line gap with a multi-line template carrying a `${}` substitution
 * and a nested backtick template. The hygiene rule must strip the surrounding
 * cruft and add a single final newline while every byte inside the templates —
 * trailing spaces, a tab, and a blank line that are all string content — survives
 * verbatim, proving the template-range guard is keyed on the newline's strict
 * containment rather than a whole-file rewrite.
 *
 * 1. Copy `fixtures/format-projects/format-template-interleave` into a temp
 *    project.
 * 2. Run `ttsc format` through the real launcher with `@ttsc/lint` linked.
 * 3. Assert the rewritten source matches `expected/main.ts` exactly.
 */
export const test_lint_format_template_interleave_preserves_interiors = () => {
  const fixture = path.join(
    process.cwd(),
    "fixtures",
    "format-projects",
    "format-template-interleave",
  );
  const expectedSource = fs.readFileSync(
    path.join(fixture, "expected", "main.ts"),
    "utf8",
  );
  const root = path.join(
    TestProject.tmpdir("ttsc-lint-format-tpl-"),
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
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-lint-format-tpl-cache-"),
          TTSC_GO_BINARY: goBinary(),
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(path.join(root, "src", "main.ts"), "utf8"),
      expectedSource,
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
