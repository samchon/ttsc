import { assertPackageBuildKeepsRuntimeDependenciesExternal } from "../../internal/adapter-entrypoints";

/**
 * Verifies package build keeps runtime dependencies external.
 *
 * Bundling `ttsc` or `unplugin` into the package output would inflate the
 * artifact and shadow the version the consuming project installed. It would
 * also break version-range matching for downstream plugins. This pins that
 * `ttsc` is externalised (present as a `require`/`import` call in the output),
 * that `unplugin` is not inlined, that no virtual-module shims are embedded,
 * and that stale dev-time externals (`diff-match-patch-es`, `magic-string`) no
 * longer appear anywhere in the rollup config or the built output.
 *
 * 1. Read the built CJS and ESM outputs for `core/transform` and `core/index`.
 * 2. Read `rollup.config.mjs` from `packages/unplugin`.
 * 3. Assert `ttsc` appears as a runtime import in the CJS and ESM outputs.
 * 4. Assert no virtual-module paths, `__dirname` refs, or workspace-relative paths
 *    are present in any output; assert stale externals are absent from both the
 *    config and all outputs.
 */
export const test_package_build_keeps_runtime_dependencies_external = () => {
  assertPackageBuildKeepsRuntimeDependenciesExternal();
};
