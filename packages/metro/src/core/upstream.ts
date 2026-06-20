import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);

/**
 * The subset of the Metro Babel-transformer contract this adapter relies on.
 *
 * Metro loads the module named by `transformer.babelTransformerPath` and calls
 * its `transform` once per file, expecting a Babel AST back. `getCacheKey` is
 * an optional export Metro folds into its transform-cache key.
 */
export interface UpstreamTransformer {
  transform(params: {
    src: string;
    filename: string;
    options: Record<string, unknown>;
    [key: string]: unknown;
  }): Promise<{ ast: object }>;
  getCacheKey?: () => string;
}

let cached: UpstreamTransformer | undefined;

/**
 * Resolve (and memoise) the upstream Metro Babel transformer to delegate to.
 *
 * Detection order, most specific first:
 *
 * 1. An explicit `customPath` (the `upstreamTransformer` option);
 * 2. `@expo/metro-config/babel-transformer` — Expo projects;
 * 3. `@react-native/metro-babel-transformer` — modern bare React Native;
 * 4. `metro-react-native-babel-transformer` — legacy bare React Native.
 *
 * These are declared as optional peers and resolved at runtime against the
 * consumer project, so the adapter carries no Metro/Expo dependency itself.
 */
export function resolveUpstreamTransformer(
  customPath?: string,
): UpstreamTransformer {
  if (cached !== undefined) {
    return cached;
  }

  if (customPath !== undefined && customPath.length !== 0) {
    const upstream = tryRequire(customPath);
    if (upstream === undefined) {
      throw new Error(
        `[@ttsc/metro] Could not load the configured upstream transformer: ${customPath}`,
      );
    }
    cached = upstream;
    return upstream;
  }

  for (const candidate of [
    "@expo/metro-config/babel-transformer",
    "@react-native/metro-babel-transformer",
    "metro-react-native-babel-transformer",
  ]) {
    const upstream = tryRequire(candidate);
    if (upstream !== undefined) {
      cached = upstream;
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
