import assert from "node:assert/strict";

import { TestBanner } from "../../../internal/banner/internal/TestBanner";
import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/banner plugin: its text comes from the selected
 * configuration source and exactly one source wins.
 *
 * Three projects name the same plugin through different sources: a tsconfig
 * entry pointing at a JSON file, a package dependency that auto-discovers a
 * CommonJS `banner.config.cjs`, and a package dependency whose auto-discovered
 * configuration is overridden by an explicit tsconfig `configFile`. Each emits
 * the shared baseline and must carry one banner with its own text.
 *
 * 1. Emit the JSON, package-auto and override projects.
 * 2. Assert each output contains its expected preamble exactly once.
 * 3. Assert the override output does not contain the auto-discovered text.
 *
 * @evidence contracts/testing.md#behavioral-verification Real ttsc emits must produce exactly one preamble with the JSON text, the auto-discovered text and the explicit text respectively, and none of the overridden auto text.
 * @evidence contracts/testing.md#independent-expectations The authored configuration texts and the documented packageDocumentation preamble shape determine the expected block; the helper builds it from the contract, not from plugin output.
 * @evidence contracts/testing.md#distinguishing-cases JSON explicit path, executable CommonJS auto-discovery and explicit-over-auto precedence are distinct selection outcomes; the count of one and the absent auto text detect double injection. Missing configuration and inline keys are owned by the rejection scenario.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_banner with the shared workspace; selection is observed through the built launcher and native banner plugin rather than descriptor calls; executable CommonJS loading runs real Node inside the native host, which unit tests of the preamble builder do not exercise.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor configFile and package auto-discovery must reach the native configuration loader, including JSON parsing and executable configuration, and finish as emitted output.
 * @evidence contracts/e2e.md#shared-execution The three former projects reuse the experiment's one workspace copy, package link and plugin cache and differ only by configuration source, so three emits remain.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each project owns its manifest bounding discovery, its configuration files and its dist directory; the shared baseline is only read.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former JSON, auto-discovery and override assertions, including single-banner counts and the absent auto text.
 */
export function case_banner_selects_configuration_by_source(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  for (const [scenario, text] of [
    ["explicit-json", "json banner"],
    ["auto-package", "auto banner"],
    ["override", "explicit banner"],
  ] as const) {
    const result = UtilityWorkspace.emit(workspace, scenario);
    assert.equal(result.status, 0, `${scenario}: ${result.stderr}`);
    const js = UtilityWorkspace.read(workspace, scenario, "dist/main.js");
    TestBanner.assertSingleBanner(js, text);
    if (scenario === "override") assert.doesNotMatch(js, /auto banner/);
  }
}
