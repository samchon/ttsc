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
 * contract and tsconfig discovery are identical to the bundler integrations.
 * Its per-worker cache has no build-start signal and therefore validates every
 * generation hit. Cross-file invalidation also rides the project fingerprint
 * {@link getCacheKey} folds into Metro's static transformer key (see
 * `core/fingerprint.ts`).
 */
import {
  createTtscTransformCache,
  isTransformTarget,
  resolveOptions,
  transformTtsc,
} from "@ttsc/unplugin/api";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

import {
  computeProjectFingerprint,
  createSnapshotRecorder,
  resolveProjectView,
  stableStringify,
} from "./core/fingerprint";
import type { ResolvedTtscMetroOptions } from "./core/options";
import { resolveOptionsFromEnv } from "./core/options";
import { resolveUpstreamTransformer } from "./core/upstream";

const nodeRequire = createRequire(import.meta.url);

/**
 * Per-worker singletons. Metro loads this module once per worker process and
 * reuses it across every file that worker handles, so the resolved options, the
 * transform cache, and the memoised `@ttsc/unplugin` options are all scoped to
 * the worker.
 */
let resolved: ResolvedTtscMetroOptions | undefined;
let unpluginOptions: ReturnType<typeof resolveOptions> | undefined;
const cache = createTtscTransformCache();
let snapshotRecorder: ReturnType<typeof createSnapshotRecorder> | undefined;

/** Lazily resolve the worker-side options (from {@link resolveOptionsFromEnv}). */
function options(): ResolvedTtscMetroOptions {
  return (resolved ??= resolveOptionsFromEnv());
}

/** The recorder bound to the private run identity inherited by this worker. */
function recorder(): ReturnType<typeof createSnapshotRecorder> {
  const opts = options();
  return (snapshotRecorder ??= createSnapshotRecorder(opts.snapshotRunId));
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
  {
    unpluginOptions ??= resolveOptions(opts.ttsc);
    const projectRoot =
      typeof params.options.projectRoot === "string"
        ? params.options.projectRoot
        : undefined;
    const explicitProject =
      typeof opts.ttsc.project === "string" ? opts.ttsc.project : undefined;
    const filename = resolveAbsoluteFilename(params.filename, params.options);
    const project = resolveProjectView({
      compilerOptions: opts.ttsc.compilerOptions,
      explicitProject,
      filename,
      projectRoot,
    });
    // Freeze the implicit selection made above into this call. Re-running
    // discovery inside the transform after a config candidate changes would
    // attach one project's recorder evidence to another project's compiler
    // output.
    const transformOptions = {
      ...unpluginOptions,
      project: project.tsconfig,
    };
    const result = await transformTtsc(
      filename,
      params.src,
      transformOptions,
      undefined,
      cache,
      {
        // Metro offers no per-file dependency registration, so the derived
        // watch inputs (plugin-reported dependencies unioned with the
        // reference graph's reach, globals, and configs) feed the snapshot
        // that the next run's getCacheKey re-hashes instead. Fires on cache
        // hits too, so a worker that never recompiled still records the
        // inputs backing the outputs it serves.
        // The project view is resolved once for this file and handed to every
        // one of its watch inputs. `record` runs per input, and validating the
        // memo means stat-ing the whole `extends` chain, which is an answer
        // that cannot change between two inputs of one file
        // (samchon/ttsc#1316).
        addWatchFiles: (inputs) =>
          recorder().recordMany({
            inputs: [...project.discoveryInputs, ...inputs],
            project,
          }),
        // A volatile declaration means the output depends on non-file inputs
        // that no file fingerprint can represent; the snapshot marks it and
        // getCacheKey degrades to a per-run nonce (no cross-run reuse).
        markVolatile: () => recorder().recordVolatile({ project }),
      },
    );
    // A file the program does not contain comes back as `undefined` from the
    // shared transform, exactly as an unchanged one does, so it passes through
    // here with no special case. That decision belongs to
    // `@ttsc/unplugin`'s core and is shared with every bundler adapter; this
    // transformer used to hold its own copy of it, recognising the case by
    // searching the error text for "did not return output" while the adapters
    // failed the build for the identical condition (samchon/ttsc#1308).
    // Genuine compile and type failures still propagate so Metro surfaces them.
    if (result !== undefined && typeof result.code === "string") {
      transformedSrc = result.code;
    }
  }

  return upstream.transform({ ...params, src: transformedSrc });
}

/**
 * Metro transform-cache key.
 *
 * Metro calls this once per run (dev-server start or cold `metro bundle`), on
 * the main process, and folds the result into every file's per-content cache
 * key. It must therefore incorporate every input that can influence a
 * transform's output beyond the file's own content:
 *
 * - The transformer identity: package version + resolved options + the upstream
 *   transformer's own key (forwarded Metro's args, e.g. `projectRoot`, so a
 *   `babel.config.js` change still busts the cache);
 * - The project fingerprint (see `core/fingerprint.ts`): every input file under
 *   the routed project walks, every effective config source, the previous
 *   transforms' derived inputs, and the epoch that isolates a worker state
 *   differing from this run's exact main-process baseline.
 *
 * A change to any fingerprinted input re-keys every transformed file at
 * project-level granularity, forced by Metro's single static key, replacing the
 * former manual `--reset-cache` step. Resolving the upstream is deliberately
 * non-fatal here: a missing peer must not crash cache-key computation. See the
 * README "Caveats" and samchon/ttsc#721.
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
  hash.update(
    computeProjectFingerprint({
      // The same overlay `transform` hands the recorder. Both read these
      // options from `options()`, so the walk and the recorder judge one
      // project by one program (samchon/ttsc#1316).
      compilerOptions: opts.ttsc.compilerOptions,
      explicitProject:
        typeof opts.ttsc.project === "string" ? opts.ttsc.project : undefined,
      projectRoot: cacheKeyProjectRoot(args),
      runId: opts.snapshotRunId,
    }),
  );
  return hash.digest("hex");
}

/**
 * Extract Metro's `projectRoot` from the cache-key options
 * (`metro-transform-worker` calls `getCacheKey({ projectRoot,
 * enableBabelRCLookup })`). Defensive against foreign callers: anything but a
 * non-empty string yields `undefined` and the fingerprint falls back to the
 * working directory.
 */
function cacheKeyProjectRoot(args: unknown[]): string | undefined {
  const first = args[0];
  if (typeof first !== "object" || first === null) {
    return undefined;
  }
  const projectRoot = (first as Record<string, unknown>).projectRoot;
  return typeof projectRoot === "string" && projectRoot.length !== 0
    ? projectRoot
    : undefined;
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
 * sources (`.ts`/`.tsx`/`.mts`/`.cts`, excluding every declaration form)
 * qualify; `exclude` substrings win over `include`, and an empty `include`
 * means "all TypeScript". Exported for unit testing.
 */
export function shouldTransform(
  filename: string,
  opts: ResolvedTtscMetroOptions,
): boolean {
  if (!isTransformTarget(filename)) {
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

function packageVersion(): string {
  try {
    const pkg = nodeRequire("@ttsc/metro/package.json") as { version?: string };
    return pkg.version ?? "0";
  } catch {
    return "0";
  }
}
