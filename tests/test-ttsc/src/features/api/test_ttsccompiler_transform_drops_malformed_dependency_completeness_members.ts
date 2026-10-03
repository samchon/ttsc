import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies native transform decoding drops malformed `dependenciesComplete`
 * members while keeping the well-formed ones, without failing the transform.
 *
 * The field carries the same advisory tolerance as `graph` and `volatile`
 * (samchon/ttsc#720), and dropping is safe in exactly one direction: a file
 * that falls out of the list reverts to the sound host-owned bound, so a
 * garbled declaration costs over-invalidation rather than stale output.
 * Rejecting the whole field on one bad member would be wrong for the same
 * reason one malformed edge does not discard the graph.
 *
 * 1. Serialize the shared malformedAdvisory envelope, whose dependenciesComplete is ["src/main.ts", 42, ""].
 * 2. Decode it with parseNativeTransformOutput, which must not throw.
 * 3. Assert dependenciesComplete is exactly ["src/main.ts"].
 *
 * @evidence contracts/testing.md#behavioral-verification Calls parseNativeTransformOutput with mixed valid and invalid dependenciesComplete members and requires exactly src/main.ts to survive.
 * @evidence contracts/testing.md#independent-expectations An authored wire array containing src/main.ts, numeric42 and an empty string independently defines the one valid nonempty path; its expected list is literal.
 * @evidence contracts/testing.md#distinguishing-cases One positive member survives beside a non-string member (42) and an empty-string member, so the decoder neither rejects the whole field nor keeps invalid entries; the other fields of the same envelope are not asserted here.
 * @evidence contracts/testing.md#execution-ownership A unit test calling parseNativeTransformOutput on a serialized in-memory fixture; no native producer, install or host runs.
 */
export const test_ttsccompiler_transform_drops_malformed_dependency_completeness_members =
  () => {
    const result = parseNativeTransformOutput(
      JSON.stringify(NativeTransformEnvelopeFixture.malformedAdvisory),
      "",
    );

    assert.deepEqual(result.dependenciesComplete, ["src/main.ts"]);
  };
