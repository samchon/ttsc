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
 * Resolution is not memoised: Node's own module cache already makes the
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
    let upstream: UpstreamTransformer | undefined;
    try {
      upstream = load(customPath);
    } catch (cause) {
      // The module resolves but failed while initializing (a top-level throw,
      // a missing peer/transitive dependency, or a runtime-ABI rejection).
      // Preserve the original diagnostic instead of masking it as absence.
      throw new Error(
        `[@ttsc/metro] Failed to load the configured upstream transformer "${customPath}": ${errorMessage(cause)}`,
        { cause },
      );
    }
    if (upstream === undefined) {
      throw new Error(
        `[@ttsc/metro] Could not load the configured upstream transformer: ${customPath}`,
      );
    }
    return upstream;
  }

  for (const candidate of UPSTREAM_CANDIDATES) {
    let upstream: UpstreamTransformer | undefined;
    try {
      upstream = load(candidate);
    } catch (cause) {
      // A candidate that resolves but throws while initializing is a broken
      // installation of the active stack, not an absent optional peer. Surface
      // it rather than silently falling through to a candidate that does not
      // match this project.
      throw new Error(
        `[@ttsc/metro] The upstream Metro transformer "${candidate}" is installed but failed to initialize: ${errorMessage(cause)}`,
        { cause },
      );
    }
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

/**
 * Load an upstream transformer module, separating genuine absence from a broken
 * installation.
 *
 * Resolution and execution are split deliberately. `require.resolve` only walks
 * the module graph for the requested specifier; it never executes third-party
 * code, so a failure there proves the requested candidate itself is not present
 * — reported as `undefined` (absence) so automatic probing continues to the
 * next optional peer. Once resolution succeeds, any error thrown by the actual
 * `require` comes from executing the module body, including a missing peer or
 * transitive dependency; that is a real initialization failure and is rethrown
 * with its original message and stack so the caller can preserve it.
 */
function tryRequire(modulePath: string): UpstreamTransformer | undefined {
  try {
    nodeRequire.resolve(modulePath);
  } catch (error) {
    if (isCandidateAbsent(error)) {
      return undefined;
    }
    // A resolution error that is not one of the known "entry point absent"
    // codes (e.g. an invalid specifier) is not evidence of a plain absence;
    // surface it rather than silently skipping the candidate.
    throw error;
  }
  return nodeRequire(modulePath) as UpstreamTransformer;
}

/**
 * Whether a resolution error means the requested candidate's entry point is not
 * available here — i.e. genuine absence, not a broken initialization.
 *
 * Resolution never executes the module body, so a `require.resolve` failure can
 * only concern the requested specifier, never a transitive import of it. Each
 * recognised code says the same thing about that specifier:
 *
 * - `MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND` — the package or file itself is
 *   not installed (CJS and ESM loaders respectively).
 * - `ERR_PACKAGE_PATH_NOT_EXPORTED` — the package is installed but the requested
 *   subpath is not exported (or its export target is missing). This matters for
 *   the `@expo/metro-config/babel-transformer` candidate, a package subpath:
 *   under Expo/React Native version skew a present but non-exporting package
 *   must stay non-fatal so auto-detection falls through to the next candidate,
 *   exactly as a wholly absent package does.
 *
 * An error thrown later, while the resolved module executes, is a real
 * initialization failure and is never routed here — the caller preserves it.
 */
function isCandidateAbsent(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return (
    code === "MODULE_NOT_FOUND" ||
    code === "ERR_MODULE_NOT_FOUND" ||
    code === "ERR_PACKAGE_PATH_NOT_EXPORTED"
  );
}

/** Best-effort message extraction for wrapping an unknown thrown value. */
function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
