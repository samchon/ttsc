import { assertOptionsCarryOnlyANonEmptyPrivateRunIdentity } from "../../internal/metro-options";

/**
 * Verifies the private snapshot run identity travels through the worker env
 * payload only as a non-empty string and is never taken from the user's own
 * options.
 *
 * Workers trust this identity to find the baseline the main process keyed, so a
 * wrong-typed or empty value read as an identity would let a worker record
 * against no baseline, and a user option named like it must not impersonate the
 * identity `withTtsc` mints.
 *
 * 1. Serialize options with an identity and assert the payload, the unmutated
 *    options and the untouched environment.
 * 2. Resolve the payload, and one whose option carries a different identity, and
 *    assert the supplied identity is read back.
 * 3. Resolve empty, numeric, null and absent identities and assert none is
 *    reported.
 *
 * @evidence contracts/testing.md#behavioral-verification serializeOptions writes __snapshotRunId beside the options and overrides a same-named user key, resolveOptionsFromEnv reads back only a non-empty string as snapshotRunId and omits the key for an empty, numeric, null or absent value, and serialization leaves both the options object and TTSC_METRO_OPTIONS unchanged.
 * @evidence contracts/testing.md#independent-expectations The expected payload object and identities are authored literals ("run-1", "private") derived from the documented transport rule, not produced by the resolver, and the absence of the snapshotRunId key is asserted with the in operator.
 * @evidence contracts/testing.md#distinguishing-cases Positive: a supplied identity and an override of a user-written one. Negative: empty string, number, null and no identity. Boundary: the empty string is the only string that must be refused.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls serializeOptions and resolveOptionsFromEnv from packages/metro/src/core/options.ts in-process with the variable set and restored by the shared helper; no process, native build or installed package.
 */
export const test_options_carry_only_a_non_empty_private_run_identity =
  async () => {
    await assertOptionsCarryOnlyANonEmptyPrivateRunIdentity();
  };
