import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx runs a raw `.ts` dependency whose modules reference each other
 * in a cycle.
 *
 * A package that ships source can have a circular module graph (mutually
 * re-exporting barrels, recursive structures). CommonJS tolerates such cycles;
 * an ES module required from CommonJS does not (`ERR_REQUIRE_CYCLE_MODULE`).
 * Because the dependency owns a `tsconfig.json`, ttsx must serve its built
 * CommonJS emit — not a type-stripped (still ESM-shaped) source — so the cycle
 * loads the way the package's own build intends.
 *
 * 1. Install a `cyclic` dependency (its own tsconfig, `module: commonjs`) whose
 *    `a` and `b` modules import each other.
 * 2. Run ttsx against an entry that imports a value assembled across the cycle.
 * 3. Assert it loaded without a cycle error and produced the combined value.
 */
export const test_ttsx_runs_a_dependency_with_a_circular_module_graph = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        esModuleInterop: true,
      },
      include: ["src"],
    }),
    "node_modules/cyclic/package.json": JSON.stringify({
      name: "cyclic",
      version: "1.0.0",
      main: "src/index.ts",
      types: "src/index.ts",
    }),
    "node_modules/cyclic/tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "lib",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "node_modules/cyclic/src/index.ts": [
      `export * from "./a";`,
      `export * from "./b";`,
      ``,
    ].join("\n"),
    "node_modules/cyclic/src/a.ts": [
      `import { labelB } from "./b";`,
      `export const labelA = "A";`,
      `export const combine = (): string => labelA + labelB;`,
      ``,
    ].join("\n"),
    "node_modules/cyclic/src/b.ts": [
      `import "./a";`,
      `export const labelB = "B";`,
      ``,
    ].join("\n"),
    "src/main.ts": [
      `import { combine } from "cyclic";`,
      `console.log("combined:" + combine());`,
      ``,
    ].join("\n"),
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "combined:AB");
};
