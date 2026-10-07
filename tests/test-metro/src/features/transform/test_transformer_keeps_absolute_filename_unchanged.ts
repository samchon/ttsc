import { assertKeepsAbsoluteFilenameUnchanged } from "../../internal/metro-transform-decisions";

/**
 * Verifies the transformer keeps an already-absolute filename unchanged.
 *
 * The `path.isAbsolute` short-circuit: when Metro (or a test) supplies an
 * absolute `filename`, it must be used as-is and `projectRoot` ignored, so the
 * resolution is idempotent and never double-joins.
 *
 * 1. Resolve an absolute filename with an unrelated `projectRoot`.
 * 2. Assert the result equals the input absolute path.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveAbsoluteFilename returns an already absolute path exactly even when options.projectRoot names an unrelated directory.
 * @evidence contracts/testing.md#independent-expectations The expected value is the authored absolute path itself (identity), not a joined or normalized path computed from the function.
 * @evidence contracts/testing.md#distinguishing-cases Only the absolute-input branch is run; relative filename rooting and the cwd fallback belong to the neighboring entry.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveAbsoluteFilename from packages/metro/src/transformer.ts directly in-process; no filesystem access, upstream or compile.
 */
export const test_transformer_keeps_absolute_filename_unchanged = async () => {
  await assertKeepsAbsoluteFilenameUnchanged();
};
