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
 *
 * The adapter passes no `watching` declaration in its hooks, so a project whose
 * plugin observations are unavailable (a generation the core can only serve
 * fresh) fails the transform with an explicit error instead of caching it: the
 * core refuses fresh-only output unless the host states it is not watching.
 */
import {
  createTtscTransformCache,
  isTransformTarget,
  readTtscTransformSession,
  resolveOptions,
  shareTtscTransformCache,
  transformTtsc,
} from "@ttsc/unplugin/api";
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

import {
  computeProjectFingerprint,
  createSnapshotRecorder,
  resolveProjectView,
  stableStringify,
} from "./core/fingerprint";
import type { ResolvedTtscMetroOptions } from "./core/TtscMetroOptions";
import { resolveOptionsFromEnv } from "./core/options";
import { remapAstLocations } from "./core/remapAstLocations";
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
// Metro's workers share each compile through the session `withTtsc` opened
// (samchon/ttsc#1390).
shareTtscTransformCache(cache, readTtscTransformSession());
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
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node path.isAbsolute/path.resolve implement Metro's filename contract.
 *   Absolute input is retained; relative input is anchored at supplied
 *   projectRoot, with cwd only for callers lacking that option.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns the single relative-to-absolute boundary, keeping Metro's
 *   original filename separate from the compiler address.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   This operation chooses a base and delegates native path resolution;
 *   it owns no input collection or processing strategy.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   It maps one filename and supplied options without shared computation.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The returned path transfers to its caller; no resource is retained.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   This correct owning anchor avoids monorepo misrouting without matching
 *   error text or special-casing fixture names.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node path handles native separators, roots and drive letters. No URLs or
 *   shell commands are mixed with filenames and no filesystem is changed.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains the project-relative input, absolute result and
 *   cwd fallback reason. Checked against the documentation skill: separate
 *   paragraphs state the contract and why its nonobvious boundary matters;
 *   field comments retain their own useful facts.
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
 * ttsc-transformed source. When the adapter returns a source map for that
 * source, the upstream AST's locations are moved back through it to the
 * author's lines, because Metro maps the AST against the file it read
 * (samchon/ttsc#1392).
 *
 * An explicit `project` option selects its tsconfig. Otherwise the adapter
 * discovers the nearest tsconfig from the file's absolute path, using Metro's
 * `projectRoot` or the current working directory to resolve a relative file.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Metro's transformer callback composes the shared Unplugin transform core
 *   with the selected Babel transformer. One resolved project view is frozen
 *   into compilation and recorder inputs. Noneligible or out-of-program files
 *   follow the shared core contract; genuine compiler/load failures propagate.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The entry point gates delivery, freezes one project view for compilation
 *   and recording, then delegates to Babel. Shared core helpers own checking
 *   and caching; the adapter owns only Metro transport and AST remapping.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Filtering runs before compilation. Eligible deliveries resolve one view
 *   and record their inputs in a single batch; compiler and AST traversal
 *   costs belong to their delegated owners rather than repeated per input.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The worker's shared transform cache validates project state on each hit,
 *   while the inherited session shares compilation across workers. The same
 *   project view and options feed compilation and generation recording; Babel
 *   is invoked for the actual delivery and is not memoized by this adapter.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Worker singletons own resolved options, the transform cache and recorder
 *   until process termination. The shared core owns cached generations and
 *   session storage; the recorder owns its cumulative paths. This entry point
 *   exposes no disposal signal from Metro and does not claim a fixed byte bound.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Only the returned AST's owned locations are updated, with no patched
 *   loader or test-specific production behavior.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Metro-relative filenames drive substring filters; Node path.resolve
 *   produces absolute compiler addresses. The shared core owns native
 *   compiler/session access, while Babel retains the original filename.
 *   Worker transport is JSON and no shell command is constructed here.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains pass order, original parameter preservation,
 *   project selection and AST location mutation. Checked against the
 *   documentation skill: separate paragraphs state the contract and why its
 *   nonobvious boundary matters; field comments retain their own useful
 *   facts.
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
  let transformedMap: { mappings: string; sources: string[] } | undefined;
  let absoluteFilename = params.filename;
  {
    unpluginOptions ??= resolveOptions(opts.ttsc);
    const projectRoot =
      typeof params.options.projectRoot === "string"
        ? params.options.projectRoot
        : undefined;
    const explicitProject =
      typeof opts.ttsc.project === "string" ? opts.ttsc.project : undefined;
    const filename = resolveAbsoluteFilename(params.filename, params.options);
    absoluteFilename = filename;
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
      transformedMap = result.map;
    }
  }

  const output = await upstream.transform({ ...params, src: transformedSrc });
  // Metro maps the returned AST against the file it read, so the upstream's
  // positions in the transformed text are moved back to the author's lines.
  if (transformedMap !== undefined) {
    remapAstLocations(output.ast, transformedMap, absoluteFilename);
  }
  return output;
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
 * non-fatal here: a missing peer must not crash cache-key computation, but a
 * failed upstream key withdraws reuse with a nonce. See the
 * README "Caveats" and samchon/ttsc#721.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node sha256 combines package identity, stable resolved options, forwarded
 *   upstream key and the project fingerprint required by Metro's
 *   one-static-key contract. Failed upstream loads or callbacks contribute a
 *   nonce; an absent optional callback contributes no additional key.
 *   Forwarded compiler and plugin records retain their JSON property order
 *   because the compiler or a plugin can give that order semantic meaning.
 *   Fingerprint failure disables reuse through a nonce rather
 *   than fabricating a proven generation.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One hash assembly combines options, upstream contribution and the project
 *   fingerprint. The fingerprint owner handles persistence and validity;
 *   cacheKeyProjectRoot extracts Metro's argument without duplicating discovery.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   One static key per Metro run hashes encoded options, the upstream key
 *   and one project fingerprint. Key assembly is linear in their string bytes;
 *   the fingerprint owner accounts for project scans and config traversal.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Options, adapter version, upstream key and exact project state contribute
 *   to the shared key. Project observation failures withdraw reuse through a
 *   nonce. A failing upstream load or key uses a nonce too, preserving the
 *   nonfatal keying boundary without pretending its external state is known.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The hash is local to this call. Worker singletons are owned by transform
 *   and persisted baseline files by prepareSnapshot, not the hash assembler.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native project roots are interpreted by the fingerprint owner and Node
 *   module loading reads package identity. Hash input has deterministic
 *   string representation across OSes; filesystem content and identity remain
 *   deliberately host-specific.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains one key per run, all contributions,
 *   project-wide invalidation and nonfatal upstream key policy. Checked
 *   against the documentation skill: separate paragraphs state the contract
 *   and why its nonobvious boundary matters; field comments retain their own
 *   useful facts.
 */
export function getCacheKey(...args: unknown[]): string {
  const opts = options();
  const hash = createHash("sha256");
  hash.update(`@ttsc/metro:${packageVersion()}`);
  hash.update(
    stableStringify({
      ttsc: JSON.stringify(opts.ttsc),
      include: opts.include,
      exclude: opts.exclude,
      upstreamTransformer: opts.upstreamTransformer ?? null,
    }),
  );
  const upstreamKey = upstreamCacheKey(opts.upstreamTransformer, args);
  hash.update(upstreamKey ?? `nonce:${randomBytes(32).toString("hex")}`);
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
 * `getCacheKey` yields `undefined`, withdrawing cross-run reuse without
 * failing the whole build's cache keying. An absent optional callback still
 * contributes the empty string.
 */
function upstreamCacheKey(
  upstreamTransformer: string | undefined,
  args: unknown[],
): string | undefined {
  let upstream;
  try {
    upstream = resolveUpstreamTransformer(upstreamTransformer);
  } catch {
    return undefined;
  }
  if (upstream.getCacheKey === undefined) {
    return "";
  }
  try {
    return String(upstream.getCacheKey(...args) ?? "");
  } catch {
    return undefined;
  }
}

/**
 * Decide whether a file should run through the ttsc pass. Only TypeScript
 * sources (`.ts`/`.tsx`/`.mts`/`.cts`, excluding every declaration form)
 * qualify, and a file below a `node_modules` directory never does, whatever
 * `include` says, because the shared `isTransformTarget` predicate rejects it
 * first. `exclude` substrings win over `include`, and an empty `include` means
 * "all eligible TypeScript". Patterns use the supplied project-relative
 * filename literally; this operation does not normalize separators or
 * filesystem case.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared isTransformTarget predicate owns supported TypeScript
 *   extensions, declaration exclusions, virtual-module and node_modules
 *   exclusions. Literal substring filters apply to Metro's project-relative
 *   filename, with exclusion taking precedence.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This predicate orders extension eligibility, exclusion and inclusion as
 *   early returns. Compiler execution remains outside the filtering policy.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Extension matching precedes substring scans; exclusion returns early and
 *   inclusion stops at its first match. Cost follows pattern count and supplied
 *   filename length without allocating a normalized copy for literal matching.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This inexpensive predicate coordinates no shared computation and accepts
 *   caller-owned, potentially mutable option arrays.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Filtering retains no caller data and opens no native resource.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   This pure decision neither invokes compilation nor mutates options, and
 *   has no fixture or test-mode branch.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This predicate matches TypeScript extensions and caller-supplied literal
 *   substrings. It defines no filesystem identity or native path
 *   normalization contract.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc explains eligible extensions, declaration and
 *   node_modules exclusion, empty include and exclusion precedence. Checked
 *   against the documentation skill: separate paragraphs state the contract
 *   and why its nonobvious boundary matters; field comments retain their own
 *   useful facts.
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
