import { assertMetroAsksTheAdaptersPolicy } from "../../internal/metro-cache";

/**
 * Verifies Metro resolves the membership policy the way the adapter does.
 *
 * See {@link assertMetroAsksTheAdaptersPolicy}: the caller's compiler-options
 * overlay must widen Metro's walk as it widens the compile, every implicit
 * nested project must own its nearest-config subtree, and config-map changes
 * must invalidate without multiplying package-level test functions
 * (samchon/ttsc#1316, samchon/ttsc#1332).
 */
export const test_metro_asks_the_adapters_policy = async () => {
  await assertMetroAsksTheAdaptersPolicy();
};
