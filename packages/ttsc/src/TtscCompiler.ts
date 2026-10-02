import fs from "node:fs";
import path from "node:path";

import { createProcessDiagnostic } from "./compiler/internal/build/createProcessDiagnostic";
import { compileProjectInMemory } from "./compiler/internal/compileProjectInMemory";
import { resolveProjectConfig } from "./compiler/internal/project/resolveProjectConfig";
import { resolveBinary } from "./compiler/internal/resolveBinary";
import { SidecarEnvironment } from "./compiler/internal/sharedHost/SidecarEnvironment";
import { transformProjectInMemory } from "./compiler/internal/transformProjectInMemory";
import { transformProjectInWorker } from "./compiler/internal/transformProjectInWorker";
import { CompilerContextSnapshot } from "./internal/CompilerContextSnapshot";
import { type SafeCacheCleanupTarget } from "./internal/SafeCacheCleanupTarget";
import { cacheEntryExists } from "./internal/cacheEntryExists";
import { resolveSafeCacheCleanupTargets } from "./internal/resolveSafeCacheCleanupTargets";
import { serializeCompilerError } from "./internal/serializeCompilerError";
import { resolveRuntimeCleanTargets } from "./launcher/internal/runtime/resolveRuntimeCleanTargets";
import { withRuntimeDirectoryLock } from "./launcher/internal/runtime/withRuntimeDirectoryLock";
import { loadProjectPlugins } from "./plugin/internal/load/loadProjectPlugins";
import { SourceBuildCacheLayout } from "./plugin/internal/source/SourceBuildCacheLayout";
import { resolveCleanTargets } from "./plugin/internal/source/resolveCleanTargets";
import { resolveSourceBuildCachePaths } from "./plugin/internal/source/resolveSourceBuildCachePaths";
import type { ITtscCompilerContext } from "./structures/ITtscCompilerContext";
import type { ITtscCompilerDiagnostic } from "./structures/ITtscCompilerDiagnostic";
import type { ITtscCompilerResult } from "./structures/ITtscCompilerResult";
import type { ITtscCompilerTransformation } from "./structures/ITtscCompilerTransformation";
import type { TtscBuildResult } from "./structures/internal/TtscBuildResult";

/**
 * Programmatic compiler host for the `ttsc` TypeScript-Go pipeline.
 *
 * `TtscCompiler` is the root JavaScript API exported by the `ttsc` package. It
 * owns one selection policy: working-directory and project-config options,
 * native toolchain and environment overrides, a cache option and a plugin list.
 * Supplied options and plugin JSON conversion are captured by the constructor
 * and cannot be replaced per method call. Omitted defaults and relative path
 * resolution still depend on the invocation's process state, and discovery
 * observes the current filesystem.
 *
 * The class exposes only the operations that make sense for an embedded
 * compiler host:
 *
 * - {@link TtscCompiler.prepare}: build configured Go source plugins into the
 *   cache before a later compile.
 * - {@link TtscCompiler.clean}: remove the cache owned by this compiler context.
 * - {@link TtscCompiler.compile}: compile the configured project and return a
 *   structured result instead of terminal text.
 * - {@link TtscCompiler.transform}: transform the configured project and return an
 *   embed-style transformation result.
 * - {@link TtscCompiler.transformAsync}: the same transform on a worker thread,
 *   for hosts that keep serving other work meanwhile.
 *
 * Compile/transform failures use their structured envelopes; preparation and
 * cleanup instead return their path lists or throw. Worker execution moves
 * blocking transform work off-thread, while caller-side context setup, transfer
 * and result adaptation still consume calling-thread work.
 *
 * @evidence contracts/common.md#principled-implementation A constructor-owned project context fixes selectors and JSON plugin payloads while methods preserve compiler success/failure/exception distinctions; real source/native owners supply compilation rather than the class inferring validity from partial output.
 * @evidence contracts/common.md#clear-and-simple-design The public methods represent preparation, cleanup and compilation lifecycles; private helpers own context views, path bases and result adaptation, keeping selection policy stable across calls.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No caller or fixture is special-cased and no foreign compiler behavior is patched; compile/transform adapt native/plugin failures into results while prepare/clean propagate throws, preserving each operation's actual error contract.
 * @evidence contracts/common.md#meaningful-documentation Native class and method paragraphs describe project binding, captured JSON conversion, cache ownership and structured outcomes; documented members use visible separation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path APIs resolve explicit cwd/config/cache anchors, shared physical identity validates cleanup, and native environment-name lookup protects caller GOCACHE; unknown native case policy does not authorize merging missing case variants.
 * @evidence contracts/performance.md#efficient-algorithms Delegated compiler/loading/cleanup owners pay their native path, source, metadata and output work; context copying/transfer follows configured payload bytes. Result envelopes retain existing output maps rather than rescanning their files, while severity checks and fallback diagnostic formatting process diagnostic/stream data. Offloading does not remove caller setup, transfer or adaptation costs.
 * @evidence contracts/performance.md#reuse-equivalent-work The instance reuses its immutable constructor plugin serialization and downstream input-validated binary/descriptor caches; each compile still runs under current project inputs rather than reusing an unproved prior compilation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The instance retains constructor context bytes for its lifetime; captures/temporary outputs and workers keep their respective owners' release policies and limitations. Clean validates the complete candidate plan before deletion attempts, which can fail and leave partial reclamation rather than a guaranteed storage bound.
 */
export class TtscCompiler {
  private readonly context: ITtscCompilerContext;

  /**
   * Create a new compiler instance bound to the given project context.
   *
   * The context is defensively copied: mutations to the original object after
   * construction do not affect this instance. Omit `context` (or pass `{}`) to
   * inherit defaults from the running process when operations resolve them.
   *
   * Plugin JSON conversion, including custom `toJSON`, is captured once here.
   * Later operations preserve the original host selectors and use that captured
   * payload. Non-JSON-serializable plugin input fails during construction.
   */
  public constructor(context: ITtscCompilerContext = {}) {
    this.context = CompilerContextSnapshot.clone(context);
  }

  /**
   * Build every configured source plugin into the instance cache.
   *
   * This method loads the project plugin descriptors, resolves their
   * {@link ITtscPlugin.source} paths, and builds executable plugins or linked
   * hosts for those Go source packages in the ttsc cache. It is useful when a
   * host application wants to pay the lazy build cost before the first compile
   * call.
   *
   * `prepare()` is not a project check. It does not create a TypeScript-Go
   * Program, does not run diagnostics, and does not emit output files.
   *
   * @returns Compiled native plugin binary paths.
   *
   * @evidence contracts/common.md#principled-implementation Loading descriptors under resolved project anchors and building declared source plugins returns the actual resulting native binaries; preparation does not claim project diagnostic validity.
   * @evidence contracts/common.md#clear-and-simple-design One operation creates a fresh context view and delegates descriptor loading/building to their owners, returning only the binary paths relevant to preparation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin declarations are resolved through the actual loader and failures propagate; no expected binary path or fabricated successful build substitutes for compilation.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish lazy source preparation from a project check and describe its returned paths, with prose and tags separated.
   * @evidence contracts/portability.md#os-neutral-implementation Native cwd/config/cache bases are forwarded explicitly to the loader, which owns executable and path differences; this method adds no shell spelling or OS-specific installation path.
   * @evidence contracts/performance.md#efficient-algorithms Loading/building includes the loader's package resolution, descriptor evaluation, source/toolchain observations and admitted native builds; these costs follow their bytes/populations rather than one logical call. The returned N native paths are projected once, without a separate project check merely to form that list.
   * @evidence contracts/performance.md#reuse-equivalent-work Constructor JSON conversion and input-validated plugin build/descriptor caches are shared across operations; a changed source/toolchain input requires the owner's new build rather than assuming an existing path is valid.
   * @evidence contracts/performance.md#bound-retention-and-release-resources A fresh operation context transfers to loading/building and its result paths transfer to the caller; cache artifacts remain with the cache owner until clean, with no new persistent preparation registry.
   */
  public prepare(): string[] {
    const execution = this.resolveProjectExecution();
    const context = this.compilerContext();
    const loaded = loadProjectPlugins({
      binary: resolveBinary(context) ?? "",
      cacheDir: this.resolvePluginCacheDir(),
      cwd: execution.cwd,
      entries: context.plugins,
      env: this.resolveEffectiveEnv(),
      pluginConfigDir: this.context.pluginConfigDir,
      projectRoot: execution.projectRoot,
      tsconfig: execution.tsconfig,
    });
    return loaded.nativePlugins.map((plugin) => plugin.binary);
  }

  /**
   * Remove compiled cache artifacts for this compiler instance.
   *
   * Selects an explicit `cacheDir` as a whole. Otherwise removes the plugin
   * binary subdirectory, the descriptor, capability, and orphan-lowering
   * caches, the runtime directories of `ttsx` and `ttsc/register` runs whose
   * owners are provably gone (a run that may still be in progress keeps its
   * own), a safely identified ttsc-owned Go build cache (including an external
   * `TTSC_GO_CACHE_DIR`), and the two legacy project-local caches. A
   * user-provided `GOCACHE` is protected in both modes: overlapping or
   * uncertain deletion candidates are preserved. Every resolved deletion target
   * is validated before the first removal. The cache location comes from this
   * instance's `cacheDir` and environment (`TTSC_CACHE_DIR` /
   * `TTSC_GO_CACHE_DIR`), defaulting to
   * `<workspaceRoot>/node_modules/.cache/ttsc`. Any resolved cache target that
   * equals or contains the project, or names a filesystem root, is rejected
   * before any directory is removed.
   *
   * Default runtime selection uses the runtime-root lock and conservative owner
   * records. An explicit whole-cache selector is not filtered by runtime owner
   * liveness. Root discovery and metadata checks are sequential observations,
   * not a namespace snapshot: selected roots/physical parents must remain stable
   * while the operation uses its lock and deletion plan.
   *
   * @returns Cache directories that were removed.
   *
   * @evidence contracts/common.md#principled-implementation Explicit and default ownership select different cache sets, and every candidate is validated before deletion; physical overlap preserves caller GOCACHE while roots and project-containing candidates fail closed.
   * @evidence contracts/common.md#clear-and-simple-design This public operation selects the project and optional runtime lock; cleanResolved owns the complete candidate plan and the shared cleanup helper owns deletion safety across API and CLI paths.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Cache ownership follows declared selectors and observed physical identities, not fixture-specific directories. Default runtime selection preserves live/unknown ownership; an explicit whole-cache selector has its documented separate deletion meaning.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs specify explicit/default ownership, external caller cache preservation, runtime liveness and validation-before-deletion so callers can assess destructive effects.
   * @evidence contracts/portability.md#os-neutral-implementation Native resolution and shared identity handle aliases and volume roots; canonical environment-name lookup reads caller GOCACHE on Windows, and unavailable case measurement does not assert case-variant identity.
   * @evidence contracts/performance.md#efficient-algorithms Default runtime existence, candidate discovery and optional runtime planning can repeat delegated workspace/root observations; their ancestor/manifest/layout work is not constant projection. Complete-set identity/protection validation then precedes removal. Runtime owner scans, lock attempts and recursive deletion add their path/record/entry costs, without rebuilding plugin outputs to decide cleanup.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Cleanup and runtime liveness are mutable deletion effects; cached deletion plans cannot authorize a later filesystem generation.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The default runtime-plan branch holds its selected root's lock through resolution/deletion and delegates finally release, including the lock owner's unbounded peer-handle retirement limitation. Stable root discovery and namespace identity are required across sequential observations; the explicit whole-cache branch is not runtime-liveness filtered. Partial native rm failures are observable, not rolled back, and no storage ceiling is established.
   */
  public clean(): string[] {
    const projectRoot = this.resolveCleanProjectRoot();
    const legacyTargets = [
      path.join(projectRoot, "node_modules", ".ttsc"),
      path.join(projectRoot, ".ttsc"),
    ];
    const explicitCacheDir = this.resolveCacheDir();
    if (explicitCacheDir === undefined) {
      const runtimeRoot = path.join(
        resolveSourceBuildCachePaths(
          projectRoot,
          this.resolvePluginCacheDir(),
          this.resolveEffectiveEnv(),
        ).root,
        SourceBuildCacheLayout.RUNTIME_CACHE_DIRNAME,
      );
      if (cacheEntryExists(runtimeRoot)) {
        return withRuntimeDirectoryLock(runtimeRoot, () =>
          this.cleanResolved(
            projectRoot,
            legacyTargets,
            explicitCacheDir,
            true,
          ),
        );
      }
    }
    return this.cleanResolved(
      projectRoot,
      legacyTargets,
      explicitCacheDir,
      false,
    );
  }

  /** Resolve the deletion set after the runtime directory lock is held. */
  private cleanResolved(
    projectRoot: string,
    legacyTargets: string[],
    explicitCacheDir: string | undefined,
    includeRuntime: boolean,
  ): string[] {
    let targets: string[];
    if (explicitCacheDir !== undefined) {
      // An explicit constructor `cacheDir` names the cache directory for this
      // instance — exactly like `ttsc clean --cache-dir X` on the CLI — so
      // select it as a whole plus the legacy project-local caches, subject to
      // the caller-owned GOCACHE protection applied below. This keeps
      // the programmatic and CLI clean contracts identical for an explicit
      // cache dir.
      targets = [explicitCacheDir, ...legacyTargets];
    } else {
      // Default / `context.env.TTSC_CACHE_DIR`: resolve the cache root and the Go
      // build cache (`TTSC_GO_CACHE_DIR`) from this instance's effective
      // environment — the same `{ ...process.env, ...context.env }` that
      // prepare()/compile()/transform() build with — then remove only the
      // ttsc-owned subdirectories, so a possibly-shared root is never deleted and
      // a user-provided `GOCACHE` is never touched. Using the effective env (not
      // ambient `process.env`) makes clean() remove exactly the artifacts this
      // instance owns, including a `TTSC_GO_CACHE_DIR` supplied only in
      // `context.env`.
      const env = this.resolveEffectiveEnv();
      targets = [
        ...resolveCleanTargets(projectRoot, this.resolvePluginCacheDir(), env),
        // The runtime directories of runs no process still owns.
        ...(includeRuntime
          ? resolveRuntimeCleanTargets(
              resolveSourceBuildCachePaths(
                projectRoot,
                this.resolvePluginCacheDir(),
                env,
              ).root,
            ).targets
          : []),
      ];
    }
    // Validate the complete deletion set before removing the first directory.
    // This includes an environment-selected TTSC_GO_CACHE_DIR and project-local
    // legacy locations, not only an explicit constructor cacheDir.
    const providedGoCache = SidecarEnvironment.read(
      this.resolveEffectiveEnv(),
      "GOCACHE",
    )?.trim();
    const safeTargets = resolveSafeCacheCleanupTargets(
      projectRoot,
      targets,
      {},
      providedGoCache && providedGoCache !== "off"
        ? [path.resolve(projectRoot, providedGoCache)]
        : [],
    );
    return removeExistingDirectories(safeTargets);
  }

  /**
   * Compile the configured project.
   *
   * The public API does not write emitted files into the caller's project tree.
   * For projects without plugins, ttsc uses its native TypeScript-Go host's
   * `WriteFile` callback to capture output in memory. For projects with native
   * plugins, ttsc runs the plugin pipeline against a temporary output
   * directory, reads the generated text artifacts, and removes the temporary
   * directory before returning.
   *
   * The result uses an `embed-typescript`-style discriminated union: `success`
   * for clean compiles, `failure` for compiler diagnostics or plugin failures
   * that reached the build pipeline, and `exception` for host failures during
   * preparation, execution, response decoding, output capture or cleanup.
   *
   * @returns Structured compilation result containing diagnostics or output.
   *
   * @evidence contracts/common.md#principled-implementation Native status and error diagnostics jointly determine success versus failure; unexpected host exceptions remain a separate envelope, and emitted files come from the actual compiler pipeline.
   * @evidence contracts/common.md#clear-and-simple-design The public method supplies an owned context to the compiler and delegates outcome adaptation to runProject, avoiding a second compile-specific selection policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Captured output never substitutes for a successful status or absence of error diagnostics; real host exceptions are exposed rather than patched into expected results.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain in-memory output ownership, plugin temporary output and the three result states, with a separate acknowledgment block.
   * @evidence contracts/portability.md#os-neutral-implementation Native compiler and plugin owners receive explicit context path/environment inputs; their supported spawning and temporary-output boundaries isolate platform representation rather than shell concatenation here.
   * @evidence contracts/performance.md#efficient-algorithms One compile pipeline pays delegated source/native/output-capture costs. This adapter retains the existing output map, checks diagnostic severity and may format a process fallback diagnostic; context copies and diagnostic/stream text add their own costs, without a second project traversal just to form the envelope.
   * @evidence contracts/performance.md#reuse-equivalent-work Immutable plugin serialization and downstream validated source/descriptor caches are reused, while project compilation is repeated because source and filesystem inputs can change between calls.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous pipeline owns child captures and temporary output cleanup; returned output bytes and diagnostics transfer to the caller, and this method retains no historical results.
   */
  public compile(): ITtscCompilerResult {
    return runProject(() => compileProjectInMemory(this.compilerContext()));
  }

  /**
   * Transform the configured project and return TypeScript text by file path.
   *
   * This is the source-to-source API for plugin authors. It must not return
   * JavaScript emit or declaration files; those artifacts belong to
   * {@link TtscCompiler.compile}. Optional source maps describe transformed
   * TypeScript back to its input. A transform native source is expected to
   * write JSON shaped as `{ "typescript": { "src/file.ts": "..." } }` to
   * stdout. When no transform native source is configured, ttsc returns the
   * TypeScript files loaded by the TypeScript-Go Program together with normal
   * diagnostics.
   *
   * The returned shape mirrors `embed-typescript`'s transformation API:
   * `success` and `failure` carry a `typescript` map, while unexpected host
   * errors return `exception`.
   *
   * @returns Transformation result containing TypeScript text or diagnostics.
   *
   * @evidence contracts/common.md#principled-implementation The transform owner returns source-language text and diagnostics, and outcome adaptation uses real status/error severity; host failures remain exceptions rather than absent transformed files.
   * @evidence contracts/common.md#clear-and-simple-design The method supplies the same context policy as compile and delegates source transformation plus its distinct envelope to their owning helpers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No emitted JavaScript is mislabeled as TypeScript and no consumer-specific output substitutes for native transformation; supported plugin/no-plugin lanes preserve actual diagnostics.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish source transformation from emit and describe plugin JSON, no-plugin behavior and the result states, visibly separate from tags.
   * @evidence contracts/portability.md#os-neutral-implementation Native path and environment inputs remain context data passed to the transform owner; this adapter adds no platform shell or filename convention.
   * @evidence contracts/performance.md#efficient-algorithms One transform pays delegated source/native/capture costs. The envelope retains existing text/advisory maps and examines diagnostic severity or process fallback text; context/payload work remains with its actual owners, without a second compiler pass to shape the result.
   * @evidence contracts/performance.md#reuse-equivalent-work Constructor plugin payload and validated downstream compilation artifacts are reusable; transformed source results are not retained across mutable project inputs without proof.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous native captures and temporary project outputs belong to the transform owner; returned source text belongs to the caller and the compiler instance stores no result history.
   */
  public transform(): ITtscCompilerTransformation {
    return runTransformation(() =>
      transformProjectInMemory(this.compilerContext()),
    );
  }

  /**
   * {@link TtscCompiler.transform} with blocking transform execution offloaded.
   *
   * Returns the same envelope with the same failure semantics, and the same
   * descriptor-resilient launches. The whole transform, plugin loading
   * included, runs on a worker thread. Calling-thread context copying, request
   * transfer and result adaptation still perform work; this is not a guarantee
   * that the event loop stays free throughout. The
   * worker adopts `process.env` as it is at the call: a host that scopes
   * process-global state such as `TEMP` around the call covers the whole
   * transform, and nothing that changes the environment afterward reaches it.
   * Idle workers are pooled so plugin loading's in-process caches stay warm,
   * and never keep the process alive. The pool bounds idle workers by reported
   * host parallelism; active requests have no implicit concurrency cap or
   * deadline.
   *
   * @returns Transformation result containing TypeScript text or diagnostics.
   *
   * @evidence contracts/common.md#principled-implementation The worker executes the same synchronous transform under the invocation environment; separate selector/payload transfer preserves constructor JSON conversion, and success/failure/exception adaptation matches the synchronous API.
   * @evidence contracts/common.md#clear-and-simple-design The method owns only asynchronous outcome adaptation; the worker owner handles exclusive checkout, environment adoption and terminal settlement while the snapshot owner handles transport-safe plugin meaning.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported workers offload transform execution instead of patching caller globals; caller-side setup/transfer/adaptation remains, and failures become the actual exception envelope.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain whole-transform offloading, invocation environment isolation, warm reuse and active/idle limits following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Worker-owned native paths and canonical environment-name merging preserve platform authority; JSON plugin payload travels separately from structured-cloned host selectors, avoiding unsupported function cloning.
   * @evidence contracts/performance.md#efficient-algorithms One transform runs on one checked-out worker, with delegated source/native costs. Context copying, environment merge, encoding/structured transfer and response cloning follow payload bytes on their owning threads; result envelopes retain returned maps and inspect diagnostics rather than recompiling or rescanning all returned text.
   * @evidence contracts/performance.md#reuse-equivalent-work Warm workers retain validated loader caches and the constructor's captured JSON is reused; every invocation still adopts its own environment and performs its own transform.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The worker owner releases exclusive listeners on terminal settlement, retires failed/excess workers and bounds idle retention by CPU budget; active requests and their data scale with concurrency and have no implicit deadline.
   */
  public async transformAsync(): Promise<ITtscCompilerTransformation> {
    try {
      return toCompilerTransformation(
        await transformProjectInWorker(this.compilerContext()),
      );
    } catch (error) {
      return {
        error: normalizeError(error),
        kind: classifyException(error),
        type: "exception",
      };
    }
  }

  private compilerContext(): ITtscCompilerContext {
    return {
      ...CompilerContextSnapshot.clone(this.context),
      cacheDir: this.resolveCacheDir(),
    };
  }

  private resolveProjectExecution(): {
    cwd: string;
    projectRoot: string;
    tsconfig: string;
  } {
    const cwd = this.resolveCwd();
    const tsconfig = resolveProjectConfig({
      cwd,
      tsconfig: this.context.tsconfig,
    });
    return {
      cwd,
      projectRoot: this.context.projectRoot
        ? path.resolve(cwd, this.context.projectRoot)
        : path.dirname(tsconfig),
      tsconfig,
    };
  }

  private resolveCleanProjectRoot(): string {
    try {
      return this.resolveProjectExecution().projectRoot;
    } catch (error) {
      if (this.context.tsconfig) {
        throw error;
      }
      return this.resolveCwd();
    }
  }

  private resolveCwd(): string {
    return path.resolve(this.context.cwd ?? process.cwd());
  }

  private resolveCacheDir(): string | undefined {
    if (!this.context.cacheDir) {
      return undefined;
    }
    return path.isAbsolute(this.context.cacheDir)
      ? this.context.cacheDir
      : path.resolve(this.resolveCwd(), this.context.cacheDir);
  }

  private resolvePluginCacheDir(): string | undefined {
    return this.resolveCacheDir() ?? this.context.env?.TTSC_CACHE_DIR;
  }

  /**
   * The effective environment for this instance's source-plugin builds and
   * clean targets: `context.env` merged over `process.env`, matching the
   * documented {@link ITtscCompilerContext.env} contract that child compiler,
   * native-plugin, native-host, and isolated descriptor processes already
   * receive. Returned as a fresh object so callers never mutate the shared
   * `process.env`; when no `context.env` was supplied this is a plain copy of
   * `process.env`, so CLI / default behavior is unchanged.
   */
  private resolveEffectiveEnv(): NodeJS.ProcessEnv {
    return { ...process.env, ...this.context.env };
  }
}

function removeExistingDirectories(
  directories: readonly SafeCacheCleanupTarget[],
): string[] {
  const removed: string[] = [];
  const visited = new Set<string>();
  for (const directory of directories) {
    if (visited.has(directory.path)) continue;
    visited.add(directory.path);
    if (!directory.exists || !cacheEntryExists(directory.path)) {
      continue;
    }
    fs.rmSync(directory.path, { recursive: true, force: true });
    removed.push(directory.requestedPath);
  }
  return removed;
}

interface ProjectResult {
  output: Record<string, string>;
  result: TtscBuildResult;
}

interface ProjectTransformation {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  hostInputHashes?: Record<string, string | null>;
  hostInputProofFailures?: Record<string, "observation-unavailable">;
  hostInputRealpaths?: Record<string, string | null>;
  hostInputs?: string[];
  observationsComplete?: false;
  pluginSources?: Record<string, string>;
  result: TtscBuildResult;
  sourceMaps?: Record<string, ITtscCompilerTransformation.ISourceMap>;
  typescript: Record<string, string>;
  volatile?: string[];
}

function runProject(task: () => ProjectResult): ITtscCompilerResult {
  try {
    return toCompilerResult(task());
  } catch (error) {
    return {
      error: normalizeError(error),
      kind: classifyException(error),
      type: "exception",
    };
  }
}

function runTransformation(
  task: () => ProjectTransformation,
): ITtscCompilerTransformation {
  try {
    return toCompilerTransformation(task());
  } catch (error) {
    return {
      error: normalizeError(error),
      kind: classifyException(error),
      type: "exception",
    };
  }
}

/**
 * Best-effort classifier for the `kind` field of `IException`. Pattern- matches
 * the real prefixes thrown inside this package:
 *
 * - Plugin: messages from `loadProjectPlugins.ts` / `buildSourcePlugin.ts` start
 *   with `ttsc: plugin "..."` or `ttsc: package "..." declares ...`, and
 *   transform-time spawn failures start with `ttsc.transform:` /
 *   `ttsc.transform.check:`. The Go-toolchain missing envelope also surfaces
 *   here.
 * - Host: everything else under the `ttsc:` umbrella — the bare `ttsc:` strings
 *   from `packageRootDir.ts`, `ttsc: TypeScript-Go executable not found`
 *   (`resolveTsgo.ts`), `ttsc: failed to spawn native compiler host`
 *   (`transformProjectInMemory.ts`), and tsconfig / extended-tsconfig shapes
 *   from `readProjectConfig.ts`.
 * - Anything else falls back to `"unknown"` so embedders always see the field set
 *   per the documented contract.
 *
 * Order matters: plugin patterns must run before the generic `ttsc:` test
 * because every plugin message also starts with `ttsc:`.
 */
function classifyException(error: unknown): "plugin" | "host" | "unknown" {
  let message: string;
  try {
    const description =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : error !== null && typeof error === "object"
            ? Object.getOwnPropertyDescriptor(error, "message")?.value
            : undefined;
    message = typeof description === "string" ? description : "";
  } catch {
    return "unknown";
  }
  if (
    // Match every plugin-origin shape with verb-anchored patterns so a
    // host-path containing the literal token `plugin` (e.g.
    // `TTSC_BINARY=/opt/cache/plugins/ttsc-bin`) does not misclassify
    // as kind="plugin". Each alternative anchors at the start of the
    // message to capture the verb, not anywhere later in the line:
    //
    //   - `ttsc: plugin "..."` / `ttsc: package "..."` — from
    //     loadProjectPlugins.ts
    //   - `ttsc: building plugin "..."` / `ttsc: reading go.mod for
    //     plugin "..."` — from buildSourcePlugin.ts
    //   - `ttsc.transform:` / `ttsc.transform.check:` — from
    //     transformProjectInMemory.ts
    //   - `ttsc-plugin:` — legacy prefix kept for compatibility
    //   - `go toolchain` — the goToolchainNotFoundMessage envelope
    /^ttsc:\s*plugin\b|^ttsc:\s*package\b|^ttsc:\s*building plugin\b|^ttsc:\s*reading go\.mod for plugin\b|^ttsc\.transform[.:]|^ttsc-plugin:|go toolchain/i.test(
      message,
    )
  ) {
    return "plugin";
  }
  if (
    /^ttsc:|tsconfig|extended tsconfig|TypeScript-Go|native compiler host/i.test(
      message,
    )
  ) {
    return "host";
  }
  return "unknown";
}

function toCompilerResult(project: ProjectResult): ITtscCompilerResult {
  const { output, result } = project;
  if (result.status === 0 && !hasErrorDiagnostics(result.diagnostics)) {
    return {
      ...(result.diagnostics.length === 0
        ? {}
        : { diagnostics: result.diagnostics }),
      output,
      type: "success",
    };
  }
  return {
    diagnostics:
      result.diagnostics.length === 0
        ? [createProcessDiagnostic(result)]
        : result.diagnostics,
    output,
    type: "failure",
  };
}

function toCompilerTransformation(
  project: ProjectTransformation,
): ITtscCompilerTransformation {
  const {
    dependencies,
    dependenciesComplete,
    graph,
    hostInputHashes,
    hostInputProofFailures,
    hostInputRealpaths,
    hostInputs,
    observationsComplete,
    pluginSources,
    result,
    sourceMaps,
    typescript,
    volatile,
  } = project;
  const advisoryFields = {
    ...(dependencies === undefined ? {} : { dependencies }),
    ...(dependenciesComplete === undefined ? {} : { dependenciesComplete }),
    ...(graph === undefined ? {} : { graph }),
    ...(hostInputHashes === undefined ? {} : { hostInputHashes }),
    ...(hostInputProofFailures === undefined ? {} : { hostInputProofFailures }),
    ...(hostInputRealpaths === undefined ? {} : { hostInputRealpaths }),
    ...(hostInputs === undefined ? {} : { hostInputs }),
    ...(observationsComplete === undefined ? {} : { observationsComplete }),
    ...(pluginSources === undefined ? {} : { pluginSources }),
    ...(sourceMaps === undefined ? {} : { sourceMaps }),
    ...(volatile === undefined ? {} : { volatile }),
  };
  if (result.status === 0 && !hasErrorDiagnostics(result.diagnostics)) {
    return {
      ...(result.diagnostics.length === 0
        ? {}
        : { diagnostics: result.diagnostics }),
      ...advisoryFields,
      type: "success",
      typescript,
    };
  }
  return {
    ...advisoryFields,
    diagnostics:
      result.diagnostics.length === 0
        ? [createProcessDiagnostic(result)]
        : result.diagnostics,
    type: "failure",
    typescript,
  };
}

function hasErrorDiagnostics(
  diagnostics: readonly ITtscCompilerDiagnostic[],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.category === "error");
}

function normalizeError(error: unknown): unknown {
  return serializeCompilerError(error);
}
