import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/banner plugin: `ttsx` applies an installed dependency's
 * own root configuration when it transpiles that dependency.
 *
 * `banner-pkg` is installed under `node_modules` with its own tsconfig plugin
 * entry and `banner.config.cjs`. When the consumer's program requires it, the
 * runtime's dependency cache must hold the JavaScript output whose recorded
 * source is the independently resolved package index.ts, carrying that
 * package's banner text. The runtime manifest selects the cache being
 * inspected.
 *
 * 1. Copy the static package into the consumer's `node_modules`.
 * 2. Run `ttsx` on the consumer entry, which requires the package and scans the
 *    dependency cache metadata from the runtime manifest.
 * 3. Assert the printed value and that exactly one package-owned output carries
 *    the package banner; absent or ambiguous source ownership cannot pass.
 *
 * @evidence contracts/testing.md#behavioral-verification A real ttsx run must execute the copied node_modules package, print root-ran and report bannered=true only when one JavaScript output in the selected cache names the independently resolved banner-pkg/index.ts as its singleton source and carries the package banner.
 * @evidence contracts/testing.md#independent-expectations Authored package files determine root-ran and package root banner. The fixture resolves node_modules/banner-pkg/index.ts independently with native realpath, then checks existing emittedSources metadata; it does not derive its expected source from that metadata. Recorded ownership is not independent authentication of compiler provenance or the loaded image.
 * @evidence contracts/testing.md#distinguishing-cases The dependency's own configuration is the positive input and the consumer has no banner config. Unrelated cached index files cannot satisfy the source-path match, and missing or ambiguous matching JavaScript outputs produce bannered=false. Known external-map output remains the ordinary configured-source contrast.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_utilities with the shared workspace; execution crosses the built ttsx launcher, native plugin and Node runtime.
 * @evidence contracts/e2e.md#necessary-boundary ttsx dependency transpilation, per-package plugin discovery and the runtime manifest meet only in a real runtime process.
 * @evidence contracts/e2e.md#shared-execution Reuses the shared workspace, package link and plugin cache; the installed package is a static fixture copied once and its distinct execution mode requires one ttsx process.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The package is copied only into this scenario's node_modules and the consumer has no ancestor banner configuration. Metadata is read after the actual dependency require; only its singleton independently resolved source output is inspected. The synchronous command result precedes assertions without certifying arbitrary descendant shutdown.
 * @evidence contracts/e2e.md#preserved-coverage Retains original status0 and exact root-ran bannered=true stdout plus authored package/config inputs. The fixture observer is strengthened from any cached index.js to the package's singleton source-owned output using existing metadata, with no product API or new scenario. Its new actual runtime survival remains unverified.
 */
export function case_banner_ttsx_discovers_an_installed_package_root_config(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const scenario = "ttsx";
  TestProject.copyDirectory(
    path.join(
      UtilityWorkspace.project(workspace, scenario),
      "installed",
      "banner-pkg",
    ),
    path.join(
      UtilityWorkspace.project(workspace, scenario),
      "node_modules",
      "banner-pkg",
    ),
  );
  const result = UtilityWorkspace.run(
    workspace,
    TestProject.TTSX_BIN,
    ["--cwd", UtilityWorkspace.project(workspace, scenario), "src/main.ts"],
    scenario,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "root-ran bannered=true");
}
