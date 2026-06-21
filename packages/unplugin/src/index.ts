/**
 * @ttsc/unplugin: bundler-agnostic ttsc plugin adapter.
 *
 * Re-exports the unified `unplugin` instance that carries named bundler
 * adapters (`.vite`, `.rollup`, `.rolldown`, `.webpack`, `.rspack`, `.esbuild`,
 * `.farm`) as well as the raw factory for custom integrations. Per-bundler
 * entry points (`@ttsc/unplugin/vite`, `/webpack`, …) each re-export the
 * matching adapter directly to keep bundler-specific builds lean.
 */
import unplugin from "./core/index";

export type { TtscUnpluginOptions } from "./core/options";

export default unplugin;
