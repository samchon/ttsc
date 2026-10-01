import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/lint/internal/plugin-cache";

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
 *
 * @evidence contracts/testing.md#behavioral-verification The real auto-discovered lint fix command removes unnecessary generic constraints and must leave every TSX, MTS, CTS and TS output byte-correct and accepted by the post-fix compiler pass.
 * @evidence contracts/testing.md#independent-expectations TypeScript generic-arrow syntax requires TSX disambiguating commas while ordinary TS/MTS/CTS have their own accepted grammar; authored expected files independently preserve comments, defaults and the intended generic meaning.
 * @evidence contracts/testing.md#distinguishing-cases Unknown/any constraints, single and multiple parameters, existing commas, defaults, comments, interfaces, aliases, methods and functions retain the original fixture distinctions; no compiler error is permitted after rewriting.
 * @evidence contracts/testing.md#execution-ownership This named native E2E entry uses one project and one fix command for all four source grammars. Go fixer decisions execute as units; this boundary additionally reloads the emitted edits through the real compiler.
 * @evidence contracts/e2e.md#necessary-boundary A fix can compute the intended generic edit yet publish grammar the compiler cannot parse. The real fix-to-reload connection and package-marker activation are necessary boundaries.
 * @evidence contracts/e2e.md#shared-execution All four grammar files already share one fixture, native producer and fix invocation. The canonical builtin lint identity reuses the existing shared cache without per-file builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The source files are writable only in a disposable copied project; exact expected snapshots are immutable inputs. No plugin bytes mutate, no warm hit substitutes for a cold-state assertion, and the copied root is removed in finally.
 * @evidence contracts/e2e.md#preserved-coverage Original exact bytes for every source suffix, zero exit and absence of TypeScript error banners remain. Removing this reload boundary would lose verification of published generic-arrow grammar, so it remains batched across four files.
 */
export function test_lint_fix_no_unnecessary_type_constraint_preserves_generic_arrow_grammar() {
    const fixture = path.join(
      process.cwd(),
      "fixtures",
    "lint",
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
