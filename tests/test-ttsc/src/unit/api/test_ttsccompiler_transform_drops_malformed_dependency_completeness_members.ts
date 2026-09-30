import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies TtscCompiler.transform drops malformed `dependenciesComplete`
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
 */
export const test_ttsccompiler_transform_drops_malformed_dependency_completeness_members =
  () => {
    const result = parseNativeTransformOutput(
      JSON.stringify(NativeTransformEnvelopeFixture.malformedAdvisory),
      "",
    );

    assert.deepEqual(result.dependenciesComplete, ["src/main.ts"]);
  };
