import { assertCacheKeyChangesWhenThePluginBuildEnvironmentChanges } from "../../internal/metro-cache";

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
 */
export const test_cache_key_changes_when_the_plugin_build_environment_changes =
  async () => {
    await assertCacheKeyChangesWhenThePluginBuildEnvironmentChanges();
  };
