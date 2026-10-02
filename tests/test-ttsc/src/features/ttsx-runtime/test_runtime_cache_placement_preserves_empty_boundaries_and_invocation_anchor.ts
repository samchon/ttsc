import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveCacheDir } from "../../../../../packages/ttsc/src/launcher/internal/resolveCacheDir";
import { SourceBuildCacheLayout } from "../../../../../packages/ttsc/src/plugin/internal/source/SourceBuildCacheLayout";
import { resolveSourceBuildCachePaths } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveSourceBuildCachePaths";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies runtime cache placement across installation and marking transitions.
 *
 * The launcher anchors explicit cache options to its invocation directory;
 * default placement uses installation evidence. Publishing ttsc's marker must
 * preserve a nearer empty installation instead of making an outer dependency
 * win.
 *
 * 1. Resolve absent, relative and absolute options against a distinct invocation
 *    path.
 * 2. Compare nested project discovery before creating a nearer empty installation.
 * 3. Mark that installation's cache and require unchanged default placement.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual resolveCacheDir anchors explicit options, and resolveSourceBuildCachePaths selects an outer installation for a nested project until a nearer empty node_modules appears; SourceBuildCacheLayout marking must preserve that new root. No launcher or compiler runs.
 * @evidence contracts/testing.md#independent-expectations Authored outer dependency and empty nearer installation determine literal native paths independently of resolver output. The explicit .ttsx-cache path is anchored to the supplied invocation directory, and unset/empty input preserves downstream selection.
 * @evidence contracts/testing.md#distinguishing-cases Missing and empty options contrast with relative and absolute options; nested configuration without a nearer installation contrasts with an empty nearer installation before and after its real marker write. Environment override and explicit option precedence contrast with default placement.
 * @evidence contracts/testing.md#execution-ownership One filename-matching source unit calls the actual launcher option resolver, source-build cache resolver and layout writer over a tracked filesystem fixture, with no installed consumer, native build, child process or product host. Surviving E2E owns runtime cache construction and cleanup.
 */
export function test_runtime_cache_placement_preserves_empty_boundaries_and_invocation_anchor(): void {
  const root = TestProject.physicalPath(
    TestProject.createProject({
      "package.json": '{"name":"runtime-cache-source"}',
      "node_modules/dependency/package.json": '{"name":"dependency"}',
      "test/tsconfig.json":
        '{"compilerOptions":{"rootDir":".","outDir":"../dist"},"include":["main.ts"]}',
      "test/main.ts": "export const value = 1;\n",
    }),
  );
  const nested = path.join(root, "test");
  const driver = path.join(root, "driver");
  const failures: Error[] = [];
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const outerCache = path.join(root, "node_modules", ".cache", "ttsc");
  const nestedCache = path.join(nested, "node_modules", ".cache", "ttsc");
  check("invocation-relative cache", () => {
    assert.equal(resolveCacheDir(nested), undefined);
    assert.equal(resolveCacheDir(nested, ""), undefined);
    assert.equal(
      resolveCacheDir(nested, ".ttsx-cache"),
      path.join(nested, ".ttsx-cache"),
    );
    assert.notEqual(
      resolveCacheDir(nested, ".ttsx-cache"),
      path.join(driver, ".ttsx-cache"),
    );
    assert.equal(resolveCacheDir(driver, outerCache), outerCache);
  });
  check("nested config does not create an installation", () => {
    assert.equal(
      resolveSourceBuildCachePaths(nested, undefined, {}).root,
      outerCache,
    );
    assert.equal(fs.existsSync(path.join(nested, "node_modules")), false);
  });
  fs.mkdirSync(path.join(nested, "node_modules"));
  check("empty nearer installation", () => {
    assert.equal(
      resolveSourceBuildCachePaths(nested, undefined, {}).root,
      nestedCache,
    );
  });
  fs.mkdirSync(nestedCache, { recursive: true });
  check("publish nearer installation marker", () => {
    assert.equal(
      SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(nestedCache),
      nestedCache,
    );
  });
  check("marked nearer installation", () => {
    assert.equal(
      resolveSourceBuildCachePaths(nested, undefined, {}).root,
      nestedCache,
    );
  });
  check("explicit and environment precedence", () => {
    assert.equal(
      resolveSourceBuildCachePaths(nested, undefined, {
        TTSC_CACHE_DIR: "environment",
      }).root,
      path.join(nested, "environment"),
    );
    assert.equal(
      resolveSourceBuildCachePaths(nested, "explicit", {
        TTSC_CACHE_DIR: "environment",
      }).root,
      path.join(nested, "explicit"),
    );
  });
  if (failures.length)
    throw new AggregateError(failures, "runtime cache placement failed");
}
