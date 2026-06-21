import { assertAutoDetectsInPriorityOrder } from "../../internal/metro-upstream";

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
 */
export const test_upstream_auto_detects_in_priority_order = async () => {
  await assertAutoDetectsInPriorityOrder();
};
