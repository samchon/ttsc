import { assertGatesByIncludeAndExclude } from "../../internal/metro-transform-decisions";

/**
 * Verifies the transformer gates files by include and exclude.
 *
 * Pins the full gating matrix: empty include means all TypeScript; a matching
 * include selects and a non-matching include rejects; exclude rejects and must
 * win over a matching include (it is checked first).
 *
 * 1. Assert empty include selects a TypeScript file.
 * 2. Assert include match selects and non-match rejects.
 * 3. Assert exclude rejects, and wins when a file matches both include and
 *    exclude.
 *
 * @evidence contracts/testing.md#behavioral-verification shouldTransform on /p/src/keep/a.ts returns true with empty filters and with include ["keep"], false with exclude ["keep"] and false with both; on /p/src/other/a.ts with include ["keep"] it returns false.
 * @evidence contracts/testing.md#independent-expectations The documented substring semantics (empty include admits all, exclude wins) determine the five literal booleans, which are not derived from the predicate.
 * @evidence contracts/testing.md#distinguishing-cases Empty filters, include match, include non-match, exclude match and simultaneous include-and-exclude match are five separately labeled asserts.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls shouldTransform from packages/metro/src/transformer.ts directly in-process with plain option objects; it neither resolves an upstream nor starts a compile.
 */
export const test_transformer_gates_files_by_include_and_exclude = async () => {
  await assertGatesByIncludeAndExclude();
};
