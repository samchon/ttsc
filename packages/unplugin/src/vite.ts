import { unplugin } from "./core/unplugin";

/**
 * The Vite adapter of `@ttsc/unplugin`, taken from the unified instance.
 *
 * Runs ttsc plugins inside Vite dev servers and builds, sharing the transform
 * core, generation cache, and watch-input contract with every other adapter.
 * This module exists so `@ttsc/unplugin/vite` loads only this adapter's entry.
 */
const vite: typeof unplugin.vite = unplugin.vite;

export default vite;
