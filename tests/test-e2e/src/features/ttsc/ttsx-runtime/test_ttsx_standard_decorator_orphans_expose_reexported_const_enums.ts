import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../../internal/ttsc/internal/ttsx-decorators";

/**
 * Verifies decorated CommonJS orphans expose const enums through export-star.
 *
 * Isolated runtime emission preserves const enums, so CommonJS name discovery
 * must use the same policy instead of erasing exports that exist at runtime.
 *
 * 1. Export a const enum and an interface directly or through a barrel.
 * 2. Import the decorated CommonJS package into ESM with cold and warm caches.
 * 3. Assert the enum is the actual CommonJS value and the interface stays absent.
 * @evidence contracts/testing.md#behavioral-verification Actual ESM imports of decorated CommonJS orphans must expose enum 42, share live default-object identity and omit interface OnlyType on first/repeated runs.
 * @evidence contracts/testing.md#independent-expectations Authored enum 42 and erased interface establish literals; same-object equality must follow actual CommonJS values rather than generated hints.
 * @evidence contracts/testing.md#distinguishing-cases Direct enum and export-star barrel each run first/repeated requests with retained cache. Owning-project preserve policy has a separate owner.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns four caught real imports over two source identities in two host sessions, with labeled assertions and aggregated failures.
 * @evidence contracts/e2e.md#necessary-boundary Node name advertisement must match isolated compiler enum values and live object identity; direct discovery cannot establish this transport.
 * @evidence contracts/e2e.md#shared-execution Both direct and barrel source shapes share one root preparation/cache and two first/repeated Node sessions. Distinct package paths preserve their own isolated emit identities.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique package/source identities isolate shapes in one retained root/cache; later hosts reset module state while unchanged inputs/cache remain retained.
 * @evidence contracts/e2e.md#preserved-coverage Four original success/effect and 42 true false observations remain. Both source shapes and both phases execute before aggregated failures are thrown.
 */
export function test_ttsx_standard_decorator_orphans_expose_reexported_const_enums() {
  const values = "export const enum Value { Entry = 42 }\nexport interface OnlyType { value: number }";
  const profiles = [{ name: "dep-direct", barrel: false }, { name: "dep-barrel", barrel: true }];
  const files: Record<string, string> = FixtureFiles.read("ttsc/ttsx_standard_decorator_orphans_expose_reexported_const_enums/inputs-1");
  const entry = ['declare const process: { exitCode: number };', 'export {};'];
  for (const profile of profiles) {
    const directory = "node_modules/" + profile.name;
    files[directory + "/package.json"] = JSON.stringify({ name: profile.name, type: "commonjs", exports: "./index.ts" });
    files[directory + "/index.ts"] = STANDARD_DECORATOR_SOURCE + (profile.barrel ? '\nexport * from "./values";' : values);
    files[directory + "/values.ts"] = values;
    entry.push(`console.log("BEGIN:${profile.name}");`, `try { const name: string = ${JSON.stringify(profile.name)}; const dep = await import(name); console.log(dep.Value.Entry, dep.Value === dep.default.Value, Object.hasOwn(dep, "OnlyType")); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }`, `console.log("END:${profile.name}");`);
  }
  files["src/main.ts"] = entry.join("\n");
  const root = TestProject.createProject(files);
  const cacheDir = TestProject.tmpdir("ttsx-decorator-reexports-");
  const failures: unknown[] = [];
  for (const phase of ["cold", "warm"]) {
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root, env: { TTSC_CACHE_DIR: cacheDir } });
    const lines = result.stdout.trim().split(/\r?\n/);
    for (const profile of profiles) {
      try {
        const begin = lines.indexOf("BEGIN:" + profile.name);
        const end = lines.indexOf("END:" + profile.name);
        assert.ok(begin >= 0 && end > begin, phase + ":" + profile.name);
        assert.equal(lines.slice(begin + 1, end).join("\n"), STANDARD_DECORATOR_OUTPUT + "\n42 true false", phase + ":" + profile.name);
      } catch (error) { failures.push(error); }
    }
    try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "orphan enum export batch failed");
}
