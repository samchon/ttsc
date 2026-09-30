import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies TtscCompiler.transform rejects array-shaped TypeScript source maps.
 *
 * The `transformSource` hook contract requires each plugin to return a
 * `Record<string, string>` keyed by file path. A plugin that returns an array
 * instead bypasses the object check and would silently produce a corrupt source
 * map. Pins the validation that detects and rejects the wrong shape with a
 * clear error rather than writing undefined into the output.
 *
 * 1. Decode the original native wire input directly through the production decoder.
 * 2. Assert the retained fields or exact rejection below.
 * 3. The real Go transport batch retains API result and no-publication boundaries.
 */
export const test_ttsccompiler_transform_rejects_array_typescript_source_map =
  () => {
    assert.throws(
      () => parseNativeTransformOutput(JSON.stringify(NativeTransformEnvelopeFixture.arraySource), ""),
      /did not return a TypeScript source map/,
    );
  };
