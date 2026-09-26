import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc --checkers` accepts exactly the integer spellings tsgo does.
 *
 * Tsgo reads a number option with Go's `strconv.Atoi`: an optional sign and
 * decimal digits. The launcher validated with JavaScript's `Number`, so `1e3`
 * became 1000 checker workers, `0x10` became 16, and `2.0` became 2, although
 * tsgo rejects all three. Signed and zero-padded decimals stay accepted.
 *
 * 1. Create a project with a valid TypeScript source file.
 * 2. Run `ttsc --checkers` with scientific, hexadecimal, and fractional values,
 *    then with `+2` and `02`.
 * 3. Assert the first three fail with the positive-integer message and the last
 *    two build.
 */
export const test_ttsc_checkers_flag_accepts_only_tsgo_integer_spellings =
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
      "src/main.ts": `export const answer: number = 42;\n`,
    });

    for (const value of ["1e3", "0x10", "2.0"]) {
      const result = spawn(ttscBin, ["--cwd", root, "--checkers", value], {
        cwd: root,
      });
      assert.notEqual(result.status, 0, `--checkers ${value} must fail`);
      assert.match(result.stderr, /--checkers expects a positive integer/);
    }
    for (const value of ["+2", "02"]) {
      const result = spawn(ttscBin, ["--cwd", root, "--checkers", value], {
        cwd: root,
      });
      assert.equal(result.status, 0, `--checkers ${value}: ${result.stderr}`);
    }
  };
