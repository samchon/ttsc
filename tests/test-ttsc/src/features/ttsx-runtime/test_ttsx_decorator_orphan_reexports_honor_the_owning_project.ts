import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorated orphan barrels respect re-exported sources' project emit.
 *
 * Export discovery reaches both isolated and project-owned sources. Applying
 * orphan options to an owned source can invent a const-enum export its compiler
 * erased, or miss a value the project preserved.
 *
 * 1. Re-export a project-owned const enum from a decorated CommonJS orphan.
 * 2. Run with preserveConstEnums disabled and enabled through cold/warm caches.
 * 3. Assert names match real values and name discovery executes no source effects.
 * @evidence contracts/testing.md#behavioral-verification Actual decorated CommonJS orphan reexports an owned enum to ESM. Exact preserve-dependent named/default presence, enum value, actual 17 and exactly one values-loaded effect detect invented exports and discovery executing source.
 * @evidence contracts/testing.md#independent-expectations The owned source authors enum 42 and actual 17; preserveConstEnums independently determines runtime enum presence, while the authored log must execute exactly once.
 * @evidence contracts/testing.md#distinguishing-cases Preserve false/true and CommonJS/ESM owners run first and repeated requests. Hook-loaded ESM-to-CJS bridge is selected only on Node 24+, with CommonJS on the Node 22 floor.
 * @evidence contracts/testing.md#execution-ownership One named E2E entry owns two hosts with caught per-profile imports and aggregated labeled observations; runtime fixtures are not extra test hosts.
 * @evidence contracts/e2e.md#necessary-boundary Actual Node name advertisement must use the reexported source owning project emit and retain live values without pre-execution side effects. Direct compiler/name units do not establish this bridge.
 * @evidence contracts/e2e.md#shared-execution All supported owning-program format/preserve identities share one root/cache and two cold/warm host sessions. Different package configurations require distinct compiler programs within those sessions, while root preparation and Node startup are shared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique package/source/config paths isolate producer options in one root; unchanged sources and retained cache survive into the next host, which resets Node module state. Synchronous completion precedes tracked cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All original supported format/preserve first/repeated successes, decoration effects, one values-loaded effect and enum/actual observations remain. Node 22 cannot execute the hook-loaded ESM bridge, and each profile and both phases execute before aggregated assertion failures are thrown.
 */
export function test_ttsx_decorator_orphan_reexports_honor_the_owning_project() {
  // Node 22 cannot require a hook-loaded ESM dependency from this CJS bridge.
  const modules = Number(process.versions.node.split(".")[0]) >= 24
    ? ["commonjs", "esnext"] : ["commonjs"];
  const profiles = modules.flatMap((module) => [false, true].map((preserve) => ({
    module, preserve, name: "dep-" + module + "-" + preserve,
  })));
  const files: Record<string, string> = {
    "package.json": '{"type":"module"}',
    "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "esnext", rootDir: "src", outDir: "dist" }),
  };
  const entry = ['declare const process: { exitCode: number };', 'export {};'];
  for (const profile of profiles) {
    const directory = "node_modules/" + profile.name;
    files[directory + "/package.json"] = JSON.stringify({ name: profile.name, type: "commonjs", exports: "./index.ts" });
    files[directory + "/index.ts"] = STANDARD_DECORATOR_SOURCE + '\nexport * from "./values/entry";';
    files[directory + "/values/package.json"] = JSON.stringify({ type: profile.module === "esnext" ? "module" : "commonjs" });
    files[directory + "/values/tsconfig.json"] = TestProject.tsconfig({ target: "ES2022", module: profile.module, rootDir: ".", outDir: "lib", preserveConstEnums: profile.preserve }, { include: ["entry.ts"] });
    files[directory + "/values/entry.ts"] = 'console.log("values-loaded"); export const enum Value { Entry = 42 } export const actual = 17;';
    entry.push(`console.log("BEGIN:${profile.name}");`, `try { const name: string = ${JSON.stringify(profile.name)}; const dep = await import(name); console.log(Object.hasOwn(dep, "Value"), Object.hasOwn(dep.default, "Value"), dep.Value?.Entry ?? "missing", dep.actual); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }`, `console.log("END:${profile.name}");`);
  }
  files["src/main.ts"] = entry.join("\n");
  const root = TestProject.createProject(files);
  const cacheDir = TestProject.tmpdir("ttsx-owned-reexport-");
  const failures: unknown[] = [];
  for (const phase of ["cold", "warm"]) {
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root, env: { TTSC_CACHE_DIR: cacheDir } });
    const lines = result.stdout.trim().split(/\r?\n/);
    for (const profile of profiles) {
      try {
        const begin = lines.indexOf("BEGIN:" + profile.name);
        const end = lines.indexOf("END:" + profile.name);
        assert.ok(begin >= 0 && end > begin, phase + ":" + profile.name);
        const output = lines.slice(begin + 1, end);
        assert.ok(output.join("\n").includes(STANDARD_DECORATOR_OUTPUT), phase + ":" + profile.name);
        assert.equal(output.filter((line) => line === "values-loaded").length, 1, phase + ":" + profile.name);
        assert.equal(output.at(-1), `${profile.preserve} ${profile.preserve} ${profile.preserve ? 42 : "missing"} 17`, phase + ":" + profile.name);
      } catch (error) { failures.push(error); }
    }
    try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "owned decorator reexport batch failed");
}
