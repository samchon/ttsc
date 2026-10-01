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
 * @evidence contracts/testing.md#behavioral-verification shouldTransform accepts empty filters and matching include, rejects nonmatching include and matching exclude, and gives exclude precedence over include.
 * @evidence contracts/testing.md#independent-expectations Documented substring filter semantics independently determine all five literal booleans.
 * @evidence contracts/testing.md#distinguishing-cases Empty, positive include, negative include, negative exclude and simultaneous matching filters exercise each gate decision.
 * @evidence contracts/testing.md#execution-ownership This named src/features export executes authored Metro decisions in the source-unit Node process; fixture callbacks supply resolver results and no compiled package, native build, install or host starts.
 */
export const test_transformer_gates_files_by_include_and_exclude = async () => {
  await assertGatesByIncludeAndExclude();
};
