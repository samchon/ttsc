import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies lint format whitespace: trims lines and consecutive blanks while
 * preserving template literal interiors.
 *
 * The fixture pins the whitespace rule's two opposing duties. Trailing spaces
 * after a statement and a run of three blank lines must be removed (the blanks
 * collapsing to a single one), yet the significant trailing spaces living
 * inside a multi-line template literal must survive untouched. After `ttsc
 * format` the outside trailing whitespace and extra blank lines are gone while
 * the spaces between "space" and the line break inside the backticks stay
 * exactly as authored — the rule trims insignificant whitespace without
 * reaching into template contents.
 *
 * 1. Copy `fixtures/format-projects/format-whitespace` into a temp project.
 * 2. Run `ttsc format` through the real launcher with `@ttsc/lint` linked.
 * 3. Assert the rewritten source matches `expected/main.ts` exactly.
 */
export const test_lint_format_whitespace_trims_lines_and_preserves_template =
  () => {
    const fixture = path.join(
      process.cwd(),
      "fixtures",
      "format-projects",
      "format-whitespace",
    );
    const expectedSource = fs.readFileSync(
      path.join(fixture, "expected", "main.ts"),
      "utf8",
    );
    const root = path.join(
      TestProject.tmpdir("ttsc-lint-format-ws-"),
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
