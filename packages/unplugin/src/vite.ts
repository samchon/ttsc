import { unplugin } from "./core/unplugin";

/**
 * The Vite adapter of `@ttsc/unplugin`, a named view of the unified plugin
 * instance.
 *
 * Runs ttsc plugins inside Vite dev servers and builds. Every plugin instance
 * the host creates owns its own generation cache, while the transform core and
 * the watch-input contract are the ones every adapter shares. This module is
 * the `@ttsc/unplugin/vite` subpath entry and loads the same core as every
 * other entry.
 */
const vite: typeof unplugin.vite = unplugin.vite;

export default vite;
