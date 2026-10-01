import { assertCacheKeyChangesWhenThePluginBuildEnvironmentChanges } from "../../../internal/metro/internal/metro-cache";

/**
 * Verifies a Metro run's key carries the environment each recorded plugin
 * source's binary is built in, so a restart under another `GOFLAGS` or Go
 * toolchain re-keys the run (samchon/ttsc#1493).
 *
 * A plugin's binary is keyed on its Go source and on its build environment, and
 * since samchon/ttsc#1487 the run's key carried the source alone: a restart
 * under another `GOFLAGS` reused every module the other binary produced. The
 * state a recorded plugin source carries is now the one the build keys on,
 * sources and environment together. Exercises the real native compiler, so it
 * runs where the Go toolchain is present.
 *
 * 1. Run a transform whose plugin's Go source is the project's own copy, and
 *    prepare the next run with that source recorded as a tree.
 * 2. Assert the key holds under an unchanged environment.
 * 3. Set another `GOFLAGS`, and assert the key differs.
 *
 * @evidence contracts/testing.md#behavioral-verification An actual transform records its Go source; an unchanged environment keeps the key and temporary GOFLAGS change invalidates it.
 * @evidence contracts/testing.md#independent-expectations Native plugin binaries depend on their build environment as well as source bytes; exact equality and inequality independently express that contract.
 * @evidence contracts/testing.md#distinguishing-cases Stable environment is the positive reuse control beside one GOFLAGS mutation with unchanged files.
 * @evidence contracts/testing.md#execution-ownership This named features export test_cache_key_changes_when_the_plugin_build_environment_changes executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler delivery must identify the plugin tree whose build environment contributes to the adapter key.
 * @evidence contracts/e2e.md#shared-execution One initial native project transform uses the suite shared producer cache. GOFLAGS is only fingerprinted for the second comparison, without rebuilding a plugin just to observe its key.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case copies source before mutation, compacts its own worker document and restores GOFLAGS in finally; worker options and tracked temporary directories retain their runner ownership.
 * @evidence contracts/e2e.md#preserved-coverage Original recorded-source membership, stable key and changed-environment key assertions remain.
 */
export const test_cache_key_changes_when_the_plugin_build_environment_changes =
  async () => {
    await assertCacheKeyChangesWhenThePluginBuildEnvironmentChanges();
  };
