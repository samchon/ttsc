import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies native transform decoding surfaces the envelope's
 * `dependenciesComplete` declaration alongside the dependency list it
 * qualifies.
 *
 * Implements the consumer half of samchon/ttsc#720: the declaration is what
 * lets a bundler adapter narrow a file's invalidation to the plugin's own
 * reported inputs instead of the host-owned reference bound. A host that
 * dropped the field would silently keep every adopting plugin on the coarse
 * baseline, with no error to point at.
 *
 * 1. Decode the original native wire input directly through the production decoder.
 * 2. Assert the retained fields or exact rejection below.
 * 3. The real Go transport batch retains API result and no-publication boundaries.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls parseNativeTransformOutput and checks both the dependency record and the dependenciesComplete list for the same transformed source.
 * @evidence contracts/testing.md#independent-expectations Independently authored src/main.ts dependency and completeness declarations establish literal expected values. Merely retaining one field cannot satisfy both assertions.
 * @evidence contracts/testing.md#distinguishing-cases This positive case distinguishes dropping completeness from retaining ordinary dependencies. Mixed malformed completeness members are owned by the dedicated negative-filtering case; host admission is not inferred from decoder success.
 * @evidence contracts/testing.md#execution-ownership The exported src/features/api entry decodes immutable native envelope bytes once without starting a compiler, install or native producer. Public API transport is preserved by the separate shared Go envelope experiment.
 */
export const test_ttsccompiler_transform_surfaces_the_dependency_completeness_declaration =
  () => {
    const result = parseNativeTransformOutput(
      JSON.stringify(NativeTransformEnvelopeFixture.valid),
      "",
    );

    assert.deepEqual(result.dependencies, {
      "src/main.ts": ["src/consulted.d.ts"],
    });
    assert.deepEqual(result.dependenciesComplete, ["src/main.ts"]);
  };
