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
 */
export const test_cache_key_covers_root_specs_under_the_compiler_case_rule =
  async () => {
    await assertCacheKeyCoversRootSpecsUnderTheCompilerCaseRule();
  };
