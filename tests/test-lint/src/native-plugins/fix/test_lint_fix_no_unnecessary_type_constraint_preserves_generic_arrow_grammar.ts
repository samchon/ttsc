import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

const SOURCE_FILES = ["case.tsx", "module.mts", "commonjs.cts", "plain.ts"];

/**
 * Verifies the no-unnecessary-type-constraint fixer preserves every generic
 * arrow grammar selected by the source filename.
 *
 * The fixture deliberately has no compilerOptions.plugins entry. Its direct
 * dependency manifest plus the linked package let ttsc package discovery load
 * @ttsc/lint exactly as a consumer project does. `ttsc fix` reloads the edited
 * Program before its final compiler diagnostic pass, so status 0 proves both
 * the byte snapshots and the post-fix TypeScript parse are valid.
 *
 * 1. Copy TSX, MTS, CTS, and TS cases into a writable project.
 * 2. Run the real `ttsc fix` launcher through package auto-discovery.
 * 3. Assert the post-fix compiler succeeds and every rewritten file matches.
 */
export const test_lint_fix_no_unnecessary_type_constraint_preserves_generic_arrow_grammar =
  () => {
    const fixture = path.join(
      process.cwd(),
      "fixtures",
      "fix-projects",
      "typescript-no-unnecessary-type-constraint",
    );
    const root = path.join(
      TestProject.tmpdir("ttsc-lint-fix-type-constraint-"),
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
      assert.doesNotMatch(result.stderr ?? "", /error TS\d+:/);
      for (const file of SOURCE_FILES) {
        assert.equal(
          fs.readFileSync(path.join(root, "src", file), "utf8"),
          fs.readFileSync(path.join(fixture, "expected", file), "utf8"),
          file,
        );
      }
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
