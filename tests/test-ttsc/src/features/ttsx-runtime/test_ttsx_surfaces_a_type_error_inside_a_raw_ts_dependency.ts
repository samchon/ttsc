import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `ttsx` fails when a raw-`.ts` dependency has a type error of its
 * own.
 *
 * `ttsx` type-checks the raw TypeScript it serves rather than stripping it: the
 * entry's compile gate compiles the consuming program — the imported
 * dependency's source included — so the dependency's own type error is caught
 * and surfaces as a non-zero exit with the diagnostic, rather than the broken
 * code running. A regression to a check-free transform would let `bad-dep`
 * run.
 *
 * 1. Install a `bad-dep` whose source assigns a string to a `number`.
 * 2. Run `ttsx` against an entry importing it.
 * 3. Assert a non-zero exit, nothing printed, and the type diagnostic.
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
    // Pin that the failure is the dependency's own type error, not an unrelated
    // abort: a strip-only path would never diagnose the bad assignment.
    assert.match(result.stderr, /not assignable to type 'number'/);
  };
