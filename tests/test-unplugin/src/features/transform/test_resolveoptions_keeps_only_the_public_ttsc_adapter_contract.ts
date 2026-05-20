import { assertResolveOptionsKeepsOnlyPublicContract } from "../../internal/options-contract";

/**
 * Verifies resolveOptions keeps only the public ttsc adapter contract.
 *
 * `resolveOptions` is the normalisation step that strips any private or
 * framework-specific keys before they leak into the generated tsconfig. An
 * accidental extra key would either corrupt the tsconfig or expose an
 * undocumented option surface. This pins that the returned object has exactly
 * the three public keys (`compilerOptions`, `plugins`, `project`) and that each
 * value is preserved verbatim.
 *
 * 1. Call `resolveOptions` with all three public fields populated.
 * 2. Assert the returned object has exactly those three keys (sorted).
 * 3. Assert each field value is deep-equal to the input.
 */
export const test_resolveoptions_keeps_only_the_public_ttsc_adapter_contract =
  async () => {
    await assertResolveOptionsKeepsOnlyPublicContract();
  };
