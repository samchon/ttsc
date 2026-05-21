import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx forwards an unrecognized flag to the tsgo type-check.
 *
 * Ttsx type-checks the project before running the entry. Like the `ttsc`
 * launcher, it owns a fixed set of flags and forwards every other flag (before
 * the entry) to tsgo rather than rejecting it — so `ttsx --strict src/main.ts`
 * behaves like the equivalent tsgo invocation. The fixture's tsconfig sets
 * `strict: false`, so a strict-null diagnostic can only appear if `--strict`
 * actually reached the type-check.
 *
 * 1. Create a project whose tsconfig disables strict mode, with a source file that
 *    dereferences a possibly-null value.
 * 2. Run `ttsx --strict src/main.ts`.
 * 3. Assert a non-zero exit and the strict-null diagnostic in stderr.
 */
export const test_ttsx_forwards_an_unknown_flag_to_tsgo = () => {
  const root = TestProject.commonJsProject(
    {
      "src/main.ts": `export const len = (x: string | null): number => x.length;\n`,
    },
    { compilerOptions: { strict: false } },
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "--strict", "src/main.ts"],
    { cwd: root },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /is possibly .?null/i);
};
