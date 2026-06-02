import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `ttsx` fails when a raw-`.ts` dependency has a type error of its
 * own.
 *
 * Because each dependency is compiled by the real, type-checking compiler — not
 * just type-stripped — a dependency's own type error is caught and surfaces as
 * a non-zero exit, rather than the broken code running. This pins the "real
 * type-checking, not a strip" guarantee: a regression to a check-free transform
 * would let `bad-dep` run.
 *
 * 1. Install a `bad-dep` whose source assigns a string to a `number`.
 * 2. Run `ttsx` against an entry importing it.
 * 3. Assert a non-zero exit (the build failed) and that nothing was printed.
 */
export const test_ttsx_surfaces_a_type_error_inside_a_raw_ts_dependency =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/bad-dep/package.json": JSON.stringify({
        name: "bad-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/bad-dep/index.ts": `export const wrong: number = "not a number";\nexport const run = (): string => "ran";\n`,
      "src/main.ts": `import { run } from "bad-dep";\nconsole.log(run());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.notEqual(
      result.status,
      0,
      "ttsx must fail on the dependency's type error",
    );
    assert.equal(result.stdout.trim(), "");
  };
