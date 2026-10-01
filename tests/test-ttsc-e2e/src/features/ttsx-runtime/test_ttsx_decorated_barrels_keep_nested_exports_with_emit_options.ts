import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorated barrels retain nested exports across compiler emit
 * options.
 *
 * Owned output may rewrite .ts specifiers or qualify export helpers through
 * tslib. Name discovery must understand that output without changing its
 * values.
 *
 * 1. Re-export an owned barrel with rewriting/importHelpers independently enabled.
 * 2. Exercise both an orphan and a project-owned decorated outer barrel.
 * 3. Assert nested named exports and the original live CommonJS getter survive.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx serves all eight owned/orphan, rewrite and helper combinations, preserving exact decorator output, named actual/nested values, default nested value and its live change to 43 for each labeled dependency.
 * @evidence contracts/testing.md#independent-expectations Authored export values 17 and 42, the explicit change assignment 43 and the established standard decorator sequence define literal expectations independently of export discovery or emitted metadata.
 * @evidence contracts/testing.md#distinguishing-cases All original owned2 x rewrite2 x helpers2 compiler profiles remain; extension rewriting changes nested.ts spelling and importHelpers changes compiler helper shape, while owner presence changes project discovery and orphan lowering. The source metadata and preparation units own inert text and scope permutations separately.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns one public launcher session with eight individually labeled dynamic consumers; each original profile has its own immutable dependency namespace and expected output, and AggregateError retains unrelated failures.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler-generated reexport helpers under distinct options must connect to Node named-export discovery and live CommonJS getters; direct metadata inputs do not prove the compiler emits and publishes those option-dependent shapes.
 * @evidence contracts/e2e.md#shared-execution Eight root compiler workspaces, launcher lifetimes and tslib copies are one root project, one shared tslib installation fixture and one host. Dependency-owned option profiles differ genuinely and retain their necessary compilation inside that session.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Every immutable scenario has a unique package name and directory so Node cache and compiler package identity cannot alias different profiles; each live getter changes only its own module after its initial assertions. No cold-cache or mutation-invalidation transition is removed; the launcher and TestProject own output and fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Every original zero-status and complete decorator-plus-17-42-42-43 output distinction remains in one labeled profile; caught imports and aggregated assertions expose all profiles before failure. No compiler option profile is replaced with a parser-only claim.
 */
export function test_ttsx_decorated_barrels_keep_nested_exports_with_emit_options(): void {
  const files: Record<string, string> = {
    "package.json": '{"type":"module"}',
    "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "esnext", rootDir: "src", outDir: "dist" }),
  };
  const scenarios: string[] = [];
  const entry = ["declare const process: { exitCode: number };", "export {};"];
  for (const owned of [false, true]) {
    for (const rewrite of [false, true]) {
      for (const helpers of [false, true]) {
        const name = `dep-${Number(owned)}${Number(rewrite)}${Number(helpers)}`;
        const directory = `node_modules/${name}`;
        scenarios.push(name);
        files[`${directory}/package.json`] = JSON.stringify({ name, type: "commonjs", exports: "./index.ts" });
        if (owned) files[`${directory}/tsconfig.json`] = TestProject.tsconfig({
          target: "ESNext", module: "commonjs", rootDir: ".", outDir: "lib", importHelpers: helpers, rewriteRelativeImportExtensions: rewrite,
        }, { include: ["index.ts"] });
        files[`${directory}/index.ts`] = STANDARD_DECORATOR_SOURCE + '\nexport * from "./values/entry";';
        files[`${directory}/values/tsconfig.json`] = TestProject.tsconfig({
          target: "ES2022", module: "commonjs", rootDir: ".", outDir: "lib", importHelpers: helpers, rewriteRelativeImportExtensions: rewrite,
        }, { include: ["*.ts"] });
        files[`${directory}/values/entry.ts`] = `export const actual = 17; export * from "./nested${rewrite ? ".ts" : ""}";`;
        files[`${directory}/values/nested.ts`] = "export let nested = 42; export function change() { nested = 43; }";
        entry.push(`console.log("BEGIN:${name}");`,
          `try { const name: string = ${JSON.stringify(name)}; const dep = await import(name); console.log(dep.actual, dep.nested, dep.default.nested); dep.change(); console.log(dep.default.nested); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }`,
          `console.log("END:${name}");`);
      }
    }
  }
  files["src/main.ts"] = entry.join("\n");
  const root = TestProject.createProject(files);
  const tslibRoot = path.dirname(createRequire(import.meta.url).resolve("tslib/package.json"));
  TestProject.copyDirectory(tslibRoot, path.join(root, "node_modules/tslib"));
  const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root });
  const lines = result.stdout.trim().split(/\r?\n/);
  const failures: unknown[] = [];
  for (const name of scenarios) {
    try {
      const begin = lines.indexOf(`BEGIN:${name}`);
      const end = lines.indexOf(`END:${name}`);
      assert.ok(begin >= 0 && end > begin, name);
      assert.equal(lines.slice(begin + 1, end).join("\n"), STANDARD_DECORATOR_OUTPUT + "\n17 42 42\n43", name);
    } catch (error) { failures.push(error); }
  }
  try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, "decorated export option profiles failed");
}
