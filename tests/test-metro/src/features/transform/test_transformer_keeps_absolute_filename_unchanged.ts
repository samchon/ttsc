import { assertKeepsAbsoluteFilenameUnchanged } from "../../internal/metro-transform";

/**
 * Verifies the transformer keeps an already-absolute filename unchanged.
 *
 * The `path.isAbsolute` short-circuit: when Metro (or a test) supplies an
 * absolute `filename`, it must be used as-is and `projectRoot` ignored, so the
 * resolution is idempotent and never double-joins.
 *
 * 1. Resolve an absolute filename with an unrelated `projectRoot`.
 * 2. Assert the result equals the input absolute path.
 */
export const test_transformer_keeps_absolute_filename_unchanged = async () => {
  await assertKeepsAbsoluteFilenameUnchanged();
};
