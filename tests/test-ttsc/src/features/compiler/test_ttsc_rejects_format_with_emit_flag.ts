import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc rejects --format combined with --emit.
 *
 * Format mode keeps JavaScript and declaration emit disabled by contract.
 * Without a guard, --emit would silently override the implicit `emit = false`
 * the launcher applies when --format is parsed. This scenario pins the
 * mutual-exclusion message so a misconfigured wrapper script cannot
 * accidentally write build artifacts during a formatter pass.
 *
 * 1. Materialize a tsconfig project with one source file.
 * 2. Run `ttsc --format --emit` through the real launcher.
 * 3. Assert non-zero exit and the mutual-exclusion message on stderr.
 */
export const test_ttsc_rejects_format_with_emit_flag = () => {
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

  const result = spawn(ttscBin, ["--format", "--emit", "--cwd", root], {
    cwd: root,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--format and --emit are mutually exclusive/);
};
