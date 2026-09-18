import { unplugin } from "./core/unplugin";

/**
 * The Rollup adapter of `@ttsc/unplugin`, a named view of the unified plugin
 * instance.
 *
 * Runs ttsc plugins inside Rollup builds and watch sessions. Every plugin
 * instance the host creates owns its own generation cache, while the transform
 * core and the watch-input contract are the ones every adapter shares. This
 * module is the `@ttsc/unplugin/rollup` subpath entry and loads the same core
 * as every other entry.
 */
const rollup: typeof unplugin.rollup = unplugin.rollup;

export default rollup;
