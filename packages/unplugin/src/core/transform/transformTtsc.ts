import path from "node:path";

import type { ResolvedTtscUnpluginOptions } from "../options/ResolvedTtscUnpluginOptions";
import type { TtscTransformResult } from "./TtscTransformResult";
import { createAliasPaths } from "./alias/createAliasPaths";
import { TERMINAL_TRANSFORM_GENERATIONS } from "./cache/TERMINAL_TRANSFORM_GENERATIONS";
import { TRANSFORM_RESULT_FILESYSTEM } from "./cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscTransformCache } from "./cache/TtscTransformCache";
import { awaitOrEvict } from "./cache/awaitOrEvict";
import { createTransformCacheKey } from "./cache/createTransformCacheKey";
import { evictGeneration } from "./cache/evictGeneration";
import { replaysTerminalGeneration } from "./cache/replaysTerminalGeneration";
import { selectOrEvict } from "./cache/selectOrEvict";
import { transformCacheEpoch } from "./cache/transformCacheEpoch";
import { transformCacheTrustsNotifications } from "./cache/transformCacheTrustsNotifications";
import { transformFilesystem } from "./cache/transformFilesystem";
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
import { matchesCachedSource } from "./validation/matchesCachedSource";
import type { TtscTransformHooks } from "./watch/TtscTransformHooks";
import { notifyFailedGenerationInputs } from "./watch/notifyFailedGenerationInputs";
import { notifyWatchInputs } from "./watch/notifyWatchInputs";
import { withSelectionInputs } from "./watch/withSelectionInputs";

/**
 * Apply the ttsc plugin transform to a single source file.
 *
 * The function is intentionally project-scoped: it compiles the entire tsconfig
 * project in one shot and extracts the result for `id`. Subsequent calls for
 * sibling files in the same project reuse the cached result as long as none of
 * the project's input files have changed (verified by comparing SHA-256
 * hashes).
 *
 * Returns `undefined` when no transform is needed (declaration files, virtual
 * modules, disabled plugins, or source unchanged after transform).
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
  // A solution config that routed this file elsewhere is a watch input too:
  // editing its `references` can move the file (samchon/ttsc#1397).
  hooks = withSelectionInputs(hooks, selection.consulted, filesystem);
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
        // A terminal verdict is an answer about one observed environment, not an
        // invitation for every later module to repeat the whole compile.
        if (
          replaysTerminalGeneration(terminal, epoch, {
            currentFile: file,
            currentSource: source,
            filesystem,
          })
        ) {
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
      const cached = await awaitOrEvict(cache, key, transformed);
      TRANSFORM_RESULT_FILESYSTEM.set(cached.result, filesystem);
      // While this caller awaited the old Promise, another caller may have
      // invalidated it and installed a newer authoritative generation.
      if (cache?.get(key) !== transformed) {
        continue;
      }
      if (epoch === undefined) {
        await settleProjectMutationEvents(cached);
        if (cache?.get(key) !== transformed) {
          continue;
        }
      }
      if (
        // A file the plugin declared volatile must never be served from the
        // cache: its output depends on non-file inputs, so the input-hash
        // snapshot cannot prove freshness. Fall through to a fresh transform.
        !isVolatileFile(envelopeDerivation(cached), {
          file,
          projectRoot: cached.projectRoot,
          result: cached.result,
        }) &&
        matchesCachedSource(cached, file, source, epoch)
      ) {
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
            notifyFailedGenerationInputs(hooks, cached);
            throw error;
          }
          // The compile is fine and simply has nothing for this module, so the
          // module goes back to the host untransformed rather than failing the
          // build (samchon/ttsc#1308). Its project config and selection inputs
          // still decide whether a later generation will contain this module,
          // so hosts must receive the same universal watch-input batch.
          reportMissingProgramOutput(cached, error, epoch);
          notifyWatchInputs(hooks, cached, file);
          markCachedSourceServed(cached, file);
          return undefined;
        }
        notifyWatchInputs(hooks, cached, file);
        markCachedSourceServed(cached, file);
        return createTransformResult(file, source, output);
      }
      evictGeneration(cache, key, transformed);
      // Another caller may have replaced the generation while this caller was
      // awaiting or validating the old one. Retry that authoritative entry
      // instead of deleting it or starting a redundant third compilation.
      if (cache?.get(key) !== undefined) {
        continue;
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
      });
      cache?.set(key, transformed);
    }
    const generation = transformed;
    const cached = await awaitOrEvict(cache, key, generation);
    if (cache !== undefined && cache.get(key) !== generation) {
      continue;
    }
    const { projectRoot, result } = cached;
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
        notifyFailedGenerationInputs(hooks, cached);
        throw error;
      }
      reportMissingProgramOutput(cached, error, epoch);
      notifyWatchInputs(hooks, cached, file);
      markCachedSourceServed(cached, file);
      return undefined;
    }
    notifyWatchInputs(hooks, cached, file);
    markCachedSourceServed(cached, file);
    if (
      isVolatileFile(envelopeDerivation(cached), { file, projectRoot, result })
    ) {
      hooks?.markVolatile?.();
    }
    return createTransformResult(file, source, output);
  }
}
