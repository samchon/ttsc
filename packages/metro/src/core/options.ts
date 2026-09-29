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
 * @evidence contracts/common.md#standard-implementation-practices
 *   This interface extends the documented Unplugin option contract rather than
 *   defining another plugin protocol. Metro adds JSON-compatible upstream and
 *   substring filters for its config-to-worker transport.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This declaration defines or transports JSON-compatible option values.
 *   Native project and module resolution belong to the separate compiler and
 *   upstream loader operations; literal filters define no filesystem identity
 *   contract.
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
 * @evidence contracts/common.md#standard-implementation-practices
 *   A structural interface separates the existing Unplugin overlay from
 *   resolved Metro filters and the private run handshake.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Its optional upstream/run identity and always-present arrays describe
 *   worker state without executable branches or mutation.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This declaration defines or transports JSON-compatible option values.
 *   Native project and module resolution belong to the separate compiler and
 *   upstream loader operations; literal filters define no filesystem identity
 *   contract.
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

/**
 * Environment variable that carries the resolved options from the Metro config
 * process to the worker processes.
 *
 * Metro forks its transform workers (jest-worker) from the process that loaded
 * `metro.config.js`, so a variable set on `process.env` before Metro boots is
 * inherited by every worker. This is the only channel `withTtsc`'s arguments
 * can reach the transformer through: the worker never sees the `withTtsc`
 * call.
 */
export const ENV_KEY = "TTSC_METRO_OPTIONS";

/**
 * Serialise user options for transport to the worker processes via
 * {@link ENV_KEY}.
 *
 * A supplied private run identity is written into the payload. This function
 * returns JSON without publishing the environment variable or mutating options.
 * Values must be JSON-serialisable; serialization errors propagate.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   JSON.stringify and object spread encode the declared worker transport.
 *   JSON failures propagate rather than inventing a successful payload.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A supplied private run identity overrides that transport field; this
 *   operation returns bytes and does not replace process methods, loader
 *   internals or caller options.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This declaration defines or transports JSON-compatible option values.
 *   Native project and module resolution belong to the separate compiler and
 *   upstream loader operations; literal filters define no filesystem identity
 *   contract.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains the JSON payload, supplied run identity and
 *   serialization failure boundary. Checked against the documentation skill:
 *   separate paragraphs state the contract and why its nonobvious boundary
 *   matters; field comments retain their own useful facts.
 */
export function serializeOptions(
  options: TtscMetroOptions,
  snapshotRunId?: string,
): string {
  return JSON.stringify({
    ...(options ?? {}),
    ...(snapshotRunId === undefined ? {} : { __snapshotRunId: snapshotRunId }),
  });
}

/**
 * Reconstruct the resolved options inside a worker process.
 *
 * Reads {@link ENV_KEY}; when it is unset or malformed the adapter falls back to
 * defaults, which means "auto-discover `tsconfig.json` and read its configured
 * plugins", the standard ttsc behaviour, and the right thing for a project that
 * called `withTtsc(config)` with no explicit options.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   JSON.parse reads the adapter-owned environment channel. The parser accepts
 *   only object payloads, filters include/exclude to strings and preserves
 *   plugins field presence so false differs from omission.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Invalid transport uses documented defaults, not a failed compiler
 *   fallback; it patches no global APIs.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This declaration defines or transports JSON-compatible option values.
 *   Native project and module resolution belong to the separate compiler and
 *   upstream loader operations; literal filters define no filesystem identity
 *   contract.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains absent/malformed payload defaults,
 *   plugin-presence semantics and filter normalization. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
 */
export function resolveOptionsFromEnv(): ResolvedTtscMetroOptions {
  const raw = process.env[ENV_KEY];
  const parsed = parse(raw);
  return {
    ttsc: {
      project: parsed.project,
      compilerOptions: parsed.compilerOptions,
      ...("plugins" in parsed ? { plugins: parsed.plugins } : {}),
    },
    upstreamTransformer:
      typeof parsed.upstreamTransformer === "string"
        ? parsed.upstreamTransformer
        : undefined,
    include: toStringArray(parsed.include),
    exclude: toStringArray(parsed.exclude),
    ...(typeof parsed.__snapshotRunId === "string" &&
    parsed.__snapshotRunId.length !== 0
      ? { snapshotRunId: parsed.__snapshotRunId }
      : {}),
  };
}

function parse(
  raw: string | undefined,
): TtscMetroOptions & { __snapshotRunId?: unknown } {
  if (raw === undefined || raw.length === 0) {
    return {};
  }
  try {
    const value: unknown = JSON.parse(raw);
    // Only a plain object is a valid payload; arrays, `null`, numbers, strings,
    // and booleans (all valid JSON) degrade to defaults rather than leaking a
    // wrong-shaped value downstream.
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as TtscMetroOptions & { __snapshotRunId?: unknown })
      : {};
  } catch {
    return {};
  }
}

/**
 * Coerce an untrusted env value into a `string[]`. A non-array (e.g. the common
 * mistake of passing a bare string for `include`/`exclude`) becomes `[]` so the
 * worker never calls `.some` on a non-array and crashes.
 */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
