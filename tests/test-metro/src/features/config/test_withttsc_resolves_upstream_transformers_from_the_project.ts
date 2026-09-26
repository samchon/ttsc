import { assertWithTtscResolvesUpstreamFromTheProject } from "../../internal/metro-config";

/**
 * Verifies automatic and explicit upstream transformers resolve from the app.
 *
 * See {@link assertWithTtscResolvesUpstreamFromTheProject}: the worker resolved
 * both from `@ttsc/metro`'s own location, so an Expo or React Native app whose
 * adapter is linked from outside its `node_modules` failed every module with
 * "Could not find an upstream Metro transformer".
 */
export const test_withttsc_resolves_upstream_transformers_from_the_project =
  async () => {
    await assertWithTtscResolvesUpstreamFromTheProject();
  };
