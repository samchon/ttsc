import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies lint format nested blocks: splits and reindents crammed statements
 * at four nesting depths in one pass.
 *
 * The fixture pins the statement-split + indent cascade through a function ->
 * if -> for -> bare-block stack where statements are crammed onto shared lines
 * and mis-indented at several depths at once. Each statement must land on its
 * own line at exactly `depth * 2` columns while the pre-aligned closing braces
 * (which are not statements and so are never touched by the indent rule) stay
 * put — proving the depth counter tracks every enclosing Block independently
 * and the two rules compose without fighting.
 *
 * 1. Copy `fixtures/format-projects/format-nested-blocks` into a temp project.
 * 2. Run `ttsc format` through the real launcher with `@ttsc/lint` linked.
 * 3. Assert the rewritten source matches `expected/main.ts` exactly.
 */
export const test_lint_format_nested_blocks_reindent_crammed_statements =
  () => {
    const fixture = path.join(
      process.cwd(),
      "fixtures",
      "format-projects",
      "format-nested-blocks",
    );
    const expectedSource = fs.readFileSync(
      path.join(fixture, "expected", "main.ts"),
      "utf8",
    );
    const root = path.join(
      TestProject.tmpdir("ttsc-lint-format-nested-"),
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
