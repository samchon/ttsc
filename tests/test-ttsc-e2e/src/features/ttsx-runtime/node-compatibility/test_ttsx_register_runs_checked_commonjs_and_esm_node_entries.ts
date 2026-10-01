import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TTSX_REGISTER, linkTtscPackage } from "../../../internal/ttsx-register";

/**
 * Verifies ttsx register runs checked CommonJS and ESM Node entries.
 *
 * The public preload has to own Node's main-module boundary in both module
 * systems. The enum in each source also proves the compiler's emitted
 * JavaScript ran instead of Node's erasable-syntax TypeScript stripping.
 *
 * 1. Create equivalent CommonJS and ESM consumer projects.
 * 2. Run each with `node --require ttsc/register` and its `.ts` main file.
 * 3. Assert both checked emits execute and print their module-specific result.
 *
 * @evidence contracts/testing.md#behavioral-verification Public register runs actual checked CJS/ESM entries and native builtins; enums establish compiler emit, exact builtin results establish successful Node resolution.
 * @evidence contracts/testing.md#independent-expectations Authored enum values, non-null native builtin objects, UUID length 36 and a successfully closed SQLite database independently define the expected program outcomes.
 * @evidence contracts/testing.md#distinguishing-cases CJS loads all four prefix-only builtin families and ordinary crypto; ESM imports SQLite while both enum entries execute. The separate custom-remap boundary and normalization unit retain the negative adjacent cases.
 * @evidence contracts/testing.md#execution-ownership This named E2E test owns both actual Node main-module hosts; fixture code is consumer input and the loop asserts each host's emitted result.
 * @evidence contracts/e2e.md#necessary-boundary Node's actual public synchronous hook API and builtin/main-module handling differ across supported versions; direct normalization calls cannot prove this connection.
 * @evidence contracts/e2e.md#shared-execution Existing CJS and ESM main-entry hosts now also own the three builtin regressions, avoiding their separate projects, compiler preparation and launcher processes. Distinct main-module formats require two lifetimes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each format has a fresh project and Node process with independently scoped loader state; native database close is explicit and each synchronous spawn completes before fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The original two enum results and prefix-only CJS, ordinary crypto and ESM SQLite assertions survive as exact labeled result properties; custom hook remaps remain in their dedicated boundary.
 */
export function test_ttsx_register_runs_checked_commonjs_and_esm_node_entries() {
    const failures: unknown[] = [];
    for (const fixture of [
      { module: "commonjs", name: "commonjs", packageType: "commonjs" },
      { module: "nodenext", name: "esm", packageType: "module" },
    ]) {
      try {
      const root = TestProject.createProject({
        "package.json": JSON.stringify({
          name: `ttsx-register-${fixture.name}`,
          type: fixture.packageType,
          version: "1.0.0",
        }),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            module: fixture.module,
            outDir: "dist",
            rootDir: "src",
            strict: true,
            target: "ES2022",
          },
          include: ["src"],
        }),
        "src/node-sqlite.d.ts": fixture.name === "esm" ? `declare module "node:sqlite" { export class DatabaseSync { constructor(location: string); close(): void; } }` : "",
        "src/main.ts": [
          `enum RuntimeKind { Value = ${JSON.stringify(fixture.name)} }`,
          `const value: string = RuntimeKind.Value;`,
          ...(fixture.name === "commonjs" ? [
            `declare function require(specifier: string): any;`,
            `const prefix = ["node:sqlite", "node:test", "node:test/reporters", "node:sea"].map((specifier) => require(specifier));`,
            `console.log(JSON.stringify({ kind: value, prefix: prefix.every((item) => item !== null && item !== undefined), cryptoLength: require("node:crypto").randomUUID().length }));`,
          ] : [
            `import { DatabaseSync } from "node:sqlite";`,
            `const database = new DatabaseSync(":memory:"); database.close();`,
            `console.log(JSON.stringify({ kind: value, sqlite: "esm-sqlite-ok" }));`,
          ]),
          "",
        ].join("\n"),
      });
      linkTtscPackage(root);

      const result = TestProject.spawn(
        process.execPath,
        ["--require", TTSX_REGISTER, "src/main.ts"],
        { cwd: root },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), fixture.name === "commonjs"
        ? { kind: "commonjs", prefix: true, cryptoLength: 36 }
        : { kind: "esm", sqlite: "esm-sqlite-ok" });
      } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, "Node main-module runtime batch failed");
}