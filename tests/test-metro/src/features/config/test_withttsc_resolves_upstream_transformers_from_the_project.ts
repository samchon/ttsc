import { assertWithTtscResolvesUpstreamFromTheProject } from "../../internal/metro-config";

/**
 * Verifies automatic and explicit upstream transformers resolve from the app.
 *
 * See {@link assertWithTtscResolvesUpstreamFromTheProject}: the worker resolved
 * both from `@ttsc/metro`'s own location, so an Expo or React Native app whose
 * adapter is linked from outside its `node_modules` failed every module with
 * "Could not find an upstream Metro transformer".
 *
 * 1. Install automatic and explicit upstream module fixtures only beneath their project roots.
 * 2. Call authored withTtsc for each project.
 * 3. Assert the worker payload contains the exact resolved project module path.
 *
 * @evidence contracts/testing.md#behavioral-verification withTtsc resolves automatic and explicit upstream packages from each project and publishes their absolute fixture module paths.
 * @evidence contracts/testing.md#independent-expectations Only the fixture project installs these authored module entries, so exact paths independently prove the resolution anchor.
 * @evidence contracts/testing.md#distinguishing-cases Automatic React Native candidate contrasts an explicit third-party package path.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls authored Metro operations through the source-unit loader. Input filesystem/module fixtures and declared upstream callbacks remain test-local; no installed consumer, native compiler or product host is launched.
 */
export const test_withttsc_resolves_upstream_transformers_from_the_project =
  async () => {
    await assertWithTtscResolvesUpstreamFromTheProject();
  };
