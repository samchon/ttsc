import { assertMetroBuildKeepsRuntimeDependenciesExternal } from "../../internal/metro-build";

/**
 * Verifies the Metro package build keeps `@ttsc/unplugin` external.
 *
 * Bundling `@ttsc/unplugin` into the Metro output would inflate the artifact
 * and shadow the version the consuming project installed.
 *
 * 1. Read the built CJS and ESM `transformer` outputs.
 * 2. Assert `@ttsc/unplugin/api` stays a runtime import in both outputs.
 * 3. Assert no virtual-module shims are inlined.
 */
export const test_package_build_keeps_runtime_dependencies_external = () => {
  assertMetroBuildKeepsRuntimeDependenciesExternal();
};
