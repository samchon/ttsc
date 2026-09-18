import { unplugin } from "./core/unplugin";

/**
 * The Farm adapter of `@ttsc/unplugin`, a named view of the unified plugin
 * instance.
 *
 * Runs ttsc plugins inside Farm compilations and updates. Every plugin instance
 * the host creates owns its own generation cache, while the transform core and
 * the watch-input contract are the ones every adapter shares. This module is
 * the `@ttsc/unplugin/farm` subpath entry and loads the same core as every
 * other entry.
 */
const farm: typeof unplugin.farm = unplugin.farm;

export default farm;
