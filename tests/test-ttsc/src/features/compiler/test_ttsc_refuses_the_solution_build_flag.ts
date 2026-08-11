import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc refuses `--build` / `-b` in its own voice instead of forwarding
 * it.
 *
 * Every build lane hands tsgo an argument list that opens with the project ttsc
 * resolved (`-p <tsconfig>`), so a forwarded `--build` always lands after it and
 * tsgo answers TS6369 "Option '--build' must be the first command line
 * argument" — a diagnostic that contradicts the command line the user typed and
 * that no spelling of the ttsc invocation can satisfy. The launcher now names
 * the real reason (one pinned project, no solution mode) and points at the
 * per-project alternative, for every spelling and every argv position.
 *
 * 1. Materialize the two-package solution from the report: a root tsconfig with
 *    no files and two project references.
 * 2. Run the flag leading, trailing, aliased as `-b`, and under `ttsc check`.
 * 3. Assert exit 2 with ttsc's refusal on stderr, no TS6369 anywhere, and no
 *    emitted output under either referenced package.
 */
export const test_ttsc_refuses_the_solution_build_flag = () => {
  const packageConfig = JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      strict: true,
      composite: true,
      outDir: "dist",
      rootDir: "src",
    },
    include: ["src"],
  });
  const root = createProject({
    "tsconfig.json": JSON.stringify({
      files: [],
      references: [{ path: "./pkg-a" }, { path: "./pkg-b" }],
    }),
    "pkg-a/tsconfig.json": packageConfig,
    "pkg-a/src/index.ts": `export const a = 1;\n`,
    "pkg-b/tsconfig.json": packageConfig,
    "pkg-b/src/index.ts": `export const b = 2;\n`,
  });

  for (const argv of [
    ["--build", ".", "--cwd", root],
    ["--cwd", root, "--build"],
    ["-b", "--cwd", root],
    ["check", "--build", "--cwd", root],
  ]) {
    const result = spawn(ttscBin, argv, { cwd: root });
    const output = `${result.stdout}${result.stderr}`;
    assert.equal(result.status, 2, output);
    assert.match(
      result.stderr,
      /ttsc: --build \(solution mode\) is not supported/,
      `${argv.join(" ")} should be refused by ttsc itself`,
    );
    assert.match(result.stderr, /ttsc -p <tsconfig>/);
    assert.doesNotMatch(
      output,
      /TS6369|must be the first command line argument/,
      `${argv.join(" ")} must not reach tsgo`,
    );
  }

  for (const pkg of ["pkg-a", "pkg-b"]) {
    assert.equal(fs.existsSync(path.join(root, pkg, "dist")), false);
  }
};
