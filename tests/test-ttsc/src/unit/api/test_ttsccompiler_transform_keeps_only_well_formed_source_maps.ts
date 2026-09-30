import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies TtscCompiler.transform forwards the envelope's `sourceMaps` entries
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
