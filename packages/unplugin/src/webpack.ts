import { unplugin } from "./core/unplugin";

/**
 * The webpack adapter of `@ttsc/unplugin`, a named view of the unified plugin
 * instance.
 *
 * Runs ttsc plugins inside webpack compilations. Every plugin instance the host
 * creates owns its own generation cache, while the transform core and the
 * watch-input contract are the ones every adapter shares. This module is the
 * `@ttsc/unplugin/webpack` subpath entry and loads the same core as every other
 * entry.
 */
const webpack: typeof unplugin.webpack = unplugin.webpack;

export default webpack;
