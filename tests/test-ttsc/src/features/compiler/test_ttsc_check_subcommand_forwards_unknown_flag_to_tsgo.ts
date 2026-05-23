import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc check` forwards an unrecognized flag to tsgo (RC-1).
 *
 * `ttsc check --strict` must travel `--strict` through to tsgo just like
 * `ttsc --strict` does on the bare lane. Before the flag-schema cutover the
 * `check` subcommand routed through a parallel parser branch that could
 * silently drop a flag the bare-lane parser accepted; the new schema declares
 * every flag's `consumedBy` set once and the subcommand branch reuses the
 * same engine, so a flag with `forwardTo: "tsgo"` reaches tsgo regardless of
 * which subcommand the user typed. The fixture's tsconfig sets `strict:
 * false`, so the strict-null diagnostic can only surface if `--strict`
 * actually reached tsgo.
 *
 * 1. Create a project whose tsconfig disables strict mode, with a source
 *    file that dereferences a possibly-null value.
 * 2. Run `ttsc check --strict src/main.ts`.
 * 3. Assert non-zero exit and the strict-null diagnostic in the output.
 */
export const test_ttsc_check_subcommand_forwards_unknown_flag_to_tsgo = () => {
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
    "src/main.ts": `export const len = (x: string | null): number => x.length;\n`,
  });

  const result = spawn(
    ttscBin,
    ["check", "--cwd", root, "--strict", "src/main.ts"],
    { cwd: root },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stdout}${result.stderr}`,
    /is possibly .?null/i,
  );
};
