import { assertTurbopackLoaderRegistersDependenciesOnCacheHit } from "../../internal/adapter-turbopack";

/**
 * Verifies the Turbopack loader replays dependency registration on cache hits
 * (#666).
 *
 * The loader keeps one transform cache for the worker lifetime across requests,
 * but Turbopack rebuilds each module's `fileDependencies` set per loader
 * invocation. If a cache hit skipped re-registration, the second and later
 * requests for a module would lose invalidation on its plugin-reported
 * dependencies. Registration must therefore fire on every call, not only the
 * fresh compile.
 *
 * 1. Build the `emit-dependencies` fixture reporting one dependency.
 * 2. Invoke the loader twice for the same module sharing the loader's cache.
 * 3. Assert both the fresh transform and the cache-served transform register the
 *    same normalized dependency.
 */
export const test_turbopack_loader_registers_plugin_dependencies_on_cache_hit =
  async () => {
    await assertTurbopackLoaderRegistersDependenciesOnCacheHit();
  };
