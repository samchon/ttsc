import { assertAutoDetectsInPriorityOrder } from "../../internal/metro-upstream-decisions";

/**
 * Verifies upstream auto-detection tries candidates in priority order.
 *
 * With no explicit `upstreamTransformer`, the adapter must prefer Expo, then
 * modern React Native, then the legacy package, picking the first resolvable
 * one. A wrong order would, e.g., pick the legacy transformer in an Expo
 * project.
 *
 * 1. With all candidates resolvable, assert Expo (first) is chosen.
 * 2. With Expo absent, assert modern RN is chosen.
 * 3. With Expo and modern RN absent, assert the legacy package is chosen.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveUpstreamTransformer(undefined, load) with an injected loader that tags each specifier returns the Expo transformer when all load, the @react-native one when Expo returns undefined, and the metro-react-native-babel-transformer one when both earlier candidates return undefined.
 * @evidence contracts/testing.md#independent-expectations The three candidate specifiers are written out literally in the test and compared with the tag the loader attached, not read from UPSTREAM_CANDIDATES.
 * @evidence contracts/testing.md#distinguishing-cases All candidates present, the first absent, and the first two absent are three separate selections, so a wrong order or a missing fall-through changes the chosen name.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls resolveUpstreamTransformer from packages/metro/src/core/upstream.ts in-process with an injected loader callback; no module is required from disk, and no compile, install or Metro host is involved.
 */
export const test_upstream_auto_detects_in_priority_order = async () => {
  await assertAutoDetectsInPriorityOrder();
};
