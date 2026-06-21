/**
 * Metro custom transformer for ttsc.
 *
 * Metro loads this module via `transformer.babelTransformerPath` (wired by
 * {@link withTtsc}) and calls {@link transform} once per file. The flow is:
 *
 * TypeScript source -> ttsc plugin pass (typia, nestia, …) via @ttsc/unplugin's
 * core -> transformed TypeScript source -> upstream Expo/RN Babel transformer
 * (strips types, RN transforms) -> Babel AST (what Metro consumes)
 *
 * The ttsc pass reuses `@ttsc/unplugin`'s `transformTtsc`, so the plugin
 * contract, tsconfig discovery, and per-build cache are identical to every
 * other bundler integration. See the package README for the v1 cost model and
 * the cross-file cache-invalidation caveat.
 */
import {
  createTtscTransformCache,
  resolveOptions,
  transformTtsc,
} from "@ttsc/unplugin/api";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

import type { ResolvedTtscMetroOptions } from "./core/options";
import { resolveOptionsFromEnv } from "./core/options";
import { resolveUpstreamTransformer } from "./core/upstream";

const nodeRequire = createRequire(import.meta.url);

/**
 * Matches the TypeScript source extensions the ttsc pass handles (`.ts`,
 * `.tsx`, `.cts`, `.mts`). JavaScript and declaration files are passed straight
 * through to the upstream transformer.
 */
const TS_EXTENSION = /\.[cm]?tsx?$/;
const DECLARATION = /\.d\.[cm]?ts$/;

/**
 * Per-worker singletons. Metro loads this module once per worker process and
 * reuses it across every file that worker handles, so the resolved options, the
 * transform cache, and the memoised `@ttsc/unplugin` options are all scoped to
 * the worker.
 */
let resolved: ResolvedTtscMetroOptions | undefined;
let unpluginOptions: ReturnType<typeof resolveOptions> | undefined;
const cache = createTtscTransformCache();

/** Lazily resolve the worker-side options (from {@link resolveOptionsFromEnv}). */
function options(): ResolvedTtscMetroOptions {
  return (resolved ??= resolveOptionsFromEnv());
}

/**
 * Resolve Metro's per-file `filename` to an absolute path.
 *
 * Metro hands the babel transformer a path **relative to `projectRoot`** (it
 * reads the file via `fs.readFileSync(path.resolve(projectRoot, filename))`)
 * and passes `projectRoot` inside `options`. The ttsc pass needs an absolute
 * path that matches a key in the compiled program, so resolve against
 * `projectRoot`, never `process.cwd()`, which differs from `projectRoot` in
 * monorepos and when Metro is launched from a parent directory. Getting this
 * wrong makes every file look "outside the project" and silently skips the
 * plugin pass.
 */
export function resolveAbsoluteFilename(
  filename: string,
  options?: Record<string, unknown>,
): string {
  if (path.isAbsolute(filename)) {
    return filename;
  }
  const projectRoot =
    options !== undefined && typeof options.projectRoot === "string"
      ? options.projectRoot
      : process.cwd();
  return path.resolve(projectRoot, filename);
}

/**
 * Metro transform entry point.
 *
 * Runs the ttsc plugin pass on TypeScript files, then delegates to the upstream
 * Expo/React-Native Babel transformer to produce the AST Metro expects. The
 * upstream call receives Metro's original params (notably the project-relative
 * `filename`, which Babel expects); only `src` is replaced with the
 * ttsc-transformed source.
 */
export async function transform(params: {
  src: string;
  filename: string;
  options: Record<string, unknown>;
  [key: string]: unknown;
}): Promise<{ ast: object }> {
  const opts = options();
  const upstream = resolveUpstreamTransformer(opts.upstreamTransformer);

  // Gate on the project-relative path Metro supplies, so include/exclude
  // substrings match what the user writes (e.g. "src/generated") and never
  // collide with an absolute ancestor directory name. The absolute path is used
  // only to address the file inside the compiled program.
  if (!shouldTransform(params.filename, opts)) {
    return upstream.transform(params);
  }

  let transformedSrc = params.src;
  try {
    unpluginOptions ??= resolveOptions(opts.ttsc);
    const result = await transformTtsc(
      resolveAbsoluteFilename(params.filename, params.options),
      params.src,
      unpluginOptions,
      undefined,
      cache,
    );
    if (result !== undefined && typeof result.code === "string") {
      transformedSrc = result.code;
    }
  } catch (error) {
    // A file that is not part of the tsconfig program is not a build error,
    // pass it through untransformed. Genuine compile/type failures propagate so
    // Metro surfaces them, matching the other ttsc bundler integrations.
    if (!isFileOutsideProject(error)) {
      throw error;
    }
  }

  return upstream.transform({ ...params, src: transformedSrc });
}

/**
 * Metro transform-cache key.
 *
 * Metro already content-hashes each file, so this only has to invalidate when
 * the transformer itself changes: package version + resolved options + the
 * upstream transformer's own key (forwarded Metro's args, e.g. `projectRoot`,
 * so a `babel.config.js` change still busts the cache). Resolving the upstream
 * is deliberately non-fatal here: a missing peer must not crash cache-key
 * computation. NOTE: this does not encode the tsconfig / plugin configuration
 * or cross-file type dependencies, so after editing those (or a depended-upon
 * type) run Metro with `--reset-cache`. See the README "Caveats" and
 * samchon/ttsc#255.
 */
export function getCacheKey(...args: unknown[]): string {
  const opts = options();
  const hash = createHash("sha256");
  hash.update(`@ttsc/metro:${packageVersion()}`);
  hash.update(
    stableStringify({
      ttsc: opts.ttsc,
      include: opts.include,
      exclude: opts.exclude,
      upstreamTransformer: opts.upstreamTransformer ?? null,
    }),
  );
  const upstreamKey = upstreamCacheKey(opts.upstreamTransformer, args);
  if (upstreamKey.length !== 0) {
    hash.update(upstreamKey);
  }
  return hash.digest("hex");
}

/**
 * Fold the upstream transformer's cache key in, defensively. Forwards Metro's
 * own `getCacheKey` arguments so the upstream's babelrc-derived key is
 * preserved, and never throws: a missing peer or a throwing upstream
 * `getCacheKey` yields an empty contribution rather than failing the whole
 * build's cache keying.
 */
function upstreamCacheKey(
  upstreamTransformer: string | undefined,
  args: unknown[],
): string {
  let upstream;
  try {
    upstream = resolveUpstreamTransformer(upstreamTransformer);
  } catch {
    return "";
  }
  if (upstream.getCacheKey === undefined) {
    return "";
  }
  try {
    return String(upstream.getCacheKey(...args) ?? "");
  } catch {
    return "";
  }
}

/**
 * Decide whether a file should run through the ttsc pass. Only TypeScript
 * sources (`.ts`/`.tsx`/`.cts`/`.mts`, excluding `.d.ts`) qualify; `exclude`
 * substrings win over `include`, and an empty `include` means "all TypeScript".
 * Exported for unit testing.
 */
export function shouldTransform(
  filename: string,
  opts: ResolvedTtscMetroOptions,
): boolean {
  if (!TS_EXTENSION.test(filename) || DECLARATION.test(filename)) {
    return false;
  }
  if (opts.exclude.some((pattern) => filename.includes(pattern))) {
    return false;
  }
  if (
    opts.include.length !== 0 &&
    !opts.include.some((pattern) => filename.includes(pattern))
  ) {
    return false;
  }
  return true;
}

/**
 * `transformTtsc` throws `"ttsc transform did not return output for <file>"`
 * when the requested file is not part of the compiled program (e.g. excluded
 * from the tsconfig). That case is non-fatal: the file should pass through.
 */
function isFileOutsideProject(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("did not return output");
}

function packageVersion(): string {
  try {
    const pkg = nodeRequire("@ttsc/metro/package.json") as { version?: string };
    return pkg.version ?? "0";
  } catch {
    return "0";
  }
}

/**
 * JSON-serialise with object keys sorted recursively, so two semantically equal
 * option sets always hash to the same cache key regardless of property order.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
