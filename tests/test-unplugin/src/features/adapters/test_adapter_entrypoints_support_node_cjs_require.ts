import { assertAdapterEntrypointsSupportCjsRequire } from "../../internal/adapter-entrypoints";

/**
 * Verifies adapter entrypoints support Node CJS require.
 *
 * The package ships dual CJS/ESM output. A missing `.js` barrel or a broken
 * `exports` field would cause `require()` to throw at runtime in CJS Node
 * projects. This pins that every bundler-specific CJS entrypoint — plus the
 * public `api` module — resolves to the expected factory or function.
 *
 * 1. Use `createRequire` rooted at the test-unplugin package to `require` the CJS
 *    build of each adapter entrypoint and the `api` module.
 * 2. Assert the root index exports `default.vite` as a function.
 * 3. Assert each per-bundler CJS entrypoint resolves to a function.
 * 4. Assert `api.resolveOptions` and `api.transformTtsc` are functions.
 */
export const test_adapter_entrypoints_support_node_cjs_require = () => {
  assertAdapterEntrypointsSupportCjsRequire();
};
