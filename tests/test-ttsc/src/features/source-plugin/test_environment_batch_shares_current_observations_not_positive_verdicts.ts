import assert from "node:assert/strict";

import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";

/**
 * Verifies shared native observations compare each witness independently.
 *
 * A synchronous batch can share lookup work, but different expected states
 * cannot borrow a sibling's positive verdict or retain it after mutation.
 *
 * 1. Capture two conflicting expected ambient values and observe one batch.
 * 2. Require one shared current reading and independent true/false verdicts.
 * 3. Change the ambient value and reverse the verdicts in a fresh batch.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual witness holds shares one current observation entry across two conflicting records and independently accepts A/refuses B; a fresh batch after actual environment mutation refuses A/accepts B, including ordinary nonbatched calls.
 * @evidence contracts/testing.md#independent-expectations Literal A and B observations define equality independently of production signature encoding; one map entry follows one shared lookup address.
 * @evidence contracts/testing.md#distinguishing-cases Equal and conflicting expectations in one transaction contrast with a changed current value in another transaction and calls without shared observations.
 * @evidence contracts/testing.md#execution-ownership Direct discovered unit invokes the real witness operations with one temporary process variable restored in finally. No fs/process method is replaced and no worker or native tool starts.
 */
export function test_environment_batch_shares_current_observations_not_positive_verdicts(): void {
  const name = "TTSC_TEST_BATCH_AUTHORITY";
  const previous = process.env[name];
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  PluginBuildEnvironmentWitness.addEnvironment(a, name, "A");
  PluginBuildEnvironmentWitness.addEnvironment(b, name, "B");
  try {
    process.env[name] = "A";
    const first = new Map<string, string>();
    assert.equal(
      PluginBuildEnvironmentWitness.holds(a, undefined, first),
      true,
    );
    assert.equal(
      PluginBuildEnvironmentWitness.holds(b, undefined, first),
      false,
    );
    assert.equal(first.size, 1);
    process.env[name] = "B";
    const second = new Map<string, string>();
    assert.equal(
      PluginBuildEnvironmentWitness.holds(a, undefined, second),
      false,
    );
    assert.equal(
      PluginBuildEnvironmentWitness.holds(b, undefined, second),
      true,
    );
    assert.equal(second.size, 1);
    assert.equal(PluginBuildEnvironmentWitness.holds(a), false);
    assert.equal(PluginBuildEnvironmentWitness.holds(b), true);
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}
