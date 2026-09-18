import { unplugin } from "./core/unplugin";

/**
 * The Rollup adapter of `@ttsc/unplugin`, taken from the unified instance.
 *
 * Runs ttsc plugins inside Rollup builds and watch sessions, sharing the
 * transform core, generation cache, and watch-input contract with every other
 * adapter. This module exists so `@ttsc/unplugin/rollup` loads only this
 * adapter's entry.
 */
const rollup: typeof unplugin.rollup = unplugin.rollup;

export default rollup;
