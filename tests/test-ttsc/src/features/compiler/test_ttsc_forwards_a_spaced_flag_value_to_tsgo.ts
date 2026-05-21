import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc forwards a space-separated flag value to tsgo as one unit.
 *
 * A forwarded tsgo flag may take a value (`--target es2020`). ttsc must not
 * mistake the bare `es2020` token for a single-file input — it carries no
 * TypeScript source extension, so it belongs with the forwarded flag. If it
 * were misrouted into `files`, ttsc would drop into single-file mode and fail
 * looking for an `es2020` entry instead of running the project build.
 *
 * 1. Create a minimal project.
 * 2. Run `ttsc --emit --target es2020` and assert a zero exit.
 * 3. Assert the project's JavaScript output was written — i.e. a project build
 *    ran, not a misfired single-file emit.
 */
export const test_ttsc_forwards_a_spaced_flag_value_to_tsgo = () => {
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export const value: string = "spaced";\n`,
  });

  const result = spawn(
    ttscBin,
    ["--cwd", root, "--emit", "--target", "es2020"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(root, "dist", "main.js")));
};
