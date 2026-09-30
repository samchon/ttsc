import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies native transform decoding surfaces the plugin-reported dependency
 * lists.
 *
 * Implements the protocol slot from samchon/ttsc#214: a transform native source
 * may report, per transformed file, the source files it consulted
 * (`dependencies` in the stdout envelope), and the programmatic API must pass
 * the record through verbatim so bundler adapters can register watch files for
 * type-only inputs. If the host dropped the field, HMR invalidation for
 * generated code could never work regardless of what plugins report.
 *
 * 1. Decode the original native wire input directly through the production decoder.
 * 2. Assert the retained fields or exact rejection below.
 * 3. The real Go transport batch retains API result and no-publication boundaries.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls parseNativeTransformOutput with the valid native fixture and requires the exact importer-to-consulted-input dependency record.
 * @evidence contracts/testing.md#independent-expectations The fixture explicitly reports src/main.ts consulting src/consulted.d.ts; the independent literal object establishes importer and input identity without computing graph expansion.
 * @evidence contracts/testing.md#distinguishing-cases The valid dependency record contrasts with null, array, scalar and all-invalid list fields that must disappear without rejecting source text. Declaration completeness and actual transport remain separately owned.
 * @evidence contracts/testing.md#execution-ownership The exported unit directly invokes the source decoder once using immutable fixture bytes. It creates no watch registration or compiler host; downstream registration and producer transport belong to surviving shared E2E coverage.
 */
export const test_ttsccompiler_transform_surfaces_plugin_dependency_lists =
  () => {
    const result = parseNativeTransformOutput(
      JSON.stringify(NativeTransformEnvelopeFixture.valid),
      "",
    );

    assert.deepEqual(result.dependencies, {
      "src/main.ts": ["src/consulted.d.ts"],
    });
    for (const dependencies of [null, [], 42, "invalid", { "src/main.ts": [42, null] }]) {
      const decoded = parseNativeTransformOutput(JSON.stringify({ typescript: {}, dependencies }), "");
      assert.equal(decoded.dependencies, undefined);
      assert.deepEqual(decoded.typescript, {}, "malformed advisory data must not reject valid source output");
    }
  };
