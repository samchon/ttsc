import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { THROWER_THROW_COLUMN, THROWER_THROW_LINE, physicalRealpath, tallCommentThrowerSource } from "../../internal/ttsx-source-map";

/**
 * Native error stacks consume entry and dependency maps without user Node flags.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx compiler/Node hosts execute both tall-comment throwers, report their caught native Error stacks and rethrow an actual captured error to fail each run; exact original function/source/line/column frames are asserted.
 * @evidence contracts/testing.md#independent-expectations Fixture-defined THROWER_THROW_LINE/COLUMN and actual physical TS paths identify the authored throw, independently of emitted JS positions. Both authored calls must throw, and an actual rethrow requires a nonzero process exit.
 * @evidence contracts/testing.md#distinguishing-cases Root sourceMap enabled and disabled retain separate transient entry preparations; a dependency-owned mapped emit contributes its independent served lane in both. Named root and dependency stack records prevent one lane from satisfying the other's assertion.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry executes the public compiler-backed runtime twice, with no user enable-source-maps flag; direct inlining source units and the V8 coverage batch own their complementary pure and coverage-consumer distinctions.
 * @evidence contracts/e2e.md#necessary-boundary Node's actual Error.stack consumer must read the served maps and enabled runtime bootstrap; a map's JSON contents or a direct converter call cannot establish native stack remapping.
 * @evidence contracts/e2e.md#shared-execution Each root configuration shares one project build, launcher and Node session between root and dependency throwers. A second root preparation is required for the changed sourceMap option; unchanged dependency inputs reuse their publication instead of an independent third host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh dependency is built cold in the first session and reused unchanged in the second; only root sourceMap changes. Each throw is caught independently so its native stack is recorded before the final actual-error rethrow, and synchronous child completion ends its handles before fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All three former cases retain nonzero exit plus original boom/depBoom physical-source line/column stderr assertions. The batch strengthens them with independent did-throw flags for both lanes and rechecks the dependency under both root configurations; all frame failures are collected.
 */
export function test_ttsx_stack_maps_preserve_entry_and_dependency_positions_in_shared_hosts(): void {
  const options = { target: "ES2022", module: "commonjs", strict: true, sourceMap: true, outDir: "lib", rootDir: "src" };
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({ compilerOptions: options, include: ["src"] }),
    "src/boom.ts": tallCommentThrowerSource("boom", "entry boom"),
    "node_modules/built-dep/package.json": JSON.stringify({ name: "built-dep", version: "1.0.0", exports: { ".": "./src/index.ts" } }),
    "node_modules/built-dep/tsconfig.json": JSON.stringify({ compilerOptions: options, include: ["src"] }),
    "node_modules/built-dep/src/index.ts": tallCommentThrowerSource("depBoom", "dependency boom"),
    "src/main.ts": [
      'import { boom } from "./boom";', 'import { depBoom } from "built-dep";',
      "const records: { name: string; threw: boolean; stack?: string }[] = [];",
      "let last: unknown;",
      'for (const [name, fn] of [["boom", boom], ["depBoom", depBoom]] as const) {',
      "  try { fn(); records.push({ name, threw: false }); }",
      "  catch (error) { last = error; console.error((error as Error).stack); records.push({ name, threw: true, stack: (error as Error).stack }); }",
      "}", "console.log(JSON.stringify(records));", "if (last !== undefined) throw last;", "",
    ].join("\n"),
  });
  const failures: Error[] = [];
  for (const sourceMap of [true, false]) {
    fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { ...options, sourceMap }, include: ["src"] }));
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
    try {
      assert.notEqual(result.status, 0, "the actual rethrown error must fail the run");
      const records = JSON.parse(result.stdout.trim()) as { name: string; threw: boolean; stack?: string }[];
      assert.deepEqual(records.map(({ name, threw }) => ({ name, threw })), [{ name: "boom", threw: true }, { name: "depBoom", threw: true }]);
      for (const [name, relative] of [["boom", "src/boom.ts"], ["depBoom", "node_modules/built-dep/src/index.ts"]]) {
        try {
          const frame = `${name} (${physicalRealpath(path.join(root, relative!))}:${THROWER_THROW_LINE}:${THROWER_THROW_COLUMN})`;
          const stack = records.find((record) => record.name === name)?.stack ?? "";
          assert.ok(fold(stack).includes(fold(frame)), `stack must contain ${frame}\n${stack}`);
          assert.ok(fold(result.stderr).includes(fold(frame)), `stderr must contain ${frame}\n${result.stderr}`);
        } catch (error) { failures.push(new Error(`sourceMap=${sourceMap}: ${name}`, { cause: error })); }
      }
    } catch (error) { failures.push(new Error(`sourceMap=${sourceMap}: host`, { cause: error })); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "runtime stack map assertions failed");
}

function fold(value: string): string {
  const slashed = value.replace(/\\/g, "/");
  return process.platform === "win32" ? slashed.toLowerCase() : slashed;
}
