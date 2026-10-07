import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies native transform decoding forwards the envelope's `sourceMaps`
 * entries that are well-formed maps of transformed files, and drops the rest
 * (samchon/ttsc#1392).
 *
 * A consumer hands a map to a bundler, which trusts it to describe the text it
 * holds. A malformed map, or one for a file the envelope has no text for,
 * cannot describe any output and must not reach a consumer. Dropping it
 * degrades that file to having no map, exactly as a host that writes none.
 *
 * 1. Serialize the shared malformedAdvisory envelope, whose sourceMaps hold a
 *    valid version 3 map for src/main.ts, a version 2 map for the returned
 *    src/extra.ts and a version 3 map for src/elsewhere.ts, which has no
 *    returned text.
 * 2. Decode it with parseNativeTransformOutput.
 * 3. Assert sourceMaps deep-equals only the src/main.ts map.
 *
 * @evidence contracts/testing.md#behavioral-verification Invokes parseNativeTransformOutput and checks the exact version3 source map for src/main.ts while invalid-version and unreturned-file maps disappear.
 * @evidence contracts/testing.md#independent-expectations A literal version3 map with mappingsAAAA, original source content and names[] defines the retained result; version2 and a key absent from returned TypeScript text violate the independent wire contract.
 * @evidence contracts/testing.md#distinguishing-cases Valid mapping survives beside a version2 map for another returned file and a version3 map for an unreturned file. This case owns these version/output-membership differences, rather than every map schema permutation.
 * @evidence contracts/testing.md#execution-ownership A unit test calling parseNativeTransformOutput on in-memory JSON and comparing the retained map; no compiler output, native producer or public API call is involved.
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
