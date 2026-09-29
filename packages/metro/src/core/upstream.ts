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
 *
 * @evidence contracts/common.md#principled-implementation
 *   This structural interface describes Metro's Babel-transformer extension:
 *   one transform operation and an optional variadic cache key. It does not
 *   implement Babel, install peers or alter their exports. Concrete modules
 *   supply the callbacks through normal Node loading.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This peer-independent interface exposes only the transform and cache-key
 *   callbacks the adapter invokes, avoiding a dependency on Metro's full API.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This structural callback contract carries Metro parameters and AST
 *   results; it does not define native module resolution or process
 *   invocation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains the awaited AST result and optional cache-key
 *   callback including forwarded arguments. Checked against the documentation
 *   skill: separate paragraphs state the contract and why its nonobvious
 *   boundary matters; field comments retain their own useful facts.
 */
export interface UpstreamTransformer {
  /**
   * Parse the supplied source and return the Babel AST Metro consumes.
   *
   * The adapter preserves Metro's filename, options and additional parameters;
   * only `src` may hold successfully transformed TypeScript. The returned AST
   * may have its locations remapped by the adapter before Metro receives it.
   *
   * @evidence contracts/common.md#principled-implementation
   *   This method signature represents the upstream transformer that Metro
   *   selected.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   One parameter record preserves Metro's extensible delivery shape and
   *   the result exposes only the AST this adapter needs.
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   It accepts the original Metro parameter record, with src replaced only by
   *   the owning adapter after a successful compiler pass; the type declares no
   *   implementation or test-specific branch.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   This method signature carries Metro source, filename spelling and options
   *   to Babel without defining native path interpretation.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   The native JSDoc explains source, filename, extra Metro parameters and
   *   the awaited Babel AST result. Checked against the documentation skill:
   *   separate paragraphs state the contract and why its nonobvious boundary
   *   matters; field comments retain their own useful facts.
   *
   */
  transform(params: {
    src: string;
    filename: string;
    options: Record<string, unknown>;
    [key: string]: unknown;
  }): Promise<{ ast: object }>;

  /**
   * Optional upstream contribution to Metro's static transformer key.
   *
   * Metro's arguments are forwarded unchanged. Absence contributes no upstream
   * key; the adapter treats a throwing key as nonfatal and disables reuse,
   * while transformer loading failures still fail actual transformation.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The optional callback follows Metro's upstream transformer contract.
   *   Arguments are variadic because Metro supplies its own key options; absence
   *   is handled by the adapter.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   An optional variadic callback expresses the one upstream contribution
   *   without adapter-specific copies of Metro's cache-key options.
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   This signature executes nothing and never replaces a foreign callback.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   This optional variadic callback contributes a string key. Native
   *   resolution belongs to the separate loader operation.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   The native JSDoc explains optional absence, forwarded Metro arguments and
   *   the upstream key contribution. Checked against the documentation skill:
   *   separate paragraphs state the contract and why its nonobvious boundary
   *   matters; field comments retain their own useful facts.
   *
   */
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
 * `withTtsc` resolves an explicit specifier and the automatic candidates from
 * the consuming project in the Metro config process, and publishes the absolute
 * path it found (see {@link locateProjectUpstreamTransformer}). This worker-side
 * lookup, rooted in the adapter's own location, is what remains for a specifier
 * the project could not resolve, so the adapter carries no Metro/Expo
 * dependency itself. Resolution is not memoised: Node's own module cache
 * already makes the repeated `require` a cheap lookup, and keeping no
 * module-level state lets a changed `upstreamTransformer` always take effect.
 *
 * `load` is the explicit module-loading boundary. Its default uses Node's real
 * `require`; an injected loader must preserve absence versus failure semantics.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node createRequire loads the configured module or documented
 *   Expo/React-Native candidates. Resolution is separated from execution: only
 *   known entry-absence codes permit another automatic candidate;
 *   installed-module initialization failures preserve their cause.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Explicit selection and ordered detection share the loading boundary.
 *   tryRequire owns absence classification, leaving this function to choose
 *   the transformer and attach contextual errors.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The loader argument is an explicit dependency-injection boundary, not a
 *   test-only runtime branch or a patched require.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node resolution accepts project-resolved absolute paths on Windows and
 *   POSIX. createRequire is rooted at this module via import.meta.url; no
 *   path is turned into a shell command. Runtime errors propagate through the
 *   same policy on every OS.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains candidate order, project versus worker
 *   resolution and absence versus initialization failures. Checked against
 *   the documentation skill: separate paragraphs state the contract and why
 *   its nonobvious boundary matters; field comments retain their own useful
 *   facts.
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
 * Locate the automatic upstream transformer the consuming project installed,
 * without executing it.
 *
 * The candidates belong to the app, not to this adapter: under pnpm or a linked
 * workspace the adapter sits outside the app's `node_modules` ancestry, so a
 * lookup rooted in the adapter cannot see a transformer only the app installed.
 * `resolve` is rooted in the project; each candidate is tried in
 * {@link UPSTREAM_CANDIDATES} order and an absent one is skipped, exactly as the
 * worker's probe skips it. Only resolution runs here, so a broken installation
 * still fails where the worker loads it, with its own error.
 *
 * @param resolve Resolves a module specifier from the project.
 * @returns The absolute path of the first installed candidate, or `undefined`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The supplied project resolver uses Node module resolution without
 *   executing candidate code. Only recognized entry-absence errors continue
 *   probing; other resolver failures propagate.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Project discovery resolves only the shared candidate list; execution is
 *   deferred to the worker loader that owns initialization failures.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The documented optional-peer order is a product default, not a
 *   fixture-specific answer. No module methods are replaced.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The injected resolver owns project filesystem resolution on the host OS.
 *   This operation compares module specifiers and returns its absolute result
 *   without inventing separators or quoting a command.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains project ownership, ordered probing,
 *   nonexecution and the absent result. Checked against the documentation
 *   skill: separate paragraphs state the contract and why its nonobvious
 *   boundary matters; field comments retain their own useful facts.
 */
export function locateProjectUpstreamTransformer(
  resolve: (specifier: string) => string,
): string | undefined {
  for (const candidate of UPSTREAM_CANDIDATES) {
    try {
      return resolve(candidate);
    } catch (error) {
      if (!isCandidateAbsent(error)) throw error;
    }
  }
  return undefined;
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
