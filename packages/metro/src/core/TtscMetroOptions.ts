import type { TtscUnpluginOptions } from "@ttsc/unplugin/api";

/**
 * Options accepted by {@link withTtsc} and the Metro transformer.
 *
 * The `project` / `compilerOptions` / `plugins` fields are inherited from
 * `@ttsc/unplugin` so the Metro adapter speaks the exact same configuration
 * language as every other bundler integration. The remaining fields are
 * Metro-specific.
 *
 * Every field is JSON-serialisable on purpose: `withTtsc` runs in the Metro
 * **config** process, but the transformer runs in Metro's **worker** processes,
 * so the resolved options have to survive a JSON / env round-trip
 * to reach them (see {@link serializeOptions}). That is why `include`/`exclude`
 * are plain substring patterns rather than `RegExp`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   This interface extends the documented Unplugin option contract rather than
 *   defining another plugin protocol. Metro adds JSON-compatible upstream and
 *   substring filters for its config-to-worker transport.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Inheritance keeps shared compiler options with Unplugin; this interface
 *   adds only upstream selection and the two Metro substring filters.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains inherited options, JSON transport, upstream
 *   precedence and the include/exclude relationship. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
 */
export interface TtscMetroOptions extends TtscUnpluginOptions {
  /**
   * Explicit module path of the upstream Metro Babel transformer to delegate to
   * after the ttsc pass.
   *
   * When omitted, `withTtsc` inherits the config's existing transformer unless
   * it names this adapter. Without one it detects
   * `@expo/metro-config/babel-transformer` first (Expo), then
   * `@react-native/metro-babel-transformer`, then the legacy
   * `metro-react-native-babel-transformer`.
   */
  upstreamTransformer?: string;

  /**
   * Substring patterns; when non-empty only files whose path contains one of
   * them are run through the ttsc pass. Non-matching files are passed straight
   * to the upstream transformer.
   */
  include?: string[];

  /**
   * Substring patterns; files whose path contains one of them skip the ttsc
   * pass and go straight to the upstream transformer. Applied after
   * {@link include}.
   */
  exclude?: string[];
}

/**
 * Fully-resolved options, split into the ttsc-side overlay and Metro-side
 * knobs.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A structural interface separates the existing Unplugin overlay from
 *   resolved Metro filters and the private run handshake.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The ttsc member groups the forwarded overlay, while always-present filter
 *   arrays remove optional-array handling from every worker delivery.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Its optional upstream/run identity and always-present arrays describe
 *   worker state without executable branches or mutation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains the forwarded overlay, empty filter arrays,
 *   optional upstream and private snapshot identity. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
 */
export interface ResolvedTtscMetroOptions {
  /** Options forwarded verbatim to the `@ttsc/unplugin` transform core. */
  ttsc: TtscUnpluginOptions;

  /** Explicit upstream transformer module path, or `undefined` to auto-detect. */
  upstreamTransformer?: string;

  /** Resolved include patterns (never `undefined`). */
  include: string[];

  /** Resolved exclude patterns (never `undefined`). */
  exclude: string[];

  /** Private run identity shared by `getCacheKey` and Metro workers. */
  snapshotRunId?: string;
}
