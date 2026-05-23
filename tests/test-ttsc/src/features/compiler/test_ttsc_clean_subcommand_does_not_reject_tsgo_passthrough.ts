import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc clean` accepts tsgo passthrough flags (RC-3 + RC-4).
 *
 * Before the flag-schema cutover, project subcommands ran through a
 * completely separate parser branch from the build-lane parser: it
 * rejected every unknown flag with `throw new Error("unknown option")`,
 * so a user habituated to
 * `ttsc --strict` would hit a hard exit on `ttsc clean --strict
 * tsconfig.json`. The new schema routes every subcommand through one
 * engine, and `clean` declares `--strict` as forwardable like every other
 * subcommand. Even though `clean` does not actually use `--strict`, it
 * must not reject it as an unknown option — the consistency across
 * subcommands is the point.
 *
 * 1. Create a minimal project with a tsconfig.
 * 2. Run `ttsc clean --strict --tsconfig &lt;path&gt;`.
 * 3. Assert zero exit and no "unknown option" error in the output.
 */
export const test_ttsc_clean_subcommand_does_not_reject_tsgo_passthrough =
  () => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: false,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": `export const x = 1;\n`,
    });

    const result = spawn(
      ttscBin,
      ["clean", "--cwd", root, "--strict", "--tsconfig", "tsconfig.json"],
      { cwd: root },
    );

    assert.equal(
      result.status,
      0,
      `stderr=${result.stderr}\nstdout=${result.stdout}`,
    );
    assert.doesNotMatch(
      `${result.stdout}${result.stderr}`,
      /unknown (option|command)/i,
    );
  };
