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
 * so the resolved options have to survive a structured-clone / env round-trip
 * to reach them (see {@link serializeOptions}). That is why `include`/`exclude`
 * are plain substring patterns rather than `RegExp`.
 */
export interface TtscMetroOptions extends TtscUnpluginOptions {
  /**
   * Explicit module path of the upstream Metro Babel transformer to delegate to
   * after the ttsc pass.
   *
   * When omitted it is auto-detected: `@expo/metro-config/babel-transformer`
   * first (Expo), then `@react-native/metro-babel-transformer`, then the legacy
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
 */
export function serializeOptions(options: TtscMetroOptions): string {
  return JSON.stringify(options ?? {});
}

/**
 * Reconstruct the resolved options inside a worker process.
 *
 * Reads {@link ENV_KEY}; when it is unset or malformed the adapter falls back to
 * defaults, which means "auto-discover `tsconfig.json` and read its configured
 * plugins", the standard ttsc behaviour, and the right thing for a project that
 * called `withTtsc(config)` with no explicit options.
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
  };
}

function parse(raw: string | undefined): TtscMetroOptions {
  if (raw === undefined || raw.length === 0) {
    return {};
  }
  try {
    const value: unknown = JSON.parse(raw);
    // Only a plain object is a valid payload; arrays, `null`, numbers, strings,
    // and booleans (all valid JSON) degrade to defaults rather than leaking a
    // wrong-shaped value downstream.
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as TtscMetroOptions)
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
