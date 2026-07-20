import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a lowercase `--outdir` overrides the project's `outDir` the same way
 * `--outDir` does.
 *
 * Tsgo honoured the case variant, but the launcher did not consume it, so
 * ttsc's own emitted-path resolution kept using the project value while tsgo
 * wrote somewhere else. The two layers disagreed about where the build landed.
 *
 * 1. Create a project whose tsconfig sets `outDir` to `dist`.
 * 2. Run `ttsc --emit --outdir out`.
 * 3. Assert the emit landed under `out` and not under `dist`.
 */
export const test_ttsc_outdir_flag_in_lowercase_overrides_the_project_out_dir =
  () => {
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
      "src/main.ts": `export const value: string = "outdir";\n`,
    });

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--outdir", "out"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.existsSync(path.join(root, "out", "main.js")),
      true,
      `expected the emit under out/:\n${result.stdout}${result.stderr}`,
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  };
