import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a lowercase `--showconfig` prints the project's own resolved config.
 *
 * `--showConfig` is declared terminal, so ttsc must not wrap it in a build. A
 * case variant was not recognised as terminal, so the launcher added its
 * compile-only guard anyway and `noEmitOnError` appeared in the printed
 * configuration — the tool reported a setting the project never declared. The
 * case-variant twin of `test_ttsc_showconfig_flag_runs_tsgo_once`.
 *
 * 1. Create a minimal project that declares no `noEmitOnError`.
 * 2. Run `ttsc --showconfig`.
 * 3. Assert a zero exit, exactly one config block, and no injected `noEmitOnError`
 *    in the printed configuration.
 */
export const test_ttsc_showconfig_flag_in_lowercase_omits_the_compile_only_guard =
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
      "src/main.ts": `export const value: string = "config";\n`,
    });

    const result = spawn(ttscBin, ["--cwd", root, "--showconfig"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);
    const blocks = result.stdout.split('"compilerOptions"').length - 1;
    assert.equal(blocks, 1, `expected one config block, got ${blocks}`);
    assert.equal(
      /noEmitOnError/.test(result.stdout),
      false,
      `the printed config must not carry ttsc's compile-only guard:\n${result.stdout}`,
    );
  };
