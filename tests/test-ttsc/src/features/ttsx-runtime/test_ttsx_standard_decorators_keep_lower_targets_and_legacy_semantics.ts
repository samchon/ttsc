import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorator support retains lower targets and legacy semantics.
 *
 * The runtime override applies only to ESNext. Raising a configured lower
 * target changes emitted syntax, and experimentalDecorators selects another
 * API.
 *
 * 1. Run the standard example at default, ES2025, and ES2019 targets.
 * 2. Assert optional chaining follows the effective config or CLI target.
 * 3. Run a legacy class decorator with experimentalDecorators at ESNext.
 * @evidence contracts/testing.md#behavioral-verification The actual compiler and Node execute five standard decorator target profiles and legacy ESNext, preserving every complete replacement/method output and optional function syntax result.
 * @evidence contracts/testing.md#independent-expectations The original authored decorator sequence and legacy Foo marker define literal execution expectations; optional chaining must remain at default/ES2025 and lower at ES2019, independently of runtime option computation.
 * @evidence contracts/testing.md#distinguishing-cases Default, ES2025, ES2019 and the effective results of CLI ES2019/null remain separately labeled immutable consumers. The actual Go TestRuntimeDecoratorTargetProfiles owns native parser overlay and emitted syntax, and the runtimeCompilerArgs source unit owns exact original token retention and override suffixes; legacy retains its distinct decorator API.
 * @evidence contracts/testing.md#execution-ownership One named E2E entry owns six individually caught dynamic imports and AggregateError assertions in one real Node host. Fixture modules are inputs; no hidden test hosts or per-profile CLI processes exist.
 * @evidence contracts/e2e.md#necessary-boundary Compiler-generated standard replacement methods and legacy class decorators must execute in Node; option and raw-emit units do not certify these observable effects.
 * @evidence contracts/e2e.md#shared-execution Six separate consumer roots and launchers are one root project and host. Unique dependency programs retain genuinely different effective option identities; CLI overlay decisions are directly exercised in the real Go compiler unit and portable runtime argument unit instead of repeated root launchers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique package paths isolate all six module caches and compiler configurations. Each dependency is immutable and first loaded once; there is no warm reuse, source mutation or cold invalidation transition to erase. Synchronous completion precedes harness fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Every original zero status, complete standard output plus optional-chain boolean and legacy Foo assertion survives in its labeled consumer. Actual compiler CLI parser overlays and runtime argument policy have explicit unit owners; all imports and assertions run before aggregated failure.
 */
export function test_ttsx_standard_decorators_keep_lower_targets_and_legacy_semantics() {
  const profiles = [
    { name: "default", target: undefined, optional: true },
    { name: "es2025", target: "ES2025", optional: true },
    { name: "es2019", target: "ES2019", optional: false },
    { name: "cli-es2019", target: "ES2019", optional: false },
    { name: "cli-null", target: undefined, optional: true },
  ];
  const files: Record<string, string> = {
    "package.json": '{"type":"module"}',
    "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "esnext", rootDir: "src", outDir: "dist", strict: true }),
  };
  const entry = ["declare const process: { exitCode: number };", "export {};"];
  for (const profile of profiles) {
    const name = "decorator-" + profile.name;
    const directory = "node_modules/" + name;
    files[directory + "/package.json"] = JSON.stringify({ name, type: "commonjs", exports: "./src/main.ts" });
    files[directory + "/tsconfig.json"] = TestProject.tsconfig({ target: profile.target, module: "commonjs", rootDir: "src", outDir: "dist", strict: true });
    files[directory + "/src/main.ts"] = STANDARD_DECORATOR_SOURCE + '\nexport {};\nfunction optional(value?: { answer: number }) { return value?.answer; }\nconsole.log(optional.toString().includes("?."));';
    entry.push(`console.log("BEGIN:${profile.name}");`,
      `try { const name: string = ${JSON.stringify(name)}; await import(name); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }`,
      `console.log("END:${profile.name}");`);
  }
  files["node_modules/decorator-legacy/package.json"] = '{"name":"decorator-legacy","type":"commonjs","exports":"./src/main.ts"}';
  files["node_modules/decorator-legacy/tsconfig.json"] = TestProject.tsconfig({ target: "ESNext", module: "commonjs", rootDir: "src", outDir: "dist", strict: true, experimentalDecorators: true });
  files["node_modules/decorator-legacy/src/main.ts"] = "function legacy(target: Function) { console.log(target.name); }\n@legacy\nclass Foo {}\nnew Foo();\nexport {};";
  entry.push('console.log("BEGIN:legacy");', 'try { const name: string = "decorator-legacy"; await import(name); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }', 'console.log("END:legacy");');
  files["src/main.ts"] = entry.join("\n");
  const root = TestProject.createProject(files);
  const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root });
  const lines = result.stdout.trim().split(/\r?\n/);
  const failures: unknown[] = [];
  for (const profile of [...profiles, { name: "legacy", optional: undefined }]) {
    try {
      const begin = lines.indexOf("BEGIN:" + profile.name);
      const end = lines.indexOf("END:" + profile.name);
      assert.ok(begin >= 0 && end > begin, profile.name);
      const expected = profile.name === "legacy" ? "Foo" : STANDARD_DECORATOR_OUTPUT + "\n" + profile.optional;
      assert.equal(lines.slice(begin + 1, end).join("\n"), expected, profile.name);
    } catch (error) { failures.push(error); }
  }
  try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, "decorator target profiles failed");
}
