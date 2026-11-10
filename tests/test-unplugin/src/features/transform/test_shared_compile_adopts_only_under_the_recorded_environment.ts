import assert from "node:assert/strict";
import path from "node:path";

import type { TtscSharedCompilePublication } from "../../../../../packages/unplugin/src/core/transform/session/TtscSharedCompilePublication";
import { claimSharedCompile } from "../../../../../packages/unplugin/src/core/transform/session/claimSharedCompile";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { TestProject } from "../../../../utils/src/TestProject";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies a shared-store publication whose plugins read an environment
 * variable is adopted only by a worker whose compiler environment still has the
 * recorded value.
 *
 * The store names a compile by configuration and project state, and neither key
 * can name the variables a plugin reads: only the compile discovers them. A
 * worker started under another `NODE_ENV`-like value must compile itself
 * instead of adopting output lowered for the publisher's value.
 *
 * 1. Publish a compile whose envelope recorded the variable as `production`.
 * 2. Claim it under `test` and assert the worker gets the lock to compile.
 * 3. Claim it under `production` and assert it adopts the publication.
 * 4. Publish a compile that read nothing and assert any environment adopts it.
 * 5. Admit the adopted envelope as a generation, the proof capture applies to
 *    every adoption, under both values and assert only the recorded one
 *    passes.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual store claims, lock ownership and JSON publications decide adopt versus compile; a mismatched value must yield a compile claim and the recorded value an adoption of the exact publication. captureUniversalHostInputValidation must refuse the same envelope with an environment-changed failure naming the variable under the other value.
 * @evidence contracts/testing.md#independent-expectations The recorded value and both adopter environments are literals; the expected outcomes follow the contract that recorded reads must equal the adopter's environment, and the failure kind is the documented `environment-changed`.
 * @evidence contracts/testing.md#distinguishing-cases Changed value against equal value on one state key, a recorded absence (null) that must stay unset, a publication with no recorded reads that stays adoptable under a changed environment, and capture admission under each value. Refuted-payload exclusion belongs to test_shared_compile_refutation_excludes_only_the_read_payload.
 * @evidence contracts/testing.md#execution-ownership Direct unit test of claimSharedCompile over a temporary store and of captureUniversalHostInputValidation over a handwritten generation, without installation, child process or native compiler.
 */
export async function test_shared_compile_adopts_only_under_the_recorded_environment(): Promise<void> {
  const store = TestProject.tmpdir("ttsc-environment-publication-");
  const identity = "e".repeat(32);
  const typescript = { "src/main.ts": "export const value = 1;\n" };
  const lowered: TtscSharedCompilePublication = {
    externalInputHashes: {},
    externalInputRealpaths: {},
    result: {
      type: "success",
      typescript,
      environmentInputs: {
        TTSC_TEST_LOWERING_MODE: "production",
        TTSC_TEST_LOWERING_UNSET: null,
      },
    },
    scratchDirectory: path.join(store, "lowered-scratch"),
  };
  const publish = async (
    state: string,
    publication: TtscSharedCompilePublication,
  ): Promise<void> => {
    const claim = await claimSharedCompile(store, identity, state, {
      adopt: false,
    });
    assert.ok(claim?.kind === "compile");
    try {
      await claim.publish(publication);
    } finally {
      claim.release();
    }
  };

  // 1-2. Another value, or a recorded absence that is now set, compiles.
  const state = "f".repeat(32);
  await publish(state, lowered);
  for (const environment of [
    { TTSC_TEST_LOWERING_MODE: "test" },
    {},
    {
      TTSC_TEST_LOWERING_MODE: "production",
      TTSC_TEST_LOWERING_UNSET: "set",
    },
  ]) {
    const refused = await claimSharedCompile(store, identity, state, {
      adopt: true,
      environment,
    });
    assert.ok(
      refused?.kind === "compile",
      `${JSON.stringify(environment)} must not adopt output lowered for production`,
    );
    refused.release();
  }

  // 3. The recorded value adopts the exact publication.
  const adopted = await claimSharedCompile(store, identity, state, {
    adopt: true,
    environment: { TTSC_TEST_LOWERING_MODE: "production", OTHER: "any" },
  });
  assert.ok(adopted?.kind === "adopt");
  assert.deepEqual(adopted.publication, lowered);

  // 4. A compile that read no variable is adoptable under any environment.
  const plainState = "0".repeat(32);
  const plain: TtscSharedCompilePublication = {
    ...lowered,
    result: { type: "success", typescript },
  };
  await publish(plainState, plain);
  const unrelated = await claimSharedCompile(store, identity, plainState, {
    adopt: true,
    environment: { TTSC_TEST_LOWERING_MODE: "test" },
  });
  assert.ok(unrelated?.kind === "adopt");
  assert.deepEqual(unrelated.publication, plain);

  // 5. Capture admission refuses the adopted envelope under the other value.
  const fixture = createCachedDeliveryUnitFixture();
  try {
    const cached = { ...fixture.good, result: lowered.result };
    const refused = captureUniversalHostInputValidation(cached, fixture.file, {
      TTSC_TEST_LOWERING_MODE: "test",
    });
    assert.equal(refused.validation, undefined);
    assert.deepEqual(
      refused.failures.entries.map(({ kind, detail }) => ({ kind, detail })),
      [{ kind: "environment-changed", detail: "TTSC_TEST_LOWERING_MODE" }],
    );
    const admitted = captureUniversalHostInputValidation(
      { ...fixture.good, result: lowered.result },
      fixture.file,
      { TTSC_TEST_LOWERING_MODE: "production" },
    );
    assert.deepEqual(admitted.failures.entries, []);
    assert.ok(admitted.validation !== undefined);
  } finally {
    fixture.dispose();
  }
}
