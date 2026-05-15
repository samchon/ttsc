import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc rejects --fix combined with --format.
 *
 * Fix and format split the rule registry by category: --fix applies lint-rule
 * edits and --format applies FormatRule edits. Running both in one pass would
 * be useful, but the current contract is "two passes, two flags" so users can
 * inspect each phase's effect on the working tree before continuing. The
 * guard documents the constraint explicitly so future relaxations are
 * deliberate.
 *
 * 1. Materialize a tsconfig project with one source file.
 * 2. Run `ttsc --fix --format` through the real launcher.
 * 3. Assert non-zero exit and the documented refusal message on stderr.
 */
export const test_ttsc_rejects_fix_combined_with_format_flag = () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        noEmit: true,
      },
      include: ["src"],
    }),
    "src/main.ts": `export const value = 1;\n`,
  });

  const result = spawn(ttscBin, ["--fix", "--format", "--cwd", root], {
    cwd: root,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--fix and --format are mutually exclusive/);
};
