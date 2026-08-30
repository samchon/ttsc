import { assertMetroAsksTheAdaptersPolicy } from "../../internal/metro-cache";

/**
 * Verifies Metro resolves the membership policy the way the adapter does.
 *
 * See {@link assertMetroAsksTheAdaptersPolicy}: the caller's compiler-options
 * overlay must widen Metro's walk as it widens the compile, and a directory
 * occupying an `extends` candidate must not churn the memo
 * (samchon/ttsc#1316).
 */
export const test_metro_asks_the_adapters_policy = async () => {
  await assertMetroAsksTheAdaptersPolicy();
};
