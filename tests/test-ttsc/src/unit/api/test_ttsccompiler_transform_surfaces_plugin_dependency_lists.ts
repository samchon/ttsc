import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies TtscCompiler.transform surfaces the plugin-reported dependency
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
  };
