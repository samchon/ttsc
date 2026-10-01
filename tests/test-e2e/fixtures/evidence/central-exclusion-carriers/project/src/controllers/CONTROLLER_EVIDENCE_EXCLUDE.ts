/**
 * Central controller exclusions.
 *
 * @evidenceExclude docs/controller.md#operation This fixture intentionally exposes no operation.
 * @evidenceExclude prisma:Sale This fixture intentionally exposes no sale operation.
 */
export const CONTROLLER_EVIDENCE_EXCLUDE = true;
export function selectedController(): void {}
