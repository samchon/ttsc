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
 * Invalid numeric decisions are owned by the authored flag-parser unit; this
 * boundary retains the actual compiler invocation for both accepted spellings.
 *
 * 1. Create a project with a valid TypeScript source file.
 * 2. Run `ttsc --checkers` with `+2` and `02`.
 * 3. Assert both compile successfully through the real launcher.
 *
 * @evidence contracts/testing.md#behavioral-verification Invokes the shipped CLI with signed and zero-padded checker counts and requires successful compilation, preserving both original accepted-input checks.
 * @evidence contracts/testing.md#independent-expectations Literal accepted arguments +2 and 02 and expected exit zero define the oracle; the exact rejected values and messages live in the authored parseFlags unit.
 * @evidence contracts/testing.md#distinguishing-cases Owns both accepted lexical spellings at the compiler boundary; the separate source unit owns zero, scientific, hexadecimal, fractional, negative, empty and missing operands.
 * @evidence contracts/testing.md#execution-ownership This named export is selected once by the compiler boundary runner; its two invocations share one consumer project and do not build a contributor.
 * @evidence contracts/e2e.md#necessary-boundary A parser unit cannot prove the parsed checker value reaches a real TypeScript-Go invocation, so both originally accepted spellings retain actual compilation.
 * @evidence contracts/e2e.md#shared-execution One minimal consumer project serves both accepted spellings; invalid input decisions no longer launch independent product processes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both invocations compile the same immutable valid source and use no plugin or mutable configuration; output reuse cannot change the required successful CLI exit.
 * @evidence contracts/e2e.md#preserved-coverage Keeps both original successful compiler invocations; the exact four rejected inputs now call production parseFlags in the portable unit and generic CLI error forwarding remains in other surviving compiler failures.
 */
export function test_ttsc_checkers_flag_accepts_only_tsgo_integer_spellings(): void {
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

    for (const value of ["+2", "02"]) {
      const result = spawn(ttscBin, ["--cwd", root, "--checkers", value], {
        cwd: root,
      });
      assert.equal(result.status, 0, `--checkers ${value}: ${result.stderr}`);
    }
}
