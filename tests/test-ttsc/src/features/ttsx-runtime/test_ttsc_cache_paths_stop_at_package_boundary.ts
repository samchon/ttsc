import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveSourceBuildCachePaths } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveSourceBuildCachePaths";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that an unrelated ancestor installation cannot own a package cache.
 *
 * 1. Put a package with only its own ttsc output below an installed ancestor.
 * 2. Resolve its default cache before and after the ancestor declares a package.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production resolver on real nested directories and checks the selected native cache roots across a package-manifest transition.
 * @evidence contracts/testing.md#independent-expectations The inner package manifest owns its default cache while the outer installation has no package declaration; an added outer manifest makes that installation an eligible shared owner.
 * @evidence contracts/testing.md#distinguishing-cases An unrelated installed ancestor is rejected while the same installation with a declared package is admitted; workspace markers and explicit environment overrides have separate owner tests.
 * @evidence contracts/testing.md#execution-ownership A tracked temporary tree supplies filesystem inputs to the source cache resolver without starting Go, a plugin or a compiler host.
 */
export function test_ttsc_cache_paths_stop_at_package_boundary(): void {
  const root = TestProject.tmpdir("ttsc-cache-package-boundary-");
  const outer = path.join(root, "outer");
  const project = path.join(outer, "project");
  fs.mkdirSync(path.join(outer, "node_modules", "dependency"), {
    recursive: true,
  });
  fs.mkdirSync(
    path.join(project, "node_modules", ".cache", "ttsc", "plugins"),
    {
      recursive: true,
    },
  );
  fs.writeFileSync(path.join(project, "package.json"), '{"private":true}');
  const selected = (directory: string): string =>
    resolveSourceBuildCachePaths(project, undefined, {}).root ===
    path.join(directory, "node_modules", ".cache", "ttsc")
      ? directory
      : "";
  assert.equal(selected(project), project);
  fs.writeFileSync(path.join(outer, "package.json"), '{"private":true}');
  assert.equal(selected(outer), outer);
}
