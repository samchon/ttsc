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
 * @evidence contracts/testing.md#behavioral-verification An absolute filename remains exact despite a conflicting projectRoot.
 * @evidence contracts/testing.md#independent-expectations The Metro filename contract preserves an already absolute path; the authored path is the independent literal identity.
 * @evidence contracts/testing.md#distinguishing-cases Absolute input contrasts relative rooting in the neighboring source entry.
 * @evidence contracts/testing.md#execution-ownership This named src/features export executes authored Metro decisions in the source-unit Node process; fixture callbacks supply resolver results and no compiled package, native build, install or host starts.
 */
export const test_transformer_keeps_absolute_filename_unchanged = async () => {
  await assertKeepsAbsoluteFilenameUnchanged();
};
