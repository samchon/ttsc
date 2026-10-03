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
 * 1. Decode the valid fixture envelope and assert dependencies equals { "src/main.ts": ["src/consulted.d.ts"] }.
 * 2. Decode envelopes whose dependencies field is null, [], 42, "invalid" or { "src/main.ts": [42, null] }, each with an empty typescript record.
 * 3. Assert every malformed field decodes to undefined dependencies without rejecting the (empty) source output.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls parseNativeTransformOutput with the valid native fixture and requires the exact importer-to-consulted-input dependency record.
 * @evidence contracts/testing.md#independent-expectations The fixture explicitly reports src/main.ts consulting src/consulted.d.ts; the independent literal object establishes importer and input identity without computing graph expansion.
 * @evidence contracts/testing.md#distinguishing-cases One valid per-file dependency record survives verbatim, contrasted with five malformed dependency fields (null, empty array, number, string, and a record whose only list holds no strings) that all decode to undefined while the source record is still returned.
 * @evidence contracts/testing.md#execution-ownership A unit test calling parseNativeTransformOutput on in-memory JSON; it registers no watch files and starts no compiler host or native producer.
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
