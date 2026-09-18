import { unplugin } from "./core/unplugin";

/**
 * The esbuild adapter of `@ttsc/unplugin`, taken from the unified instance.
 *
 * Runs ttsc plugins inside esbuild builds and contexts, sharing the transform
 * core, generation cache, and watch-input contract with every other adapter.
 * This module exists so `@ttsc/unplugin/esbuild` loads only this adapter's
 * entry.
 */
const esbuild: typeof unplugin.esbuild = unplugin.esbuild;

export default esbuild;
