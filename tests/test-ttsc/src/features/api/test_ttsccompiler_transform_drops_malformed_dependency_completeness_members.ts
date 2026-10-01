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
 * 1. Decode the original native wire input directly through the production decoder.
 * 2. Assert the retained fields or exact rejection below.
 * 3. The real Go transport batch retains API result and no-publication boundaries.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls parseNativeTransformOutput with mixed valid and invalid dependenciesComplete members and requires exactly src/main.ts to survive.
 * @evidence contracts/testing.md#independent-expectations An authored wire array containing src/main.ts, numeric42 and an empty string independently defines the one valid nonempty path; its expected list is literal.
 * @evidence contracts/testing.md#distinguishing-cases A valid declaration survives next to numeric and empty members rather than rejecting the whole envelope or preserving invalid entries. The valid-completeness case owns the companion dependency record.
 * @evidence contracts/testing.md#execution-ownership This named src/features/api entry directly invokes the source decoder over a shared immutable JSON fixture; no native producer, install or host is run. Real envelope transport remains separately batched.
 */
export const test_ttsccompiler_transform_drops_malformed_dependency_completeness_members =
  () => {
    const result = parseNativeTransformOutput(
      JSON.stringify(NativeTransformEnvelopeFixture.malformedAdvisory),
      "",
    );

    assert.deepEqual(result.dependenciesComplete, ["src/main.ts"]);
  };
