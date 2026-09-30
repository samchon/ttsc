import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorated source dependencies execute with and without a tsconfig.
 *
 * Dependency builds used to preserve ESNext decorators, while orphan ESM
 * stripping could not transform them. Both paths need compiler lowering.
 *
 * 1. Install a decorated raw source package in each module format.
 * 2. Run a dynamic import with and without the dependency's own tsconfig.
 * 3. Assert decoration and the dependency's named export survive cold and warm
 *    runs.
 * @evidence contracts/testing.md#behavioral-verification Four actual dependency/orphan consumers execute complete class/method replacement effects and imported answer 42 in both first and subsequent process requests. All eight labeled results remain observable, including a producer failure that leaves other imports executable.
 * @evidence contracts/testing.md#independent-expectations The authored decorators log class construction, method wrapping and abc, and the separate helper exports literal 42. Exact output is independent of cache metadata or compiler output inspection.
 * @evidence contracts/testing.md#distinguishing-cases Configured versus orphan emission and ESM versus CommonJS named-export transport remain four distinct immutable packages. Two separate process sessions retain fresh versus retained-cache requests; this test asserts effects after retained state, not an independently measured cache-hit count. Raw decorator transformations also have actual Go/VM unit owners.
 * @evidence contracts/testing.md#execution-ownership This one named E2E entry owns four caught imports in each of two actual Node hosts and aggregates all eight observations. Fixture modules are inputs, not extra test entries; no per-profile root launcher exists.
 * @evidence contracts/e2e.md#necessary-boundary Own-project and orphan runtime compilation, dependency resolution, named export serving and retained-cache execution connect through actual Node loading. A direct compiler/VM unit does not establish either runtime lane or process-to-process publication.
 * @evidence contracts/e2e.md#shared-execution Four roots and eight launchers become one immutable root and two sessions. Different package module/config identities retain necessary producers; the root compilation and host lifetime are shared across four consumers within each phase. No product or contributor build is repeated per assertion.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each profile has a unique package/source/config identity and the owned cache directory starts fresh. The second session reuses unchanged sources and the same cache; no blanket deletion removes the retained-state boundary. Separate processes reset module caches, and synchronous completion precedes tracked fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All original four format/config combinations, their first/second zero status and complete decorated output plus answer 42 survive as eight labeled assertions. Independent imports and all assertion catches prevent one failed case from hiding unrelated results; cold/warm phases both run before AggregateError.
 */
export function test_ttsx_executes_standard_decorators_in_source_dependencies() {
    const cacheDir = TestProject.tmpdir("ttsx-decorators-cache-");
  const profiles = [
    { name: "orphan-esm", module: "esnext", configured: false },
    { name: "configured-esm", module: "esnext", configured: true },
    { name: "orphan-cjs", module: "commonjs", configured: false },
    { name: "configured-cjs", module: "commonjs", configured: true },
  ];
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ type: "module" }),
    "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "esnext", rootDir: "src", outDir: "dist", strict: true }),
  };
  const entry = ['declare const process: { exitCode: number };', 'export {};'];
  for (const profile of profiles) {
    const name = "decorated-" + profile.name;
    const directory = "node_modules/" + name;
    files[directory + "/package.json"] = JSON.stringify({ name, type: profile.module === "commonjs" ? "commonjs" : "module", exports: "./src/index.ts" });
    if (profile.configured) files[directory + "/tsconfig.json"] = TestProject.tsconfig({ target: "ESNext", module: profile.module, rootDir: "src", outDir: "lib" });
    files[directory + "/src/index.ts"] = 'import { answer } from "./helper";\n' + STANDARD_DECORATOR_SOURCE + "\nexport { answer };\n";
    files[directory + "/src/helper.ts"] = "export const answer = 42;";
    entry.push(`console.log("BEGIN:${profile.name}");`, `try { const name: string = ${JSON.stringify(name)}; const dep = await import(name); console.log(dep.answer); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }`, `console.log("END:${profile.name}");`);
  }
  files["src/main.ts"] = entry.join("\n");
  const root = TestProject.createProject(files);
  const failures: unknown[] = [];
  for (const phase of ["cold", "warm"]) {
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root, env: { TTSC_CACHE_DIR: cacheDir } });
    const lines = result.stdout.trim().split(/\r?\n/);
    for (const profile of profiles) {
      try {
        const begin = lines.indexOf("BEGIN:" + profile.name);
        const end = lines.indexOf("END:" + profile.name);
        assert.ok(begin >= 0 && end > begin, phase + ":" + profile.name);
        assert.equal(lines.slice(begin + 1, end).join("\n"), STANDARD_DECORATOR_OUTPUT + "\n42", phase + ":" + profile.name);
      } catch (error) { failures.push(error); }
    }
    try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "decorated dependency cold/warm batch failed");
}
