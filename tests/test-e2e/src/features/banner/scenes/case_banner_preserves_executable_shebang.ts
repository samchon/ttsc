import assert from "node:assert/strict";

import { TestBanner } from "../../../internal/banner/internal/TestBanner";
import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/banner plugin: a shebang stays the first line of the
 * output and the banner follows it.
 *
 * Moving the banner above a `#!` line would make the emitted CLI unexecutable.
 *
 * 1. Compile the ordinary and shebang sources together with external maps.
 * 2. Assert the output still starts with the shebang line.
 * 3. Assert the banner appears exactly once.
 *
 * @evidence contracts/testing.md#behavioral-verification A real emit of a shebang source must keep the shebang as the first bytes of the JavaScript and include one banner preamble.
 * @evidence contracts/testing.md#independent-expectations The Unix interpreter-line contract requires the shebang at byte zero; the authored source supplies it and the preamble helper states the banner shape.
 * @evidence contracts/testing.md#distinguishing-cases The shebang source is the boundary input; the shared baseline emitted by other scenarios without one is the contrast.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_banner with the shared workspace; output ordering is observed in real emitted bytes.
 * @evidence contracts/e2e.md#necessary-boundary Emit-time preamble insertion and the compiler's hashbang handling meet in the native host.
 * @evidence contracts/e2e.md#shared-execution One external-map compiler Program emits the ordinary and shebang sources together; the map scenario reads the same output rather than starting another compiler.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This scenario prepares the external-map output and the map scenario only reads it after the compiler joins. Missing output fails, and no previous fixture output is copied.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former shebang-first and single-banner assertions; the banner text is now the shared configuration's.
 */
export function case_banner_preserves_executable_shebang(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const result = UtilityWorkspace.emit(workspace, "external-maps");
  assert.equal(result.status, 0, result.stderr);
  const js = UtilityWorkspace.read(workspace, "external-maps", "dist/shebang.js");
  assert.equal(js.startsWith("#!/usr/bin/env node\n"), true, js);
  TestBanner.assertSingleBanner(js, TestBanner.SHARED_TEXT);
}
