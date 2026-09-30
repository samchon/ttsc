import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  maxFunctionCount,
  physicalRealpath,
  runTtsxWithCoverage,
  sourceMapSourcePath,
  tallCommentLibrarySource,
} from "../../internal/ttsx-source-map";

/**
 * V8 consumes real maps from both entry and independently built dependency lanes.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual compiler-backed ttsx runs under NODE_V8_COVERAGE; each root/dependency script must expose nonnull map data, its exact physical source and used-positive/unused-zero function counts.
 * @evidence contracts/testing.md#independent-expectations The authored tall-comment fixture calls only used, so unused must remain zero and used must execute. Native physical paths independently identify source files; V8 coverage data is observed rather than constructed by the test.
 * @evidence contracts/testing.md#distinguishing-cases Root sourceMap true and false require separate entry preparations; two dependencies independently set sourceMap true and false in their own configs. Both served lanes retain real-map and called/uncalled twins; each assertion names its config and source on failure.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry runs two real compiler/Node coverage sessions. Fixture modules are compiler inputs; the source-map source units separately own pure inlining and path conversion decisions.
 * @evidence contracts/e2e.md#necessary-boundary V8 must consume served inline maps under original TS script URLs in both entry and dependency hooks; direct map conversion calls cannot prove the native coverage cache or function execution counts.
 * @evidence contracts/e2e.md#shared-execution The first root host imports both independently configured dependency packages and its own library, sharing root build and V8 session. The second host is necessary because the root compiler configuration changes from maps enabled to disabled; it reuses unchanged dependency publications rather than rebuilding them per assertion.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One fresh fixture gives both dependencies genuinely cold first publications; their distinct names/configs prevent cache identity collision. The second root preparation changes its own sourceMap input only, retaining equivalent immutable dependencies. Each synchronous coverage session owns and closes its output directory before TestProject removes the fixture.
 * @evidence contracts/e2e.md#preserved-coverage All four previous entry/dependency maps-enabled/disabled cases retain successful exit, recorded script, nonnull map, exact physical source, unused-zero and used-positive assertions. The batch additionally rechecks both dependency maps after warm publication reuse; failures are collected across scripts and both root configurations.
 */
export function test_ttsx_coverage_maps_preserve_entry_and_dependency_sources_in_shared_hosts(): void {
  const options = {
    target: "ES2022", module: "commonjs", strict: true,
    sourceMap: true, outDir: "lib", rootDir: "src",
  };
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({ compilerOptions: options, include: ["src"] }),
    "src/lib.ts": tallCommentLibrarySource(),
    "src/main.ts": [
      'import { used as rootUsed } from "./lib";',
      'import { used as mappedUsed } from "dep-mapped";',
      'import { used as forcedUsed } from "dep-forced";',
      "rootUsed(); mappedUsed(); forcedUsed();", "",
    ].join("\n"),
  };
  for (const [name, sourceMap] of [["dep-mapped", true], ["dep-forced", false]] as const) {
    files[`node_modules/${name}/package.json`] = JSON.stringify({
      name, version: "1.0.0", exports: { ".": "./src/index.ts" },
    });
    files[`node_modules/${name}/tsconfig.json`] = JSON.stringify({
      compilerOptions: { ...options, sourceMap }, include: ["src"],
    });
    files[`node_modules/${name}/src/index.ts`] = tallCommentLibrarySource();
  }
  const root = TestProject.createProject(files);
  const failures: Error[] = [];
  for (const sourceMap of [true, false]) {
    fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({
      compilerOptions: { ...options, sourceMap }, include: ["src"],
    }));
    const run = runTtsxWithCoverage(root, "src/main.ts");
    try {
      assert.equal(run.status, 0, run.stderr);
    } catch (error) { failures.push(new Error(`root sourceMap=${sourceMap}`, { cause: error })); }
    for (const relative of ["src/lib.ts", "node_modules/dep-mapped/src/index.ts", "node_modules/dep-forced/src/index.ts"]) {
      try {
        const script = run.scriptEndingWith(relative.replaceAll("\\", "/"));
        assert.ok(script, `coverage must record ${relative}`);
        assert.notEqual(script.sourceMap, null, "source-map-cache.data must be present");
        const mapped = sourceMapSourcePath(script);
        assert.ok(mapped, "the inlined map must list a source path");
        assert.equal(physicalRealpath(mapped), physicalRealpath(path.join(root, relative)),
          "the map must name the original physical TS source");
        assert.equal(maxFunctionCount(script, "unused"), 0,
          "the never-called export must record zero executions");
        assert.ok(maxFunctionCount(script, "used") >= 1,
          "the called export must record at least one execution");
      } catch (error) { failures.push(new Error(`sourceMap=${sourceMap}: ${relative}`, { cause: error })); }
    }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "runtime coverage map assertions failed");
}
