import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);

/**
 * The subset of the Metro Babel-transformer contract this adapter relies on.
 *
 * Metro loads the module named by `transformer.babelTransformerPath` and calls
 * its `transform` once per file, expecting a Babel AST back. `getCacheKey` is
 * an optional export Metro folds into its transform-cache key; Metro invokes it
 * with arguments (e.g. `{ projectRoot, enableBabelRCLookup }`), so it is typed
 * variadic.
 */
export interface UpstreamTransformer {
  transform(params: {
    src: string;
    filename: string;
    options: Record<string, unknown>;
    [key: string]: unknown;
  }): Promise<{ ast: object }>;
  getCacheKey?: (...args: unknown[]) => string;
}

/**
 * Upstream transformer module specifiers tried (in order) when no explicit
 * `upstreamTransformer` is configured: Expo first, then modern bare React
 * Native, then the legacy package.
 */
export const UPSTREAM_CANDIDATES = [
  "@expo/metro-config/babel-transformer",
  "@react-native/metro-babel-transformer",
  "metro-react-native-babel-transformer",
] as const;

/**
 * Resolve the upstream Metro Babel transformer to delegate to.
 *
 * Detection order, most specific first:
 *
 * 1. An explicit `customPath` (the `upstreamTransformer` option);
 * 2. Each of {@link UPSTREAM_CANDIDATES} in turn.
 *
 * These are declared as optional peers and resolved at runtime against the
 * consumer project, so the adapter carries no Metro/Expo dependency itself.
 * Resolution is not memoised — Node's own module cache already makes the
 * repeated `require` a cheap lookup, and keeping no module-level state lets a
 * changed `upstreamTransformer` always take effect.
 *
 * `load` is injectable purely so the resolution order and the not-found path
 * can be tested deterministically; production always uses the real `require`.
 */
export function resolveUpstreamTransformer(
  customPath?: string,
  load: (modulePath: string) => UpstreamTransformer | undefined = tryRequire,
): UpstreamTransformer {
  if (customPath !== undefined && customPath.length !== 0) {
    const upstream = load(customPath);
    if (upstream === undefined) {
      throw new Error(
        `[@ttsc/metro] Could not load the configured upstream transformer: ${customPath}`,
      );
    }
    return upstream;
  }

  for (const candidate of UPSTREAM_CANDIDATES) {
    const upstream = load(candidate);
    if (upstream !== undefined) {
      return upstream;
    }
  }

  throw new Error(
    "[@ttsc/metro] Could not find an upstream Metro transformer. Install " +
      "@expo/metro-config (Expo) or @react-native/metro-babel-transformer " +
      "(React Native), or set the `upstreamTransformer` option to an explicit " +
      "module path.",
  );
}

function tryRequire(modulePath: string): UpstreamTransformer | undefined {
  try {
    return nodeRequire(modulePath) as UpstreamTransformer;
  } catch {
    return undefined;
  }
}
