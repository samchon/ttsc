import { assertCacheKeyCoversRootSpecsUnderTheCompilerCaseRule } from "../../internal/metro-cache";

/**
 * Verifies the Metro key decides root-spec membership under the case policy the
 * compiler's own rule answers, not the platform's ordinary one.
 *
 * The key is computed without a compile, so it took the policy from
 * `process.platform === "linux"`, while TypeScript-Go decides it from the
 * executable it runs as (samchon/ttsc#1563).
 *
 * 1. Create a project whose `include` names `lib`, with a file under `Lib/`.
 * 2. Compute the key, edit that file, and compute it again.
 * 3. Assert the key moved exactly when the compiler compares names
 *    case-insensitively.
 *
 * @evidence contracts/testing.md#behavioral-verification Editing Lib/extra.ts under a lib include changes the key exactly when the actual compiler policy compares names insensitively.
 * @evidence contracts/testing.md#independent-expectations The owning compiler case-policy operation supplies the contextual oracle for the authored case-only directory mismatch; this does not independently prove that policy operation.
 * @evidence contracts/testing.md#distinguishing-cases Matching insensitive volume behavior contrasts the sensitive policy, using the same case-differing source.
 * @evidence contracts/testing.md#execution-ownership This named src/unit/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_covers_root_specs_under_the_compiler_case_rule =
  async () => {
    await assertCacheKeyCoversRootSpecsUnderTheCompilerCaseRule();
  };
