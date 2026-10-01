import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies native transform decoding rejects plugin output that is not TypeScript
 * source.
 *
 * A `transformSource` hook that returns non-string values (e.g. numbers or
 * objects) for file content would silently corrupt the source map. Pins the
 * guard that detects when any value in the returned map is not a plain string
 * and throws a descriptive exception rather than forwarding garbage to the
 * compiler pipeline.
 *
 * 1. Decode the missingSource fixture, which has only an output map, and require the 'did not return a TypeScript source map' error.
 * 2. Decode envelopes whose src/main.ts value is 42, null, {}, [] or true and require the same error each time.
 * 3. Decode an envelope whose src/main.ts source is the empty string and assert it is returned as an empty string.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises parseNativeTransformOutput with the original missing typescript envelope plus numeric, null, object, array and boolean source members; every malformed output rejects while empty string source is preserved.
 * @evidence contracts/testing.md#independent-expectations Required file content is a string by the native output contract, including the empty string. Independently authored non-string values and an output-only envelope define rejected results without deriving them from validation code.
 * @evidence contracts/testing.md#distinguishing-cases Preserves missing-source rejection and covers five non-string value kinds against an empty-string positive control; source container arrays have a separate owning case. No malformed member is silently replaced with empty output.
 * @evidence contracts/testing.md#execution-ownership A unit test calling parseNativeTransformOutput with in-memory envelopes and checking the thrown message; it emits and publishes no files and runs no process.
 */
export const test_ttsccompiler_transform_rejects_plugin_output_that_is_not_typescript_source =
  () => {
    assert.throws(
      () => parseNativeTransformOutput(JSON.stringify(NativeTransformEnvelopeFixture.missingSource), ""),
      /did not return a TypeScript source map/,
    );
    for (const value of [42, null, {}, [], true]) {
      assert.throws(
        () => parseNativeTransformOutput(JSON.stringify({ typescript: { "src/main.ts": value } }), ""),
        /did not return a TypeScript source map/,
      );
    }
    assert.deepEqual(
      parseNativeTransformOutput(JSON.stringify({ typescript: { "src/main.ts": "" } }), "").typescript,
      { "src/main.ts": "" },
      "empty source text is valid and must not be mistaken for missing source",
    );
  };
