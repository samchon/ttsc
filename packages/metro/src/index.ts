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
import { basename, dirname, join, resolve } from "node:path";
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
 *
 * A `babelTransformerPath` the config already carried is chained rather than
 * replaced: it becomes the upstream this transformer delegates to, so wrapping
 * a working config keeps whatever it configured. `react-native-svg-transformer`
 * is installed by exactly that assignment, and replacing it silently sent every
 * `.svg` to the auto-detected Expo default instead, with the build still
 * succeeding (samchon/ttsc#1321). An explicit `upstreamTransformer` option
 * still wins, since that is the caller saying it outright.
 */
export function withTtsc<T extends MetroConfigLike>(
  config: T,
  options: TtscMetroOptions = {},
): T {
  process.env[ENV_KEY] = serializeOptions(
    inheritConfiguredTransformer(config, options),
  );
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
 * Adopt the config's own `babelTransformerPath` as the upstream to delegate to.
 *
 * The value `withTtsc` overwrites is precisely the transformer that should run
 * after the ttsc pass, so taking it as the default `upstreamTransformer` is
 * what makes the wrapper additive in the one field it sets. Everything else in
 * the config was already spread through untouched, which is what made the loss
 * hard to see (samchon/ttsc#1321).
 *
 * An explicit option wins, and this package's own transformer is never adopted:
 * a config wrapped twice would otherwise name this module as its own upstream
 * and delegate into itself.
 */
function inheritConfiguredTransformer(
  config: MetroConfigLike,
  options: TtscMetroOptions,
): TtscMetroOptions {
  const declared = config.transformer?.babelTransformerPath;
  if (
    options.upstreamTransformer !== undefined ||
    typeof declared !== "string" ||
    declared.length === 0 ||
    isOwnTransformer(declared)
  ) {
    return options;
  }
  return { ...options, upstreamTransformer: declared };
}

/**
 * Whether a `babelTransformerPath` already points at this package's
 * transformer.
 *
 * Compared by directory and base name rather than by string equality, because
 * the same module is reachable as `transformer.js`, `transformer.mjs`, or
 * through a path a caller spelled differently, and adopting any of them would
 * make this transformer its own upstream.
 */
function isOwnTransformer(declared: string): boolean {
  const ours = transformerModulePath();
  const candidate = resolve(declared);
  if (candidate === resolve(ours)) {
    return true;
  }
  return (
    dirname(candidate) === dirname(resolve(ours)) &&
    basename(candidate).startsWith("transformer.")
  );
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
