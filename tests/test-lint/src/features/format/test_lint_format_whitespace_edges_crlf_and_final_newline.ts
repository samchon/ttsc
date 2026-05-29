import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies lint format whitespace edges: CRLF, leading/trailing blanks, and a
 * missing final newline normalize alongside statement layout.
 *
 * The fixture is a CRLF file that opens with a blank line, holds a three-blank
 * run, trails whitespace on several lines, crams two statements inside a
 * function body, and ends with no final newline. After `ttsc format` the line
 * endings collapse to LF (the default endOfLine), blank runs collapse to one,
 * leading/trailing blanks are stripped, the crammed body splits and reindents
 * to depth one, and the file gains exactly one final newline.
 *
 * 1. Copy `fixtures/format-projects/format-whitespace-edges` into a temp project.
 * 2. Run `ttsc format` through the real launcher with `@ttsc/lint` linked.
 * 3. Assert the rewritten source matches `expected/main.ts` exactly.
 */
export const test_lint_format_whitespace_edges_crlf_and_final_newline = () => {
  const fixture = path.join(
    process.cwd(),
    "fixtures",
    "format-projects",
    "format-whitespace-edges",
  );
  const expectedSource = fs.readFileSync(
    path.join(fixture, "expected", "main.ts"),
    "utf8",
  );
  const root = path.join(
    TestProject.tmpdir("ttsc-lint-format-wsedge-"),
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
