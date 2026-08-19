import { assertPathsKeepsTheHostOwnedBound } from "../../internal/transform-linked-completeness";

/**
 * Verifies a linked plugin that declares nothing keeps the host-owned bound.
 *
 * The negative twin of the banner and strip cases. `@ttsc/paths` reads two
 * things outside the file it rewrites — which sources the program contains, and
 * what the Checker says a bare `require` is — so it declares nothing, and the
 * narrowing must come from a declaration rather than from the host stamping
 * every linked-plugin envelope (samchon/ttsc#1263).
 *
 * 1. Build a project whose entry imports a type-only sibling, wired to
 *    `@ttsc/paths`.
 * 2. Transform the entry and collect the derived watch inputs.
 * 3. Assert the sibling is still registered.
 */
export const test_transformttsc_paths_keeps_the_host_owned_bound = async () => {
  await assertPathsKeepsTheHostOwnedBound();
};
