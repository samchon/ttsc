import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies lint format: native project fixture rewrites only the temp copy.
 *
 * Locks the observable `ttsc format` behavior against a checked-in project
 * fixture. The source fixture must stay immutable; the command runs against a
 * writable copy so the test can inspect real file changes without damaging the
 * repository baseline. Mirrors the `fix` end-to-end test so any future
 * divergence between the two subcommand contracts is immediately visible.
 *
 * 1. Copy the fixture and omit its statement-ending semicolons in the writable input.
 * 2. Run `ttsc format` through the real launcher with `@ttsc/lint` linked.
 * 3. Assert the temp source matches `expected/main.ts` and the fixture source is
 *    unchanged.
 *
 * @evidence contracts/testing.md#behavioral-verification The real ttsc format command must add the intentionally omitted statement-ending semicolons and reproduce the authored expected file without a format diagnostic banner or failure exit; the original repository fixture must remain unchanged.
 * @evidence contracts/testing.md#independent-expectations The fixture format config explicitly requires semi:true. Its manually authored expected source pins unchanged identifiers, strings, template expression and statement ordering as well as the required semicolons.
 * @evidence contracts/testing.md#distinguishing-cases The prepared writable source differs from the expected semicolon-bearing output, so no-op formatting fails. Existing semicolon spelling in the immutable fixture is preserved; full formatter-option and parser distinctions belong to Go formatter units.
 * @evidence contracts/testing.md#execution-ownership This named native E2E entry crosses the built launcher, native format engine and actual file publication. Go option semantics execute in the shared unit process rather than extra format consumers.
 * @evidence contracts/e2e.md#necessary-boundary Native command discovery and write-only publication must connect the formatter result to the requested project without emitting a lint banner. Direct formatter calls cannot detect wrong CLI target selection or a discarded write.
 * @evidence contracts/e2e.md#shared-execution The source preparation and workspace lint link share the existing content-keyed builtin native producer; one format command remains because its write-only exit/output contract differs from check and fix commands.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only a disposable fixture copy loses semicolons. The identical workspace lint sources and SDK inputs permit the existing shared plugin cache; the copy is removed in finally while the checked-in source remains untouched.
 * @evidence contracts/e2e.md#preserved-coverage All original expected-byte, exit-zero, no-format-banner and immutable-fixture assertions remain. The new differing input strengthens the old idempotency-only scenario into an observable formatting change.
 */
export function test_lint_format_native_project_rewrites_temp_copy_only() {
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
    const unformattedSource = originalSource.replace(/;(?=\r?\n|$)/g, "");
    assert.notEqual(unformattedSource, expectedSource, "the formatter must change its input");
    fs.writeFileSync(path.join(root, "src", "main.ts"), unformattedSource);
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
    // Format is write-only: no diagnostics, no `[format/semi]` banner.
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
