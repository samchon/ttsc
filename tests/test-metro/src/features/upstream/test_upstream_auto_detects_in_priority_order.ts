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
 * @evidence contracts/testing.md#behavioral-verification resolveUpstreamTransformer selects Expo, modern React Native, then legacy React Native as earlier candidates become absent.
 * @evidence contracts/testing.md#independent-expectations The documented priority uses literal package specifiers independently of exported candidate data.
 * @evidence contracts/testing.md#distinguishing-cases All present, Expo absent and the first two absent preserve the three selected-transformer assertions.
 * @evidence contracts/testing.md#execution-ownership This named src/features export executes authored Metro decisions in the source-unit Node process; fixture callbacks supply resolver results and no compiled package, native build, install or host starts.
 */
export const test_upstream_auto_detects_in_priority_order = async () => {
  await assertAutoDetectsInPriorityOrder();
};
