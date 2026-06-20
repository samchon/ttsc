import { assertInvalidIncludeExcludeCoerced } from "../../internal/metro-options";

/**
 * Verifies invalid include/exclude env values are coerced to string arrays.
 *
 * `include`/`exclude` cross the config→worker boundary as untrusted JSON. A
 * bare string (a common mistake) or non-string entries would make
 * `shouldTransform` call `.some` on a non-array — crashing every worker. The
 * resolver must coerce to a filtered `string[]` while still resolving valid
 * sibling fields.
 *
 * 1. Set the env to a payload with a string `exclude` and a mixed-type `include`.
 * 2. Resolve options.
 * 3. Assert `include` keeps only strings, `exclude` becomes `[]`, and
 *    `plugins:false` survives.
 */
export const test_options_coerce_invalid_include_exclude_to_string_arrays =
  async () => {
    await assertInvalidIncludeExcludeCoerced();
  };
