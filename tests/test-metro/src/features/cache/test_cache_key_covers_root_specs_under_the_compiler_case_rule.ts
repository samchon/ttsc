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
 * @evidence contracts/testing.md#behavioral-verification With include [src, lib] and a file at Lib/extra.ts, editing that file changes getCacheKey if and only if compilerUsesCaseSensitiveFileNames reports an insensitive policy for the project root.
 * @evidence contracts/testing.md#independent-expectations The expected direction is taken from the owning compiler case-policy function, so it is a contextual oracle rather than an independent one: a wrong policy answer shared by both sides would pass.
 * @evidence contracts/testing.md#distinguishing-cases Each run exercises only the branch its host selects (key moves on an insensitive policy, stays on a sensitive one); both branches are asserted by the same expression but not both within one run.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls compilerUsesCaseSensitiveFileNames, prepareSnapshot and getCacheKey (fresh transformer module, fake upstream) in-process on a temp project; no native build of the compiler or Metro host is started.
 */
export const test_cache_key_covers_root_specs_under_the_compiler_case_rule =
  async () => {
    await assertCacheKeyCoversRootSpecsUnderTheCompilerCaseRule();
  };
