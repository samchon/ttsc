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
 * Metro transform entry point.
 *
 * Runs the ttsc plugin pass on TypeScript files, then delegates to the upstream
 * Expo/React-Native Babel transformer to produce the AST Metro expects. All
 * original Metro params are forwarded to the upstream call; only `src` is
 * replaced with the ttsc-transformed source.
 */
export async function transform(params: {
  src: string;
  filename: string;
  options: Record<string, unknown>;
  [key: string]: unknown;
}): Promise<{ ast: object }> {
  const opts = options();
  const upstream = resolveUpstreamTransformer(opts.upstreamTransformer);

  if (!shouldTransform(params.filename, opts)) {
    return upstream.transform(params);
  }

  let transformedSrc = params.src;
  try {
    unpluginOptions ??= resolveOptions(opts.ttsc);
    const result = await transformTtsc(
      params.filename,
      params.src,
      unpluginOptions,
      undefined,
      cache,
    );
    if (result !== undefined && typeof result.code === "string") {
      transformedSrc = result.code;
    }
  } catch (error) {
    // A file that is not part of the tsconfig program is not a build error —
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
 * the transformer itself changes: package version + resolved options + upstream
 * key. NOTE: this does not encode the tsconfig / plugin configuration or
 * cross-file type dependencies, so after editing those (or a depended-upon
 * type) run Metro with `--reset-cache`. See the README "Caveats" section and
 * samchon/ttsc#255.
 */
export function getCacheKey(): string {
  const opts = options();
  const upstream = resolveUpstreamTransformer(opts.upstreamTransformer);

  const hash = createHash("sha256");
  hash.update(`@ttsc/metro:${packageVersion()}`);
  hash.update(
    JSON.stringify({
      ttsc: opts.ttsc,
      include: opts.include,
      exclude: opts.exclude,
      upstreamTransformer: opts.upstreamTransformer ?? null,
    }),
  );
  if (upstream.getCacheKey !== undefined) {
    hash.update(upstream.getCacheKey());
  }
  return hash.digest("hex");
}

function shouldTransform(
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
 * from the tsconfig). That case is non-fatal — the file should pass through.
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
