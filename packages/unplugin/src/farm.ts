import { unplugin } from "./core/unplugin";

/**
 * The Farm adapter of `@ttsc/unplugin`, taken from the unified instance.
 *
 * Runs ttsc plugins inside Farm compilations and updates, sharing the transform
 * core, generation cache, and watch-input contract with every other adapter.
 * This module exists so `@ttsc/unplugin/farm` loads only this adapter's entry.
 */
const farm: typeof unplugin.farm = unplugin.farm;

export default farm;
