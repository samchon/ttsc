import { assertWithTtscResolvesUpstreamFromTheProject } from "../../internal/metro-config";

/**
 * Verifies automatic and explicit upstream transformers resolve from the app.
 *
 * See {@link assertWithTtscResolvesUpstreamFromTheProject}: the worker resolved
 * both from `@ttsc/metro`'s own location, so an Expo or React Native app whose
 * adapter is linked from outside its `node_modules` failed every module with
 * "Could not find an upstream Metro transformer".
 *
 * 1. Install automatic and explicit upstream module fixtures only beneath their
 *    project roots.
 * 2. Call authored withTtsc for each project.
 * 3. Assert the worker payload contains the exact resolved project module path.
 *
 * @evidence contracts/testing.md#behavioral-verification withTtsc publishes the absolute path of @react-native/metro-babel-transformer installed only under the project root as the automatic upstream, resolves an explicit upstreamTransformer package name from the project, passes an unresolvable explicit name through unchanged, and publishes no upstream when no candidate is installed.
 * @evidence contracts/testing.md#independent-expectations The fake packages exist only under each temp project's node_modules, so the exact module path each call must publish is known from the fixture layout, not computed by the resolver under test.
 * @evidence contracts/testing.md#distinguishing-cases An automatic candidate and an explicit third-party package (positives) are contrasted with an unresolvable explicit name and a project with no candidate installed (pass-through and undefined).
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls withTtsc in-process against temp projects with fake node_modules packages and reads TTSC_METRO_OPTIONS (restored afterwards); no native compile, consumer install or Metro host.
 */
export const test_withttsc_resolves_upstream_transformers_from_the_project =
  async () => {
    await assertWithTtscResolvesUpstreamFromTheProject();
  };
