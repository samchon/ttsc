import { unplugin } from "./core/unplugin";

/**
 * The esbuild adapter of `@ttsc/unplugin`, a named view of the unified plugin
 * instance.
 *
 * Runs ttsc plugins inside esbuild builds and contexts. Every plugin instance
 * the host creates owns its own generation cache, while the transform core and
 * the watch-input contract are the ones every adapter shares. This module is
 * the `@ttsc/unplugin/esbuild` subpath entry and loads the same core as every
 * other entry.
 */
const esbuild: typeof unplugin.esbuild = unplugin.esbuild;

export default esbuild;
