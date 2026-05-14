import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc rejects --fix combined with --emit.
 *
 * Fix mode keeps JavaScript and declaration emit disabled — combining it with
 * --emit silently let the last flag win before this guard. The launcher now
 * fails fast with a clear message so a misconfigured wrapper script does not
 * accidentally write build artifacts during an autofix pass.
 *
 * 1. Materialize a tsconfig project with one source file.
 * 2. Run `ttsc --fix --emit` through the real launcher.
 * 3. Assert non-zero exit and the mutual-exclusion message on stderr.
 */
export const test_ttsc_rejects_fix_with_emit_flag = () => {
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

  const result = spawn(ttscBin, ["--fix", "--emit", "--cwd", root], {
    cwd: root,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--fix and --emit are mutually exclusive/);
};
