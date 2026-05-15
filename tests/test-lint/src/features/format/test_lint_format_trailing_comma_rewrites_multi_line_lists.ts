import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Verifies lint format trailing-comma: rewrites multi-line lists end-to-end.
 *
 * The fixture mixes arrays, objects, function parameters, and nested call
 * arguments to exercise every dispatch branch in one pass. The single-line
 * call at the bottom is the negative anchor: the launcher run must not
 * touch it.
 *
 * 1. Copy `fixtures/format-projects/format-trailing-comma` into a temp project.
 * 2. Run `ttsc --format` through the real launcher with `@ttsc/lint` linked.
 * 3. Assert the rewritten source matches `expected/main.ts` exactly.
 */
export const test_lint_format_trailing_comma_rewrites_multi_line_lists = () => {
  const fixture = path.join(
    process.cwd(),
    "fixtures",
    "format-projects",
    "format-trailing-comma",
  );
  const expectedSource = fs.readFileSync(
    path.join(fixture, "expected", "main.ts"),
    "utf8",
  );
  const root = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-format-tc-")),
    "project",
  );

  try {
    fs.cpSync(fixture, root, { recursive: true });
    linkLintPackage(root);

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--format"],
      {
        cwd: root,
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: fs.mkdtempSync(
            path.join(os.tmpdir(), "ttsc-lint-format-tc-cache-"),
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
