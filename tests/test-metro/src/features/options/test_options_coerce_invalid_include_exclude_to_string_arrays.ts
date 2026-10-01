import { assertInvalidIncludeExcludeCoerced } from "../../internal/metro-options";

/**
 * Verifies invalid include/exclude env values are coerced to string arrays.
 *
 * `include`/`exclude` cross the config→worker boundary as untrusted JSON. A
 * bare string (a common mistake) or non-string entries would make
 * `shouldTransform` call `.some` on a non-array, crashing every worker. The
 * resolver must coerce to a filtered `string[]` while still resolving valid
 * sibling fields.
 *
 * 1. Set the env to a payload with a string `exclude` and a mixed-type `include`.
 * 2. Resolve options.
 * 3. Assert `include` keeps only strings, `exclude` becomes `[]`, and
 *    `plugins:false` survives.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveOptionsFromEnv filters mixed include entries to a,b, converts string exclude into an empty array and preserves sibling plugins:false.
 * @evidence contracts/testing.md#independent-expectations The worker filter contract admits string arrays only; the input independently identifies a,b as the valid include members.
 * @evidence contracts/testing.md#distinguishing-cases Mixed-validity array and non-array filters distinguish element filtering from container rejection while a valid sibling stays intact.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveOptionsFromEnv from packages/metro/src/core/options.ts in-process with TTSC_METRO_OPTIONS set by the helper and restored afterwards; no child process, native build or installed package.
 */
export const test_options_coerce_invalid_include_exclude_to_string_arrays =
  async () => {
    await assertInvalidIncludeExcludeCoerced();
  };
