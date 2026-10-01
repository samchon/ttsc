import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies native transform decoding rejects array-shaped TypeScript source maps.
 *
 * The `transformSource` hook contract requires each plugin to return a
 * `Record<string, string>` keyed by file path. A plugin that returns an array
 * instead bypasses the object check and would silently produce a corrupt source
 * map. Pins the validation that detects and rejects the wrong shape with a
 * clear error rather than writing undefined into the output.
 *
 * 1. Decode an envelope whose typescript is a non-empty array and require the 'did not return a TypeScript source map' error.
 * 2. Decode {typescript: []} and require the same error.
 * 3. Decode {typescript: {}} and assert the zero-file record is returned unchanged.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls parseNativeTransformOutput with nonempty and empty array-shaped required source fields, requires rejection, and accepts the adjacent empty-object record.
 * @evidence contracts/testing.md#independent-expectations The native transform contract requires an object mapping filenames to string source text; array indices cannot substitute for that record. Literal empty-object acceptance is independent of decoder internals.
 * @evidence contracts/testing.md#distinguishing-cases Original nonempty-array rejection is preserved and an empty-array boundary rejects despite vacuous element validation. Empty object is a successful zero-file control, preventing blanket rejection from passing.
 * @evidence contracts/testing.md#execution-ownership A unit test calling parseNativeTransformOutput with JSON strings; no consumer install, native producer or host runs. Non-string member values are covered by the sibling test_ttsccompiler_transform_rejects_plugin_output_that_is_not_typescript_source.
 */
export const test_ttsccompiler_transform_rejects_array_typescript_source_map =
  () => {
    assert.throws(
      () => parseNativeTransformOutput(JSON.stringify(NativeTransformEnvelopeFixture.arraySource), ""),
      /did not return a TypeScript source map/,
    );
    assert.throws(
      () => parseNativeTransformOutput(JSON.stringify({ typescript: [] }), ""),
      /did not return a TypeScript source map/,
      "even an empty array is not a file-to-source record",
    );
    assert.deepEqual(
      parseNativeTransformOutput(JSON.stringify({ typescript: {} }), "").typescript,
      {},
      "an empty object is the valid zero-file source record",
    );
  };
