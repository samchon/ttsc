import { unplugin } from "./core/unplugin";

/**
 * The Rolldown adapter of `@ttsc/unplugin`, taken from the unified instance.
 *
 * Runs ttsc plugins inside Rolldown builds and watch sessions, sharing the
 * transform core, generation cache, and watch-input contract with every other
 * adapter. This module exists so `@ttsc/unplugin/rolldown` loads only this
 * adapter's entry.
 */
const rolldown: typeof unplugin.rolldown = unplugin.rolldown;

export default rolldown;
