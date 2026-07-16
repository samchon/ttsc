import { assertExternalValidationIgnoresGeneratedTsconfig } from "../../internal/transform-external";

/**
 * Verifies the disposed temp-dir tsconfig never joins the external validation
 * universe.
 *
 * A `compilerOptions` overlay compiles through a generated tsconfig in the
 * system temp directory; the host's config chain reports it, and it is deleted
 * right after the compile. Hashing it at store time would flip to `missing` on
 * the first revalidation and silently turn every subsequent transform of the
 * project into a full recompile.
 *
 * 1. Transform with an overlay whose fixture graph echoes the generated tsconfig
 *    into the config chain; capture the cached generation.
 * 2. Transform again without touching anything.
 * 3. Assert the cached generation is replayed, not replaced.
 */
export const test_transformttsc_external_validation_ignores_the_generated_tsconfig =
  async () => {
    await assertExternalValidationIgnoresGeneratedTsconfig();
  };
