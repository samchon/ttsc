import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/banner plugin: `ttsx` applies an installed dependency's own
 * root configuration when it transpiles that dependency.
 *
 * `banner-pkg` is installed under `node_modules` with its own tsconfig plugin
 * entry and `banner.config.cjs`. When the consumer's program requires it, the
 * runtime's dependency cache must hold a transpiled `index.js` carrying the
 * package's banner text, found through the runtime manifest the host exports.
 *
 * 1. Copy the static package into the consumer's `node_modules`.
 * 2. Run `ttsx` on the consumer entry, which requires the package and scans the
 *    dependency cache from the runtime manifest.
 * 3. Assert the printed value and that a cached index carries the package banner.
 *
 * @evidence contracts/testing.md#behavioral-verification A real ttsx run must execute the installed package, print root-ran, and find the package root banner text inside the transpiled dependency cache it reports.
 * @evidence contracts/testing.md#independent-expectations The authored package files determine the printed value and banner text; the entry source reads the runtime manifest's cache directory itself rather than relying on plugin claims.
 * @evidence contracts/testing.md#distinguishing-cases The package-root configuration of a dependency is the positive input; the consumer itself has no banner configuration, so a banner found in the cache must have come from the package's own discovery.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_utilities with the shared workspace; execution crosses the built ttsx launcher, native plugin and Node runtime.
 * @evidence contracts/e2e.md#necessary-boundary ttsx dependency transpilation, per-package plugin discovery and the runtime manifest meet only in a real runtime process.
 * @evidence contracts/e2e.md#shared-execution Reuses the shared workspace, package link and plugin cache; the installed package is a static fixture copied once and its distinct execution mode requires one ttsx process.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The consumer carries no banner configuration and none lies on its ancestor path, so a banner found in the dependency cache cannot come from it; the package is copied only into this scenario's node_modules; the synchronous process is joined before assertions.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former exit status and exact stdout assertion; the installed package files are now static fixtures with identical contents.
 */
export function case_banner_ttsx_discovers_an_installed_package_root_config(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const scenario = "ttsx";
  TestProject.copyDirectory(
    path.join(UtilityWorkspace.project(workspace, scenario), "installed", "banner-pkg"),
    path.join(UtilityWorkspace.project(workspace, scenario), "node_modules", "banner-pkg"),
  );
  const result = UtilityWorkspace.run(workspace, 
    TestProject.TTSX_BIN,
    ["--cwd", UtilityWorkspace.project(workspace, scenario), "src/main.ts"],
    scenario,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "root-ran bannered=true");
}
