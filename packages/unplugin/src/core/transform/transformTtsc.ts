import path from "node:path";

import type { ResolvedTtscUnpluginOptions } from "../options/ResolvedTtscUnpluginOptions";
import type { TtscTransformResult } from "./TtscTransformResult";
import { createAliasPaths } from "./alias/createAliasPaths";
import { TERMINAL_TRANSFORM_GENERATIONS } from "./cache/TERMINAL_TRANSFORM_GENERATIONS";
import { TRANSFORM_CACHE_CASE_POLICIES } from "./cache/TRANSFORM_CACHE_CASE_POLICIES";
import { TRANSFORM_CACHE_DEPENDENCY_WITNESSES } from "./cache/TRANSFORM_CACHE_DEPENDENCY_WITNESSES";
import { TRANSFORM_RESULT_FILESYSTEM } from "./cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscTransformCache } from "./cache/TtscTransformCache";
import { awaitOrEvict } from "./cache/awaitOrEvict";
import { createTransformCacheKey } from "./cache/createTransformCacheKey";
import { disposeCachedTransform } from "./cache/disposeCachedTransform";
import { evictGeneration } from "./cache/evictGeneration";
import { preparePluginBuildEnvironments } from "./inputs/preparePluginBuildEnvironments";
import { TtscUnstableGenerationError } from "./errors/TtscUnstableGenerationError";
import { replaysTerminalGeneration } from "./cache/replaysTerminalGeneration";
import { selectCachedGenerationAction } from "./cache/selectCachedGenerationAction";
import { selectOrEvict } from "./cache/selectOrEvict";
import { transformCacheEpoch } from "./cache/transformCacheEpoch";
import { transformCacheTrustsNotifications } from "./cache/transformCacheTrustsNotifications";
import { transformFilesystem } from "./cache/transformFilesystem";
import { withdrawGenerationNotifications } from "./cache/withdrawGenerationNotifications";
import { reportMissingProgramOutput } from "./diagnostics/reportMissingProgramOutput";
import { reportSuccessDiagnostics } from "./diagnostics/reportSuccessDiagnostics";
import type { TtscTransformedOutput } from "./envelope/TtscTransformedOutput";
import { envelopeDerivation } from "./envelope/envelopeDerivation";
import { isVolatileFile } from "./envelope/isVolatileFile";
import { TtscMissingProgramOutputError } from "./errors/TtscMissingProgramOutputError";
import { transformProject } from "./generation/transformProject";
import { TRANSFORM_CACHE_SESSIONS } from "./session/TRANSFORM_CACHE_SESSIONS";
import { settleProjectMutationEvents } from "./tracker/settleProjectMutationEvents";
import { resolveProjectSelection } from "./tsconfig/resolveProjectSelection";
import { createTransformResult } from "./utils/createTransformResult";
import { isDeclarationFile } from "./utils/isDeclarationFile";
import { isHostWrapperQuery } from "./utils/isHostWrapperQuery";
import { pluginsAreDisabled } from "./utils/pluginsAreDisabled";
import { stripQuery } from "./utils/stripQuery";
import { markCachedSourceServed } from "./validation/markCachedSourceServed";
import type { TtscTransformHooks } from "./watch/TtscTransformHooks";
import type { TtscWatchSelection } from "./watch/TtscWatchSelection";
import { notifyFailedGenerationInputs } from "./watch/notifyFailedGenerationInputs";
import { notifyRejectedGenerationInputs } from "./watch/notifyRejectedGenerationInputs";
import { notifyWatchInputs } from "./watch/notifyWatchInputs";

/**
 * Apply the ttsc plugin transform to a single source file.
 *
 * The function is intentionally project-scoped: it compiles the entire tsconfig
 * project in one shot and extracts the result for `id`. Subsequent calls for
 * sibling files reuse the admitted generation while its source, dependencies
 * and project membership remain current. Qualified native observations or
 * content comparisons establish that permission; a matching cache key alone
 * does not.
 *
 * Output admitted only for its fresh delivery also requires an explicitly
 * nonwatching host and a supported host-cache withdrawal callback. Unknown or
 * watching lifecycles cannot observe the missing input closure safely.
 *
 * Returns `undefined` when no transform is needed (declaration files, virtual
 * modules, disabled plugins, or source unchanged after transform).
 *
 * Its place in the adapter's invalidation model, and the units beside it, are
 * mapped in the maintainer page
 * `website/src/content/docs/development/reference/unplugin-invalidation.mdx`.
 *
 * @param id - Bundler module id (may carry a query string or virtual prefix).
 * @param source - Current file content supplied by the bundler.
 * @param options - Resolved plugin options.
 * @param aliases - Raw Vite alias configuration (object or array).
 * @param cache - Optional project cache. Callers with a real `buildStart`
 *   boundary declare it through `beginTtscTransformBuild`; other hosts retain
 *   persistent validation.
 * @param hooks - Optional adapter callbacks; see {@link TtscTransformHooks}.
 *   Dependency notifications fire on cache hits too; watch registrations are
 *   per build, not per compilation.
 *
 * @evidence contracts/common.md#principled-implementation Project selection and generation-qualified cache admission preserve compiler disk authority; fresh-only success additionally needs an explicit nonwatching lifecycle, coherent project declaration and actual host-cache withdrawal, because incomplete observation cannot support watch invalidation.
 * @evidence contracts/common.md#clear-and-simple-design One delivery coordinator composes project selection, cache admission, compilation, output selection and host notifications; dedicated owners handle proof and lifetime internals.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Wrapper modules cannot poison source baselines and incomplete generations cannot authorize reuse; a separately admitted fresh-only result is evicted before capability checks, unknown or watching lifecycles fail explicitly, and unsupported withdrawal cannot be replaced by a fake record or guessed dependency closure.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs and argument tags explain project scope, no-transform outcomes, cache epochs and per-build notification responsibilities with links to maintained reference context.
 * @evidence contracts/performance.md#efficient-algorithms Each admission iteration selects or validates one project generation; in-flight or valid completed reuse avoids repeated compilation, while validation cost follows the actual required input population.
 * @evidence contracts/performance.md#reuse-equivalent-work Cache identity covers config/options/plugins/aliases; current generations, pass-qualified terminal verdicts and in-flight Promises are shared only while their source and dependency proof remains valid.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The cache owns current generations and workers; fresh-only delivery evicts and releases its generation even when a callback later throws, untrusted notifications are withdrawn, and other eviction/attempt cleanup stays with generation owners.
 * @evidence contracts/portability.md#os-neutral-implementation Native module paths and project coordinates use supported path/filesystem abstractions, while actual case policy and watcher capability come from generation proof rather than OS-name assumptions.
 */
export async function transformTtsc(
  id: string,
  source: string,
  options: ResolvedTtscUnpluginOptions,
  aliases?: unknown,
  cache?: TtscTransformCache,
  hooks?: TtscTransformHooks,
): Promise<TtscTransformResult | undefined> {
  const filesystem = transformFilesystem(cache);
  const clean = stripQuery(id);
  if (clean.includes("\0")) {
    return undefined;
  }
  // A wrapper the host generates around the file, such as `?raw`, is not the
  // file's program: substituting the compiled program would change what the
  // import yields, and its text would poison the generation's baseline
  // (samchon/ttsc#1394).
  if (isHostWrapperQuery(id)) {
    return undefined;
  }
  const file = path.resolve(clean);
  if (isDeclarationFile(file)) {
    return undefined;
  }
  if (pluginsAreDisabled(options.plugins)) {
    return undefined;
  }

  const selection = resolveProjectSelection(file, options.project, filesystem);
  const tsconfig = selection.tsconfig;
  // Every config the selection read is a watch input too: editing a solution's
  // `references`, or the `include` of a project searched before the selected
  // one, can move the file (samchon/ttsc#1397). Each notification hands them
  // beside its own inputs, under the same spelling, so a config both name is
  // registered once.
  const watchSelection: TtscWatchSelection = {
    consulted: selection.consulted,
    filesystem,
    tsconfig,
  };
  const aliasPaths = createAliasPaths(aliases);
  const key = createTransformCacheKey({
    aliasPaths,
    compilerOptions: options.compilerOptions,
    plugins: options.plugins,
    tsconfig,
  });

  for (;;) {
    // Read once per iteration, before the cache is consulted, so a delivery
    // belongs to the pass that was current when it started examining the
    // generation. A pass opened while this one awaits an in-flight compile is
    // picked up by the next iteration, which is the one that runs when the
    // entry it awaited turns out to have been superseded.
    const epoch = transformCacheEpoch(cache);
    let transformed = cache?.get(key);
    if (transformed !== undefined) {
      const terminal = TERMINAL_TRANSFORM_GENERATIONS.get(transformed);
      if (terminal !== undefined) {
        if (terminal instanceof TtscUnstableGenerationError) {
          await preparePluginBuildEnvironments(terminal.validation.cached.result, filesystem);
          if (cache?.get(key) !== transformed) continue;
        }
        // A terminal verdict is an answer about one observed environment, not an
        // invitation for every later module to repeat the whole compile.
        if (
          replaysTerminalGeneration(terminal, epoch, {
            currentFile: file,
            currentSource: source,
            filesystem,
          })
        ) {
          notifyRejectedGenerationInputs(hooks, terminal, file, watchSelection);
          throw terminal;
        }
        evictGeneration(cache, key, transformed);
        if (cache?.get(key) !== undefined) {
          continue;
        }
        transformed = undefined;
      }
    }
    if (transformed !== undefined) {
      const cached = await awaitOrEvict(cache, key, transformed).catch(
        (rejection: unknown) => {
          notifyRejectedGenerationInputs(
            hooks,
            rejection,
            file,
            watchSelection,
          );
          throw rejection;
        },
      );
      TRANSFORM_RESULT_FILESYSTEM.set(cached.result, filesystem);
      // While this caller awaited the old Promise, another caller may have
      // invalidated it and installed a newer authoritative generation.
      if (cache?.get(key) !== transformed) {
        continue;
      }
      // A generation captured while native notifications were trusted keeps
      // their watchers. Once the host or the environment declares polling,
      // their silence proves nothing, so the generation gives them up and is
      // proven from its recorded state from here on (samchon/ttsc#1542).
      if (!transformCacheTrustsNotifications(cache)) {
        withdrawGenerationNotifications(cached);
      }
      await preparePluginBuildEnvironments(cached.result, filesystem);
      if (cache?.get(key) !== transformed) continue;
      if (epoch === undefined) {
        await settleProjectMutationEvents(cached);
        if (cache?.get(key) !== transformed) {
          continue;
        }
      }
      const action = selectCachedGenerationAction({
        cache,
        cached,
        epoch,
        file,
        generation: transformed,
        key,
        source,
      });
      if (action === "retry") {
        continue;
      }
      if (action === "serve") {
        reportSuccessDiagnostics(cached, epoch);
        // A resolved `"exception"` / `"failure"` envelope makes this throw;
        // that is a failed generation too, so it is retained for this pass or
        // evicted outside one before being surfaced.
        let output: TtscTransformedOutput;
        try {
          output = selectOrEvict(cache, key, transformed, epoch, {
            file,
            projectRoot: cached.projectRoot,
            result: cached.result,
            tsconfig: cached.tsconfig,
          });
        } catch (error) {
          if (!(error instanceof TtscMissingProgramOutputError)) {
            notifyFailedGenerationInputs(hooks, cached, file, watchSelection);
            throw error;
          }
          // The compile is fine and simply has nothing for this module, so the
          // module goes back to the host untransformed rather than failing the
          // build (samchon/ttsc#1308). Its project config and selection inputs
          // still decide whether a later generation will contain this module,
          // so hosts must receive the same universal watch-input batch.
          reportMissingProgramOutput(cached, error, epoch);
          notifyWatchInputs(hooks, cached, file, watchSelection);
          markCachedSourceServed(cached, file);
          return undefined;
        }
        notifyWatchInputs(hooks, cached, file, watchSelection);
        markCachedSourceServed(cached, file);
        return createTransformResult(file, source, output);
      }
      transformed = undefined;
    }

    if (transformed === undefined) {
      transformed = transformProject({
        aliasPaths,
        compilerOptions: options.compilerOptions,
        currentFile: file,
        currentSource: source,
        // Stamp the pass this compile was started for, not the one it happens
        // to finish in: a boundary crossed mid-compile leaves the generation
        // belonging to the earlier pass, so the next pass re-proves it.
        deliveryEpoch: epoch,
        filesystem,
        plugins: options.plugins,
        // One bounded recursive project observer witnesses content restored
        // during the compile itself. Build-scoped adapters close it with the
        // attempt; persistent adapters retain it to make later validations
        // constant-cost while the generation remains live.
        retainProjectMembership: cache !== undefined && epoch === undefined,
        // Under declared polling, silence from a native watcher proves nothing.
        retainNotifications: transformCacheTrustsNotifications(cache),
        // A pooled worker compiles through its session (samchon/ttsc#1390).
        session:
          cache === undefined ? undefined : TRANSFORM_CACHE_SESSIONS.get(cache),
        trackProjectMembership: cache !== undefined,
        tsconfig,
        useCaseSensitiveFileNames:
          cache === undefined
            ? undefined
            : TRANSFORM_CACHE_CASE_POLICIES.get(cache)?.get(key),
        witnessedDependencies:
          cache === undefined
            ? undefined
            : TRANSFORM_CACHE_DEPENDENCY_WITNESSES.get(cache)?.get(key),
      });
      cache?.set(key, transformed);
    }
    const generation = transformed;
    const cached = await awaitOrEvict(cache, key, generation).catch(
      (rejection: unknown) => {
        notifyRejectedGenerationInputs(hooks, rejection, file, watchSelection);
        throw rejection;
      },
    );
    if (cache !== undefined && cache.get(key) !== generation) {
      continue;
    }
    if (cache !== undefined) {
      let witnesses = TRANSFORM_CACHE_DEPENDENCY_WITNESSES.get(cache);
      if (witnesses === undefined) {
        witnesses = new Map();
        TRANSFORM_CACHE_DEPENDENCY_WITNESSES.set(cache, witnesses);
      }
      witnesses.set(key, cached.externalDependencyInputs ?? []);
      const reported = cached.membershipPolicy.useCaseSensitiveFileNames;
      if (reported !== undefined) {
        let policies = TRANSFORM_CACHE_CASE_POLICIES.get(cache);
        if (policies === undefined) {
          policies = new Map();
          TRANSFORM_CACHE_CASE_POLICIES.set(cache, policies);
        }
        policies.set(key, reported);
      }
    }
    const { projectRoot, result } = cached;
    if (cached.freshDeliveryOnly === true) {
      // This delivery owns a newly compiled answer, but unavailable observer
      // authority cannot certify any later resident or host-cache delivery.
      // Eviction schedules resource release even if a host callback throws.
      if (cache === undefined) disposeCachedTransform(cached);
      else evictGeneration(cache, key, generation);
      if (
        result.type === "success" &&
        (hooks?.watching !== false ||
          hooks.markVolatile === undefined ||
          (hooks.project?.watching !== undefined &&
            hooks.project.watching !== hooks.watching))
      ) {
        throw new Error(
          "@ttsc/unplugin: plugin input observation is unavailable; fresh output " +
            "requires an explicitly nonwatching host with supported cache withdrawal. " +
            "Watching, unknown or contradictory lifecycles cannot safely observe its changes.",
        );
      }
      hooks?.markVolatile?.();
    }
    reportSuccessDiagnostics(cached, epoch);
    let output: TtscTransformedOutput;
    try {
      output = selectOrEvict(cache, key, generation, epoch, {
        file,
        projectRoot,
        result,
        tsconfig: cached.tsconfig,
      });
    } catch (error) {
      if (!(error instanceof TtscMissingProgramOutputError)) {
        notifyFailedGenerationInputs(hooks, cached, file, watchSelection);
        throw error;
      }
      reportMissingProgramOutput(cached, error, epoch);
      notifyWatchInputs(hooks, cached, file, watchSelection);
      markCachedSourceServed(cached, file);
      return undefined;
    }
    notifyWatchInputs(hooks, cached, file, watchSelection);
    markCachedSourceServed(cached, file);
    if (
      isVolatileFile(envelopeDerivation(cached), { file, projectRoot, result })
    ) {
      hooks?.markVolatile?.();
    }
    return createTransformResult(file, source, output);
  }
}
