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
} from "../../../../internal/ttsc/internal/ttsx-source-map";

/**
 * Verifies V8 coverage consumes entry and independently built dependency maps.
 *
 * Correct execution counts alone cannot establish source attribution. Both
 * entry and dependency maps must identify their physical TypeScript source
 * under maps-enabled and maps-disabled compiler configurations.
 *
 * 1. Create one entry and two independently configured dependency sources.
 * 2. Run separate root maps-enabled and maps-disabled V8 coverage sessions.
 * 3. Require actual maps, source paths and called/uncalled function counts.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual compiler-backed ttsx runs under NODE_V8_COVERAGE; each root/dependency script must expose nonnull map data, its exact physical source and used-positive/unused-zero function counts.
 * @evidence contracts/testing.md#independent-expectations The authored tall-comment fixture calls only used, so unused must remain zero and used must execute. Native physical paths independently identify source files; V8 coverage data is observed rather than constructed by the test.
 * @evidence contracts/testing.md#distinguishing-cases Root sourceMap true and false require separate entry preparations; two dependencies independently set sourceMap true and false in their own configs. Both served lanes retain real-map and called/uncalled twins; each assertion names its config and source on failure.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry runs two real compiler/Node coverage sessions. Fixture modules are compiler inputs; the source-map source units separately own pure inlining and path conversion decisions.
 * @evidence contracts/e2e.md#necessary-boundary V8 must consume served inline maps under original TS script URLs in both entry and dependency hooks; direct map conversion calls cannot prove the native coverage cache or function execution counts.
 * @evidence contracts/e2e.md#shared-execution Each root host imports both independently configured dependencies and its own library in one shared build/V8 session. The second host is necessary because root sourceMap changes; it shares immutable dependency inputs, while the runtime creates and releases fresh dependency publications for each session.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One fixture supplies distinct dependency names/configs and unchanged dependency bytes to both root configurations. Each runtime session owns fresh cleanupDir/deps publications, so no warm publication reuse across sessions is asserted. Synchronous child completion precedes fixture exit cleanup; V8 coverage directories remain tracked for the test process's exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All four previous entry/dependency maps-enabled/disabled cases retain successful exit, recorded script, nonnull map, exact physical source, unused-zero and used-positive assertions. Both dependency maps are checked in each actual root session; failures are collected across scripts and both root configurations.
 */
export function test_ttsx_coverage_maps_preserve_entry_and_dependency_sources_in_shared_hosts(): void {
  const options = {
    target: "ES2022",
    module: "commonjs",
    strict: true,
    sourceMap: true,
    outDir: "lib",
    rootDir: "src",
  };
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: options,
      include: ["src"],
    }),
    "src/lib.ts": tallCommentLibrarySource(),
    "src/main.ts": [
      'import { used as rootUsed } from "./lib";',
      'import { used as mappedUsed } from "dep-mapped";',
      'import { used as forcedUsed } from "dep-forced";',
      "rootUsed(); mappedUsed(); forcedUsed();",
      "",
    ].join("\n"),
  };
  for (const [name, sourceMap] of [
    ["dep-mapped", true],
    ["dep-forced", false],
  ] as const) {
    files[`node_modules/${name}/package.json`] = JSON.stringify({
      name,
      version: "1.0.0",
      exports: { ".": "./src/index.ts" },
    });
    files[`node_modules/${name}/tsconfig.json`] = JSON.stringify({
      compilerOptions: { ...options, sourceMap },
      include: ["src"],
    });
    files[`node_modules/${name}/src/index.ts`] = tallCommentLibrarySource();
  }
  const root = TestProject.createProject(files);
  const failures: Error[] = [];
  for (const sourceMap of [true, false]) {
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { ...options, sourceMap },
        include: ["src"],
      }),
    );
    const run = runTtsxWithCoverage(root, "src/main.ts");
    try {
      assert.equal(run.status, 0, run.stderr);
    } catch (error) {
      failures.push(new Error(`root sourceMap=${sourceMap}`, { cause: error }));
    }
    for (const relative of [
      "src/lib.ts",
      "node_modules/dep-mapped/src/index.ts",
      "node_modules/dep-forced/src/index.ts",
    ]) {
      try {
        const script = run.scriptEndingWith(relative.replaceAll("\\", "/"));
        assert.ok(script, `coverage must record ${relative}`);
        assert.notEqual(
          script.sourceMap,
          null,
          "source-map-cache.data must be present",
        );
        const mapped = sourceMapSourcePath(script);
        assert.ok(mapped, "the inlined map must list a source path");
        assert.equal(
          physicalRealpath(mapped),
          physicalRealpath(path.join(root, relative)),
          "the map must name the original physical TS source",
        );
        assert.equal(
          maxFunctionCount(script, "unused"),
          0,
          "the never-called export must record zero executions",
        );
        assert.ok(
          maxFunctionCount(script, "used") >= 1,
          "the called export must record at least one execution",
        );
      } catch (error) {
        failures.push(
          new Error(`sourceMap=${sourceMap}: ${relative}`, { cause: error }),
        );
      }
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "runtime coverage map assertions failed",
    );
}
