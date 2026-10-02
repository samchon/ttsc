import assert from "node:assert/strict";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/strip plugin: inline configuration keys in the tsconfig
 * plugin entry are rejected.
 *
 * Keys such as `calls` were once accepted inline. A stale entry must fail with
 * a message naming the key instead of silently falling back to defaults.
 *
 * 1. Emit the scenario whose plugin entry carries `calls`.
 * 2. Assert a nonzero exit.
 * 3. Assert stderr names the unsupported `calls` key.
 *
 * @evidence contracts/testing.md#behavioral-verification The launcher must reject the obsolete inline calls entry with a nonzero exit and an error naming calls.
 * @evidence contracts/testing.md#independent-expectations The dedicated-config contract independently disallows inline plugin keys, so rejection and the named key follow from the contract.
 * @evidence contracts/testing.md#distinguishing-cases Inline calls is the negative entry case; the other scenarios supply valid configuration sources. test_strip_factory_rejects_inline_calls directly owns the TypeScript factory rejection; the Go config_rejects_unsupported_tsconfig_keys unit exercises a separate native validator.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_utilities with the shared workspace; the failure propagates through the built launcher.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor validation must propagate an invalid tsconfig plugin entry to the public launcher failure.
 * @evidence contracts/e2e.md#shared-execution One rejected descriptor evaluation proves launcher propagation in the shared workspace. The case observes status and error text, not the number of native builders or recovery passes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The scenario owns its tsconfig and writes no output; the process is joined before the assertion.
 * @evidence contracts/e2e.md#preserved-coverage Retains the nonzero-status and unsupported-key stderr assertions unchanged.
 */
export function case_strip_rejects_inline_config_keys(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const result = UtilityWorkspace.emit(workspace, "inline-rejected");
  assert.notEqual(
    result.status,
    0,
    "expected non-zero exit for inline config keys",
  );
  assert.match(
    result.stderr,
    /unsupported key.*"calls"|"calls".*unsupported key/,
    `stderr should name the unsupported key: ${result.stderr}`,
  );
}
