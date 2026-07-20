import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a lowercase `--listemittedfiles` surfaces the same listing as the
 * canonical spelling.
 *
 * Tsgo matches option names case-insensitively, so it emitted the `TSFILE:`
 * lines either way — but the launcher resolved flags by exact spelling, did not
 * recognise the variant as its own shadow flag, and stripped the listing back
 * out as internal noise. The user saw an empty stdout for a flag the compiler
 * had honoured. The case-variant twin of
 * `test_ttsc_listemittedfiles_flag_surfaces_emitted_paths`.
 *
 * 1. Create a minimal project.
 * 2. Run `ttsc --emit --listemittedfiles`.
 * 3. Assert a zero exit and a `TSFILE:` listing line in stdout.
 */
export const test_ttsc_listemittedfiles_flag_surfaces_emitted_paths_in_lowercase =
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
      "src/main.ts": `export const value: string = "listed";\n`,
    });

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--listemittedfiles"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /TSFILE:.*main\.js/);
  };
