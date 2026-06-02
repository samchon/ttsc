import path from "node:path";

/**
 * Runtime context the `ttsx` parent hands to the spawned child through
 * environment variables. The child's module hooks read it to decide whether a
 * requested `.ts` belongs to the entry project (loose-compiled with the entry's
 * config and run at source identity) or to a dependency package (compiled into
 * that package's own cache), and which tsgo binary to reuse.
 */
export interface RuntimeEnv {
  /** Entry project root as it exists at runtime (inside the virtual mirror). */
  readonly entryRoot: string;
  /**
   * Entry project root on the real filesystem (a symlinked source dir's
   * realpath escapes the mirror, so both anchors classify entry sources).
   */
  readonly entryRealRoot: string;
  /** Resolved tsconfig used for the entry compile gate. */
  readonly entryTsconfig: string;
  /** Source root (rootDir) the entry graph was emitted relative to. */
  readonly entrySourceRoot: string;
  /** Directory the entry graph was emitted into (mirrors the source layout). */
  readonly entryEmitDir: string;
  /** Module format the entry project emits (`commonjs` or `module`). */
  readonly entryModuleFormat: "commonjs" | "module";
  /** Explicit tsgo binary to reuse for dependency/loose builds, if any. */
  readonly tsgoBinary: string | undefined;
  /** Plugin binary cache root shared with the entry build, if any. */
  readonly cacheDir: string | undefined;
  /** True when the entry was built with plugin discovery disabled. */
  readonly noPlugins: boolean;
}

/** Environment variable names used to carry {@link RuntimeEnv} to the child. */
export const RUNTIME_ENV_KEYS = {
  entryRoot: "TTSC_TTSX_ENTRY_ROOT",
  entryRealRoot: "TTSC_TTSX_ENTRY_REAL_ROOT",
  entryTsconfig: "TTSC_TTSX_ENTRY_TSCONFIG",
  entrySourceRoot: "TTSC_TTSX_ENTRY_SOURCE_ROOT",
  entryEmitDir: "TTSC_TTSX_ENTRY_EMIT_DIR",
  entryModuleFormat: "TTSC_TTSX_ENTRY_MODULE_FORMAT",
  tsgoBinary: "TTSC_TTSX_TSGO_BINARY",
  cacheDir: "TTSC_TTSX_CACHE_DIR",
  noPlugins: "TTSC_TTSX_NO_PLUGINS",
} as const;

/** Serialize a {@link RuntimeEnv} into the child process environment map. */
export function toEnvRecord(runtime: RuntimeEnv): Record<string, string> {
  const record: Record<string, string> = {
    [RUNTIME_ENV_KEYS.entryRoot]: runtime.entryRoot,
    [RUNTIME_ENV_KEYS.entryRealRoot]: runtime.entryRealRoot,
    [RUNTIME_ENV_KEYS.entryTsconfig]: runtime.entryTsconfig,
    [RUNTIME_ENV_KEYS.entrySourceRoot]: runtime.entrySourceRoot,
    [RUNTIME_ENV_KEYS.entryEmitDir]: runtime.entryEmitDir,
    [RUNTIME_ENV_KEYS.entryModuleFormat]: runtime.entryModuleFormat,
  };
  if (runtime.tsgoBinary !== undefined) {
    record[RUNTIME_ENV_KEYS.tsgoBinary] = runtime.tsgoBinary;
  }
  if (runtime.cacheDir !== undefined) {
    record[RUNTIME_ENV_KEYS.cacheDir] = runtime.cacheDir;
  }
  if (runtime.noPlugins) {
    record[RUNTIME_ENV_KEYS.noPlugins] = "1";
  }
  return record;
}

let cached: RuntimeEnv | null | undefined;

/**
 * Read the {@link RuntimeEnv} from `process.env`, or `null` when the current
 * process was not launched as a ttsx runtime child (e.g. a plain `node` worker
 * that merely inherited unrelated environment). The result is memoized.
 */
export function readRuntimeEnv(): RuntimeEnv | null {
  if (cached !== undefined) {
    return cached;
  }
  const entryRoot = process.env[RUNTIME_ENV_KEYS.entryRoot];
  const entryTsconfig = process.env[RUNTIME_ENV_KEYS.entryTsconfig];
  const entrySourceRoot = process.env[RUNTIME_ENV_KEYS.entrySourceRoot];
  const entryEmitDir = process.env[RUNTIME_ENV_KEYS.entryEmitDir];
  if (
    entryRoot === undefined ||
    entryTsconfig === undefined ||
    entrySourceRoot === undefined ||
    entryEmitDir === undefined
  ) {
    cached = null;
    return cached;
  }
  cached = {
    entryRoot: path.resolve(entryRoot),
    entryRealRoot: path.resolve(
      process.env[RUNTIME_ENV_KEYS.entryRealRoot] ?? entryRoot,
    ),
    entryTsconfig: path.resolve(entryTsconfig),
    entrySourceRoot: path.resolve(entrySourceRoot),
    entryEmitDir: path.resolve(entryEmitDir),
    entryModuleFormat:
      process.env[RUNTIME_ENV_KEYS.entryModuleFormat] === "module"
        ? "module"
        : "commonjs",
    tsgoBinary: process.env[RUNTIME_ENV_KEYS.tsgoBinary] || undefined,
    cacheDir: process.env[RUNTIME_ENV_KEYS.cacheDir] || undefined,
    noPlugins: process.env[RUNTIME_ENV_KEYS.noPlugins] === "1",
  };
  return cached;
}
