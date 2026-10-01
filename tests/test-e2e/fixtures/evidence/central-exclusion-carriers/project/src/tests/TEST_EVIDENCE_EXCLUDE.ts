import type { IContract, publicOperation } from "../contracts.js";

/**
 * Central backend-test exclusions.
 *
 * @evidenceExclude docs/test.md#scenario This fixture intentionally runs no scenario.
 * @evidenceExclude {@link publicOperation} This fixture intentionally calls no operation.
 * @evidenceExclude {@link IContract} This fixture intentionally validates no response type.
 */
export const TEST_EVIDENCE_EXCLUDE = true;
export function selectedTest(): void {}
