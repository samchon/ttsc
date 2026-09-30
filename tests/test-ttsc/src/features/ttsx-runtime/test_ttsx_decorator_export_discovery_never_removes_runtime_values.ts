import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorator export-name hints never remove real CommonJS values.
 *
 * Static discovery can be incomplete for computed JavaScript exports. It may
 * advertise known names to Node, but it cannot replace the runtime star helper
 * with a smaller list and delete values the helper would have exported.
 *
 * 1. Re-export a known name and a computed CommonJS property from an owned barrel.
 * 2. Load that barrel through a decorated orphan and an ESM consumer.
 * 3. Assert the known named export and the computed default-object value survive.
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx loads a decorated CommonJS orphan into ESM, requiring its complete decorator log and both actual 17 and computed dynamic 42 values. This detects name hints incorrectly shrinking the runtime export object.
 * @evidence contracts/testing.md#independent-expectations The authored sources assign literal 17 and computed property dynamic to 42; STANDARD_DECORATOR_OUTPUT is specified by the fixture decorators independently of export discovery.
 * @evidence contracts/testing.md#distinguishing-cases Known named export and statically undiscoverable computed default-object export coexist through a project-owned export-star barrel. Owning-project enum policy belongs to the companion reexports test.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns one real launcher and Node import; package sources and computed exports are fixture inputs.
 * @evidence contracts/e2e.md#necessary-boundary Node CommonJS named-export advertisement and the live default object must agree with actual runtime execution. Direct export-name computation cannot prove that advertisement leaves dynamic values intact.
 * @evidence contracts/e2e.md#shared-execution One root, one decorated orphan and one owning dependency project share one actual Node session; both value observations consume the same module execution.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The immutable packages have separate orphan and project identities. Synchronous host completion precedes TestProject cleanup; the live module object remains within this host.
 * @evidence contracts/e2e.md#preserved-coverage The original zero status, complete decoration log, named 17 and dynamic 42 assertions remain in this executable owner. No dynamic-property distinction was transferred to a parser-only unit.
 */
export function test_ttsx_decorator_export_discovery_never_removes_runtime_values() {
    const root = TestProject.createProject({
      "package.json": '{"type":"module"}',
      "tsconfig.json": TestProject.tsconfig({
        target: "ES2022",
        module: "esnext",
        rootDir: "src",
        outDir: "dist",
      }),
      "src/main.ts":
        'const name: string = "dep"; const dep = await import(name); console.log(dep.actual, dep.default.dynamic); export {};',
      "node_modules/dep/package.json":
        '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
      "node_modules/dep/index.ts":
        STANDARD_DECORATOR_SOURCE + '\nexport * from "./values/entry";',
      "node_modules/dep/values/tsconfig.json": TestProject.tsconfig(
        { target: "ES2022", module: "commonjs", rootDir: ".", outDir: "lib" },
        { include: ["entry.ts"] },
      ),
      "node_modules/dep/values/entry.ts":
        'export const actual = 17; export * from "./dynamic.cjs";',
      "node_modules/dep/values/dynamic.cjs":
        'module.exports["dyn" + "amic"] = 42;',
    });
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT + "\n17 42");
  }
