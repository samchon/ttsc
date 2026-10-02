import type {
  ResolvedTtscMetroOptions,
  TtscMetroOptions,
} from "./TtscMetroOptions";

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
 * @evidence contracts/common.md#principled-implementation
 *   JSON.stringify and object spread encode the declared worker transport.
 *   JSON failures propagate rather than inventing a successful payload.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A single serializer owns the config-to-worker payload. Publication stays
 *   with withTtsc, so encoding has no environment side effect.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A supplied private run identity overrides that transport field; this
 *   operation returns bytes and does not replace process methods, loader
 *   internals or caller options.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains the JSON payload, supplied run identity and
 *   serialization failure boundary. Checked against the documentation skill:
 *   separate paragraphs state the contract and why its nonobvious boundary
 *   matters; field comments retain their own useful facts.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Returns a string and keeps no state or handle.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   One JSON.stringify of the user's small options record per config load.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Runs once per Metro config load; there is no repeated work to share.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   JSON.stringify escapes backslashes, so a Windows path in the options
 *   round-trips; no path is interpreted.
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
 * Reads {@link ENV_KEY}; when it is unset or contains invalid JSON or a
 * non-object payload, the adapter falls back to defaults: auto-discover
 * `tsconfig.json` and read its configured plugins. This is the standard ttsc
 * behaviour for a project that called `withTtsc(config)` with no explicit
 * options.
 *
 * A present `plugins` property is forwarded even when its value is `false`;
 * omission leaves plugin selection to the project. The `include` and `exclude`
 * arrays retain only string entries, while invalid array values become empty
 * filters. Only a non-empty string is accepted as the private run identity.
 *
 * @evidence contracts/common.md#principled-implementation
 *   JSON.parse reads the adapter-owned environment channel. The parser accepts
 *   only object payloads, filters include/exclude to strings and preserves
 *   plugins field presence so false differs from omission.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One reconstruction function separates transport parsing and string-array
 *   normalization from the resolved object workers consume.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Invalid JSON and non-object payloads use documented defaults, not a failed
 *   compiler fallback; this parser patches no global APIs.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains absent, invalid-JSON and non-object defaults,
 *   plugin-presence semantics and filter normalization. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Returns a fresh object and keeps no state or handle.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   One JSON.parse and a filter over the short include and exclude arrays.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The transformer calls it once per worker and memoises the result in options().
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Reads one environment variable as JSON and resolves no path.
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
