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
 *
 * @evidence contracts/testing.md#behavioral-verification The real compiler prepares a dependency-owned CommonJS program and NativeNode loads its circular a/b graph; exact combined:AB and zero status distinguish accidental ESM cycle handling.
 * @evidence contracts/testing.md#independent-expectations Independent fixture exports A and B and CommonJS support for partially initialized cyclic modules establish the expected combined value.
 * @evidence contracts/testing.md#distinguishing-cases This owns a real dependency program with a mutual cycle; acyclic source packages and ESM resolution are covered by other host batches.
 * @evidence contracts/testing.md#execution-ownership This named filename-matching E2E entry runs the real built launcher or public register and native host. Portable option/cache decisions stay in source units; recursive main24 and the explicit Node compatibility directory both select this actual boundary.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler prepares a dependency-owned CommonJS program and NativeNode loads its circular a/b graph; exact combined:AB and zero status distinguish accidental ESM cycle handling. Direct source calls cannot prove this NativeNode loader or process connection.
 * @evidence contracts/e2e.md#shared-execution One root program and one dependency-owned program are consumed by one host; the dependency compiler options differ from consumer ownership and cannot be substituted with root emit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The immutable cyclic package version and local tsconfig identify the dependency preparation; no source mutation or cold-cache assertion is claimed, and synchronous spawn closes the host.
 * @evidence contracts/e2e.md#preserved-coverage All original meaningful status, output and state assertions remain in this named entry; physical directory selection removes only repeated unrelated portable cases from floor/current execution, while main24 retains the entire runtime population.
 */
export function test_ttsx_runs_a_dependency_with_a_circular_module_graph() {
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
}
