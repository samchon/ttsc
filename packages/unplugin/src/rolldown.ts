import { unplugin } from "./core/unplugin";

/**
 * The Rolldown adapter of `@ttsc/unplugin`, a named view of the unified plugin
 * instance.
 *
 * Runs ttsc plugins inside Rolldown builds and watch sessions. Every plugin
 * instance the host creates owns its own generation cache, while the transform
 * core and the watch-input contract are the ones every adapter shares. This
 * module is the `@ttsc/unplugin/rolldown` subpath entry and loads the same core
 * as every other entry.
 */
const rolldown: typeof unplugin.rolldown = unplugin.rolldown;

export default rolldown;
