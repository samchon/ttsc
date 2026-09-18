import { unplugin } from "./core/unplugin";

/**
 * The Rspack adapter of `@ttsc/unplugin`, taken from the unified instance.
 *
 * Runs ttsc plugins inside Rspack compilations, sharing the transform core,
 * generation cache, and watch-input contract with every other adapter. This
 * module exists so `@ttsc/unplugin/rspack` loads only this adapter's entry.
 */
const rspack: typeof unplugin.rspack = unplugin.rspack;

export default rspack;
