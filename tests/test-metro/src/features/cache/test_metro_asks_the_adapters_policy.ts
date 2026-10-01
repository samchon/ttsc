import { assertMetroAsksTheAdaptersPolicy } from "../../internal/metro-cache";

/**
 * Verifies Metro resolves the membership policy the way the adapter does.
 *
 * See {@link assertMetroAsksTheAdaptersPolicy}: the caller's compiler-options
 * overlay must widen Metro's walk as it widens the compile, every implicit
 * nested project must own its nearest-config subtree, and config-map changes
 * must invalidate without multiplying package-level test functions
 * (samchon/ttsc#1316, samchon/ttsc#1332).
 *
 * 1. Create config directory collisions, nested projects and missing extends candidates.
 * 2. Compare routed policies and captured fingerprint/recorder observations.
 * 3. Change config membership and overlays, asserting exact inclusion and output exclusions.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored Metro and Unplugin policy operations agree on project routing, root/config membership, nested config appearance/removal, overlay source extensions and replacement output exclusions while recorded inputs retain their proper owners.
 * @evidence contracts/testing.md#independent-expectations Authored fixture config paths, allowJs controls and expected excluded/admitted directories independently specify the routed policy. Comparisons between the two owners prove agreement only; literal positive and negative membership assertions distinguish joint mistakes where supplied.
 * @evidence contracts/testing.md#distinguishing-cases Directory collisions, nested config transitions, overlapping roots, missing extends candidates, overlay extension changes and inherited output replacement remain separate assertions under one named entry.
 * @evidence contracts/testing.md#execution-ownership This src/features/cache export directly loads authored Metro fingerprint and Unplugin API operations under the source-unit loader. Resolver fixture files exercise their owners in one Node process without installing a consumer, compiling native code or starting a product host.
 */
export const test_metro_asks_the_adapters_policy = async () => {
  await assertMetroAsksTheAdaptersPolicy();
};
