import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies TtscCompiler.transform surfaces the envelope's
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
