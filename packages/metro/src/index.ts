/**
 * `@ttsc/metro`: Metro (React Native / Expo) adapter for ttsc plugins.
 *
 * Metro bundles with Babel, which strips TypeScript types and never runs ttsc
 * plugins, so neither the `ttsc` CLI nor `@ttsc/unplugin` can reach an RN/Expo
 * build. {@link withTtsc} wires a Metro custom transformer that runs the ttsc
 * plugin pass on each TypeScript file before handing the result to the
 * project's existing Expo/React-Native Babel transformer.
 *
 * @example
 *   Expo project
 *   ```js
 *   // metro.config.js
 *   const { getDefaultConfig } = require("expo/metro-config");
 *   const { withTtsc } = require("@ttsc/metro");
 *
 *   module.exports = withTtsc(getDefaultConfig(__dirname));
 *   ```
 *
 * @example
 *   Bare React Native
 *   ```js
 *   // metro.config.js
 *   const { getDefaultConfig } = require("@react-native/metro-config");
 *   const { withTtsc } = require("@ttsc/metro");
 *
 *   module.exports = withTtsc(getDefaultConfig(__dirname));
 *   ```
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareSnapshot } from "./core/fingerprint";
import type { TtscMetroOptions } from "./core/options";
import { ENV_KEY, serializeOptions } from "./core/options";

export type {
  ResolvedTtscMetroOptions,
  TtscMetroOptions,
} from "./core/options";

/**
 * Minimal structural type for a Metro config object, avoids a hard dependency
 * on Metro's types while letting {@link withTtsc} preserve the caller's exact
 * config type.
 */
interface MetroConfigLike {
  transformer?: {
    babelTransformerPath?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Wrap a Metro config so ttsc plugins run on every TypeScript file.
 *
 * Sets `transformer.babelTransformerPath` to this package's transformer and
 * publishes the resolved options to Metro's worker processes via the
 * {@link ENV_KEY} environment variable (the workers never see this call, so env
 * is the transport, see `core/options.ts`). Compatible with Expo's
 * `getDefaultConfig()` and bare React Native alike.
 *
 * With no `options`, the transformer auto-discovers `tsconfig.json` and runs
 * the plugins configured there: the standard ttsc model. Pass `options` only to
 * override the project path, plugin list, or include/exclude filters.
 */
export function withTtsc<T extends MetroConfigLike>(
  config: T,
  options: TtscMetroOptions = {},
): T {
  process.env[ENV_KEY] = serializeOptions(options);
  // Prepare the reference-graph snapshot backing the transformer's cache-key
  // fingerprint (see `core/fingerprint.ts`). This runs in the single Metro
  // config process before any worker exists, so it is the race-free moment to
  // mint the snapshot epoch and compact the previous run's worker files.
  prepareSnapshot(
    typeof config.projectRoot === "string" ? config.projectRoot : undefined,
  );
  return {
    ...config,
    transformer: {
      ...config.transformer,
      babelTransformerPath: transformerModulePath(),
    },
  } as T;
}

/**
 * Absolute path to the built transformer module Metro will `require`.
 *
 * Always the CommonJS build (`transformer.js`) next to this module: Metro
 * resolves `babelTransformerPath` with `require`, and `metro.config.js` is a
 * CommonJS module. Rollup rewrites `import.meta.url` for both the CJS and ESM
 * builds, so this resolves correctly regardless of how the config loaded this
 * entry.
 */
function transformerModulePath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "transformer.js");
}
