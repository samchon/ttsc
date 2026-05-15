import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc rejects `fix` when a positional file is passed.
 *
 * Fix mode needs the full tsconfig program so check-stage plugins can reload
 * the Program between passes. Single-file mode bypasses tsconfig discovery, so
 * the launcher refuses to mix them before spawning any plugin.
 *
 * 1. Materialize a tsconfig project with one source file.
 * 2. Run `ttsc fix src/main.ts` through the real launcher.
 * 3. Assert non-zero exit and the documented refusal message on stderr.
 */
export const test_ttsc_rejects_fix_in_single_file_mode = () => {
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

  const result = spawn(ttscBin, ["fix", "src/main.ts", "--cwd", root], {
    cwd: root,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fix requires a project/);
};
