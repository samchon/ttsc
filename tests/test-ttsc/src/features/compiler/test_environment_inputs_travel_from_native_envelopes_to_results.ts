import assert from "node:assert/strict";
import fs from "node:fs";

import { appendBuildOutput } from "../../../../../packages/ttsc/src/compiler/internal/build/appendBuildOutput";
import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import { runNativeCheckWithObservations } from "../../../../../packages/ttsc/src/compiler/internal/runNativeCheckWithObservations";
import { toCompilerTransformation } from "../../../../../packages/ttsc/src/internal/CompilerResultAdapter";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies recorded plugin environment reads travel from both native wire
 * formats into public results, survive phase merging, and fail closed when
 * malformed.
 *
 * A plugin that reads `NODE_ENV` through `ctx.Env` makes it an input of the
 * whole generation. Losing the record anywhere between the native envelope and
 * the consumer would let a cache reuse output compiled under another value, so
 * every carrier must keep it and a malformed record must fail rather than drop
 * an entry.
 *
 * 1. Decode a transform envelope and an emit-observation sidecar that carry a set
 *    and an unset read, and adapt the decoded transform result.
 * 2. Merge two build phases with disjoint, equal and conflicting reads.
 * 3. Decode envelopes without the field and with malformed records.
 *
 * @evidence contracts/testing.md#behavioral-verification parseNativeTransformOutput, the emit-observation path of runNativeCheckWithObservations, toCompilerTransformation and appendBuildOutput are called directly; the record must arrive intact, merge as a union, mark a conflict incomplete, stay absent when absent, and throw on malformed input.
 * @evidence contracts/testing.md#independent-expectations Expected records are the literal wire values; the conflict expectation is the documented `observationsComplete: false` refusal; malformed cases expect a thrown Error because dropping an entry would hide an input.
 * @evidence contracts/testing.md#distinguishing-cases Set value against null absence, field present against absent, disjoint against equal against conflicting phase values, and three malformed shapes (array, non-string value, empty name). Reuse decisions belong to test_runtimeinputproof_replays_content_absence_and_membership and the unplugin delivery tests.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered by the test-ttsc runner; the sidecar is written by the test's own run callback into the private path the production code negotiates, and no native producer, install or host runs.
 */
export function test_environment_inputs_travel_from_native_envelopes_to_results(): void {
  const recorded = {
    TTSC_TEST_TRACKED_ENV_MODE: "test",
    TTSC_TEST_TRACKED_ENV_UNSET: null,
  };
  const envelope = {
    environmentInputs: recorded,
    typescript: { "src/main.ts": "export const value = 1;\n" },
  };

  // 1. Both wire formats and the public adapter keep the record.
  const decoded = parseNativeTransformOutput(JSON.stringify(envelope), "");
  assert.deepEqual(decoded.environmentInputs, recorded);
  const adapted = toCompilerTransformation({
    ...decoded,
    result: { diagnostics: [], status: 0, stdout: "", stderr: "" },
  });
  assert.equal(adapted.type, "success");
  if (adapted.type !== "success") throw new Error("unexpected adaptation");
  assert.deepEqual(adapted.environmentInputs, recorded);
  const observed = runNativeCheckWithObservations(
    { capabilities: { emitObservations: true } },
    (extra) => {
      const file = extra[0]!.slice("--emit-observations-json=".length);
      fs.writeFileSync(
        file,
        JSON.stringify({
          environmentInputs: recorded,
          graph: {
            configs: [],
            edges: { "src/main.ts": [] },
            globals: [],
            inputHashes: { "src/main.ts": "a".repeat(64) },
          },
          hostInputHashes: {},
          hostInputRealpaths: {},
          hostInputs: [],
        }),
      );
      return {
        diagnostics: [],
        processCompletedNormally: true,
        status: 0,
        stdout: "",
        stderr: "",
      };
    },
    "build",
  );
  assert.deepEqual(observed.environmentInputs, recorded);
  assert.equal(observed.observationsComplete, undefined);

  // 2. Phases union their reads; one name read under two values withdraws reuse.
  const phase = (
    environmentInputs?: Record<string, string | null>,
  ): TtscBuildResult => ({
    diagnostics: [],
    ...(environmentInputs === undefined ? {} : { environmentInputs }),
    status: 0,
    stdout: "",
    stderr: "",
  });
  const union = appendBuildOutput(
    phase({ TTSC_TEST_TRACKED_ENV_MODE: "test" }),
    phase({
      TTSC_TEST_TRACKED_ENV_MODE: "test",
      TTSC_TEST_TRACKED_ENV_UNSET: null,
    }),
  );
  assert.deepEqual(union.environmentInputs, recorded);
  assert.equal(union.observationsComplete, undefined);
  const conflicting = appendBuildOutput(
    phase({ TTSC_TEST_TRACKED_ENV_MODE: "test" }),
    phase({ TTSC_TEST_TRACKED_ENV_MODE: "production" }),
  );
  assert.equal(conflicting.observationsComplete, false);
  assert.equal(
    Object.hasOwn(appendBuildOutput(phase(), phase()), "environmentInputs"),
    false,
    "phases that read nothing add no field",
  );

  // 3. Absence stays absent; malformed records fail instead of losing a read.
  const absent = parseNativeTransformOutput(
    JSON.stringify({ typescript: envelope.typescript }),
    "",
  );
  assert.equal(Object.hasOwn(absent, "environmentInputs"), false);
  for (const malformed of [
    ["TTSC_TEST_TRACKED_ENV_MODE"],
    { TTSC_TEST_TRACKED_ENV_MODE: 1 },
    { "": "test" },
  ])
    assert.throws(
      () =>
        parseNativeTransformOutput(
          JSON.stringify({ ...envelope, environmentInputs: malformed }),
          "",
        ),
      /invalid native environment input/,
      JSON.stringify(malformed),
    );
}
