import { assertBannerNarrowsThroughTheAliasOverlay } from "../../internal/transform-linked-completeness";

/**
 * Verifies the completeness declaration survives the generated tsconfig.
 *
 * A bundler alias makes the adapter compile through a wrapper tsconfig in the
 * system temp directory, so the host's cwd leaves the project root and every
 * envelope section is keyed absolutely instead of project-relatively. A
 * declaration the consumer cannot join back to the file it names would stop
 * narrowing silently — the failure is invisible except as the cost it was meant
 * to remove (samchon/ttsc#1263).
 *
 * 1. Build a banner project whose entry imports a type-only sibling.
 * 2. Transform the entry with a bundler alias, forcing the overlay tsconfig.
 * 3. Assert the sibling is still absent from the derived watch inputs.
 */
export const test_transformttsc_banner_narrows_through_the_alias_overlay =
  async () => {
    await assertBannerNarrowsThroughTheAliasOverlay();
  };
