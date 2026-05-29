import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies lint format statements: splits a one-liner, reindents, trims blanks.
 *
 * The fixture pins the statement-split + indent + trailing-blank-trim +
 * no-over-break fixes end-to-end. The source packs four statements onto one
 * leading-indented line and trails a blank line plus a whitespace-only line.
 * After `ttsc format` each statement must land on its own column-zero line, the
 * stray leading indent must be dropped, the trailing blank and whitespace-only
 * lines must collapse to a single final newline, and the `console.log(a, b, c)`
 * call must stay flat — the always-on rules split and reindent without
 * over-breaking a call that already fits the print width.
 *
 * 1. Copy `fixtures/format-projects/format-statements` into a temp project.
 * 2. Run `ttsc format` through the real launcher with `@ttsc/lint` linked.
 * 3. Assert the rewritten source matches `expected/main.ts` exactly.
 */
export const test_lint_format_statements_splits_and_reindents_oneliner = () => {
  const fixture = path.join(
    process.cwd(),
    "fixtures",
    "format-projects",
    "format-statements",
  );
  const expectedSource = fs.readFileSync(
    path.join(fixture, "expected", "main.ts"),
    "utf8",
  );
  const root = path.join(
    TestProject.tmpdir("ttsc-lint-format-stmt-"),
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
