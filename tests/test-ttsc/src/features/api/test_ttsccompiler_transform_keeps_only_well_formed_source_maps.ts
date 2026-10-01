import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies native transform decoding forwards the envelope's `sourceMaps` entries
 * that are well-formed maps of transformed files, and drops the rest
 * (samchon/ttsc#1392).
 *
 * A consumer hands a map to a bundler, which trusts it to describe the text it
 * holds. A malformed map, or one for a file the envelope has no text for,
 * cannot describe any output and must not reach a consumer. Dropping it
 * degrades that file to having no map, exactly as a host that writes none.
 *
 * 1. Decode the original native wire input directly through the production decoder.
 * 2. Assert the retained fields or exact rejection below.
 * 3. The real Go transport batch retains API result and no-publication boundaries.
 *
 * @evidence contracts/testing.md#behavioral-verification Invokes parseNativeTransformOutput and checks the exact version3 source map for src/main.ts while invalid-version and unreturned-file maps disappear.
 * @evidence contracts/testing.md#independent-expectations A literal version3 map with mappingsAAAA, original source content and names[] defines the retained result; version2 and a key absent from returned TypeScript text violate the independent wire contract.
 * @evidence contracts/testing.md#distinguishing-cases Valid mapping survives beside a version2 map for another returned file and a version3 map for an unreturned file. This case owns these version/output-membership differences, rather than every map schema permutation.
 * @evidence contracts/testing.md#execution-ownership The named unit decodes immutable JSON and compares the complete returned map in process. No compiler output or producer artifact is built; the shared native envelope batch owns transfer into the public API.
 */
export const test_ttsccompiler_transform_keeps_only_well_formed_source_maps =
  () => {
    const result = parseNativeTransformOutput(
      JSON.stringify(NativeTransformEnvelopeFixture.malformedAdvisory),
      "",
    );

    assert.deepEqual(result.sourceMaps, {
      "src/main.ts": {
        file: "main.ts",
        mappings: "AAAA",
        names: [],
        sources: ["main.ts"],
        sourcesContent: ["export const value = 1\n"],
        version: 3,
      },
    });
  };
