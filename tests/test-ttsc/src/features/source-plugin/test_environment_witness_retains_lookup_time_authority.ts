import assert from "node:assert/strict";

import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";

/**
 * Verifies ambient lookup observations cannot be overwritten by restoration.
 *
 * A final environment snapshot alone cannot qualify a shared worker's lookup
 * during an A-to-B-to-A interval. The observed value belongs to the reading.
 *
 * 1. Record actual lookup-time values and compare current environment authority.
 * 2. Restore the first value and retain conflicting repeated observations.
 * 3. Check missing, stable and unwitnessed controls, restoring the parent state.
 *
 * @evidence contracts/testing.md#behavioral-verification addEnvironment and holds preserve the observed B value across restoration to A and permanently refuse conflicting repeated observations.
 * @evidence contracts/testing.md#independent-expectations Authored literal A/B/undefined observations define equality and refusal; expectations are not calculated from witness internals.
 * @evidence contracts/testing.md#distinguishing-cases Stable, missing, restored, conflicting and absent-witness inputs separate successful reuse from inadmissible lookup authority.
 * @evidence contracts/testing.md#execution-ownership A unit test calling PluginBuildEnvironmentWitness.addEnvironment and holds directly while temporarily setting one process.env variable (restored in finally); no worker, Go child or native plugin is used and a real shared-worker interleaving is not exercised.
 */
export function test_environment_witness_retains_lookup_time_authority(): void {
  const name = "TTSC_TEST_LOOKUP_AUTHORITY";
  const previous = process.env[name];
  try {
    process.env[name] = "A";
    const stable = new Map<string, string>();
    PluginBuildEnvironmentWitness.addEnvironment(stable, name, "A");
    assert.equal(PluginBuildEnvironmentWitness.holds(stable), true);
    process.env[name] = "B";
    const transient = new Map<string, string>();
    PluginBuildEnvironmentWitness.addEnvironment(transient, name, "B");
    assert.equal(PluginBuildEnvironmentWitness.holds(transient), true);
    process.env[name] = "A";
    assert.equal(PluginBuildEnvironmentWitness.holds(transient), false);
    PluginBuildEnvironmentWitness.addEnvironment(stable, name, "B");
    PluginBuildEnvironmentWitness.addEnvironment(stable, name, "A");
    assert.equal(PluginBuildEnvironmentWitness.holds(stable), false);
    delete process.env[name];
    const missing = new Map<string, string>();
    PluginBuildEnvironmentWitness.addEnvironment(missing, name, undefined);
    assert.equal(PluginBuildEnvironmentWitness.holds(missing), true);
    process.env[name] = "";
    assert.equal(PluginBuildEnvironmentWitness.holds(missing), false);
    PluginBuildEnvironmentWitness.addEnvironment(undefined, name, "A");
    assert.equal(PluginBuildEnvironmentWitness.holds(new Map()), true);
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}
