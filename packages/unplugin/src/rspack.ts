import { unplugin } from "./core/unplugin";

/**
 * The Rspack adapter of `@ttsc/unplugin`, a named view of the unified plugin
 * instance.
 *
 * Runs ttsc plugins inside Rspack compilations. Every plugin instance the host
 * creates owns its own generation cache, while the transform core and the
 * watch-input contract are the ones every adapter shares. This module is the
 * `@ttsc/unplugin/rspack` subpath entry and loads the same core as every other
 * entry.
 */
const rspack: typeof unplugin.rspack = unplugin.rspack;

export default rspack;
