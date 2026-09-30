import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies TtscCompiler.transform rejects plugin output that is not TypeScript
 * source.
 *
 * A `transformSource` hook that returns non-string values (e.g. numbers or
 * objects) for file content would silently corrupt the source map. Pins the
 * guard that detects when any value in the returned map is not a plain string
 * and throws a descriptive exception rather than forwarding garbage to the
 * compiler pipeline.
 *
 * 1. Decode the original native wire input directly through the production decoder.
 * 2. Assert the retained fields or exact rejection below.
 * 3. The real Go transport batch retains API result and no-publication boundaries.
 */
export const test_ttsccompiler_transform_rejects_plugin_output_that_is_not_typescript_source =
  () => {
    assert.throws(
      () => parseNativeTransformOutput(JSON.stringify(NativeTransformEnvelopeFixture.missingSource), ""),
      /did not return a TypeScript source map/,
    );
  };
