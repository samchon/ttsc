import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc forwards an unrecognized flag to the underlying tsgo binary.
 *
 * Ttsc owns a fixed set of CLI flags and deliberately does not re-implement
 * tsgo's option table; every other flag must reach tsgo so `ttsc --strict
 * file.ts` behaves like `tsgo --strict file.ts`. The fixture's tsconfig sets
 * `strict: false`, so a strict-null diagnostic can only appear if `--strict`
 * actually travelled through to tsgo and overrode the project setting.
 *
 * 1. Create a project whose tsconfig disables strict mode, with a source file that
 *    dereferences a possibly-null value.
 * 2. Run `ttsc --strict <file>`.
 * 3. Assert a non-zero exit and the strict-null diagnostic in the output.
 */
export const test_ttsc_forwards_an_unknown_flag_to_tsgo = () => {
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

  const result = spawn(ttscBin, ["--cwd", root, "--strict", "src/main.ts"], {
    cwd: root,
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /is possibly .?null/i);
};
