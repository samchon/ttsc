import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies orphan decorator stack traces retain source positions after caching.
 *
 * Decorator helpers move emitted lines. The isolated emit and its persistent
 * cache must retain an inline map whose path belongs to this exact source.
 *
 * 1. Load equivalent throwing decorated dependencies at two source paths per module format.
 * 2. Execute all four in one host, then repeat through the retained cache.
 * 3. Assert every stack points to the original method line in its own project.
 * @evidence contracts/testing.md#behavioral-verification Actual decorated errors must retain Error marker and own source line 6 through repeated hosts and equivalent files at other project paths.
 * @evidence contracts/testing.md#independent-expectations The authored throw is literally at line 6; the authored Error marker and own root path determine expectations independently of emitted maps.
 * @evidence contracts/testing.md#distinguishing-cases Two distinct package/source paths per ESM/CommonJS shape each run twice through a shared cache, distinguishing format, retained output and physical source path identity.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns eight caught actual Node error stacks and their labeled source-position assertions in two real host requests.
 * @evidence contracts/e2e.md#necessary-boundary Node must consume inline maps for emitted decorator helpers and cached lowering; direct map parsing cannot certify actual stacks.
 * @evidence contracts/e2e.md#shared-execution One root/cache and two host sessions serve all four throwing dependencies. Two paths per format distinguish borrowed maps, and the repeated host retains the cache boundary without repeating root preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique source paths with identical content share a retained cache. Completed processes reset module state before the next host; tracked inputs survive all requests.
 * @evidence contracts/e2e.md#preserved-coverage Eight original nonzero statuses, Error markers and own-path line-6 assertions remain. Caught actual errors preserve each own-path stack and set the shared host nonzero; all eight assertions run before aggregated failures. The eight former process-status observations now have two nonzero host statuses plus eight explicit error records, so a missing per-consumer throw still fails.
 */
export function test_ttsx_standard_decorator_orphan_maps_survive_cached_runs() {
  const profiles = ["module", "commonjs"].flatMap((type) => [1, 2].map((copy) => ({ type, name: "dep-map-" + type + "-" + copy })));
  const files: Record<string, string> = FixtureFiles.read("ttsc/ttsx_standard_decorator_orphan_maps_survive_cached_runs/inputs-1");
  const entry = ['declare const process: { exitCode: number };', 'export {};'];
  for (const profile of profiles) {
    const directory = "node_modules/" + profile.name;
    files[directory + "/package.json"] = JSON.stringify({ name: profile.name, type: profile.type, exports: "./index.ts" });
    files[directory + "/index.ts"] = [
      'export * from "./values";',
      "function decorated(value: Function, context: ClassDecoratorContext) {}",
      "@decorated", "class Foo {", "  run() {",
      '    throw new Error("decorator-map");', "  }", "}",
      "export const run = () => new Foo().run();",
    ].join("\n");
    files[directory + "/values.ts"] = "export const value = 1;";
    entry.push(`try { const name: string = ${JSON.stringify(profile.name)}; const dep = await import(name); dep.run(); console.log(${JSON.stringify(profile.name)} + ":NO_ERROR"); } catch (error) { console.log(JSON.stringify({ name: ${JSON.stringify(profile.name)}, stack: error instanceof Error ? error.stack : String(error) })); process.exitCode = 1; }`);
  }
  files["src/main.ts"] = entry.join("\n");
  const root = TestProject.createProject(files);
  const cacheDir = TestProject.tmpdir("ttsx-decorator-maps-");
  const failures: unknown[] = [];
  for (const phase of ["cold", "warm"]) {
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root, env: { TTSC_CACHE_DIR: cacheDir } });
    const records = new Map<string, string>();
    for (const line of result.stdout.trim().split(/\r?\n/)) {
      try {
        const record = JSON.parse(line) as { name: string; stack: string };
        assert.equal(records.has(record.name), false, "duplicate map observation");
        records.set(record.name, record.stack);
      } catch (error) { failures.push(error); }
    }
    for (const profile of profiles) {
      try {
        const stack = records.get(profile.name);
        assert.equal(typeof stack, "string", phase + ":" + profile.name);
        assert.match(stack!, /Error: decorator-map/);
        assert.ok(stack!.replaceAll("\\", "/").includes(path.join(root, "node_modules", profile.name, "index.ts").replaceAll("\\", "/") + ":6:"), stack);
      } catch (error) { failures.push(error); }
    }
    try { assert.notEqual(result.status, 0, phase + ": expected throwing consumers"); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "orphan decorator map batch failed");
}
