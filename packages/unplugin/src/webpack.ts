import { unplugin } from "./core/unplugin";

/**
 * The webpack adapter of `@ttsc/unplugin`, taken from the unified instance.
 *
 * Runs ttsc plugins inside webpack compilations, sharing the transform core,
 * generation cache, and watch-input contract with every other adapter. This
 * module exists so `@ttsc/unplugin/webpack` loads only this adapter's entry.
 */
const webpack: typeof unplugin.webpack = unplugin.webpack;

export default webpack;
