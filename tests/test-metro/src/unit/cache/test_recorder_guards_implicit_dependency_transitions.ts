import { assertRecorderGuardsImplicitDependencyTransitions } from "../../internal/metro-cache";

/**
 * Verifies recorder baselines retain config and lexical input identities.
 *
 * An unchanged byte set can conceal a different selected project or link target.
 * These source operations own the state decisions independently of the native
 * producer connection retained by the implicit-dependency boundary entry.
 *
 * 1. Match ancestor config candidates against a prepared run baseline.
 * 2. Replace a directory link and restore it, then swap targets between aliases.
 * 3. Capture a temporarily unavailable nearer config and corrupt a key baseline.
 * 4. Assert exact taint, input retention, stable controls and epoch/key changes.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored recorder and fingerprint operations preserve unchanged ancestor-config coverage, reject A-to-B-to-A topology reuse, separate swapped lexical aliases, freeze config-selection evidence and retain inputs when a baseline witness is corrupt.
 * @evidence contracts/testing.md#independent-expectations Literal fixture paths, equal-byte topology changes and authored config/baseline mutations independently require exact taint, empty or retained file lists and key/epoch relationships; equality controls exclude an always-invalidating implementation.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged ancestor candidates contrast link replacement/restoration, target swaps, a single unavailable-config observation and malformed realpath evidence. The native boundary separately owns compiler-emitted dependency delivery.
 * @evidence contracts/testing.md#execution-ownership This named src/unit/cache export directly loads authored Metro fingerprint and Unplugin API owners. It uses resolver fixture directories and declared filesystem callbacks in one Node process, with no installation, native compiler or product host.
 */
export const test_recorder_guards_implicit_dependency_transitions = async () => {
  await assertRecorderGuardsImplicitDependencyTransitions();
};
