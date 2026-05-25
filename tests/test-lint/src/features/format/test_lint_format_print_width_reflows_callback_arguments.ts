import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Verifies lint format print-width: reflows callback and object arguments.
 *
 * The fixture pins the headline corruption fix end-to-end. A `new Singleton`
 * call holds a mis-indented arrow callback, a `configure` call holds a
 * multi-line object with a nested object, a `run` call holds a nested callback
 * (`run(() => defer(() => …))`), and a final `run` call holds a callback whose
 * body has a multi-line `if` the dispatcher cannot reflow. After `ttsc format`
 * the first three must reflow with each callback hugging the parens and
 * consistent indentation at every depth, while the last must abstain and stay
 * byte-identical — `formatPrintWidth` either reflows correctly or leaves the
 * node untouched, never emitting the half-reflowed shape.
 *
 * 1. Copy `fixtures/format-projects/format-print-width` into a temp project.
 * 2. Run `ttsc format` through the real launcher with `@ttsc/lint` linked.
 * 3. Assert the rewritten source matches `expected/main.ts` exactly.
 */
export const test_lint_format_print_width_reflows_callback_arguments = () => {
  const fixture = path.join(
    process.cwd(),
    "fixtures",
    "format-projects",
    "format-print-width",
  );
  const expectedSource = fs.readFileSync(
    path.join(fixture, "expected", "main.ts"),
    "utf8",
  );
  const root = path.join(TestProject.tmpdir("ttsc-lint-format-pw-"), "project");

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
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-lint-format-pw-cache-"),
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
