import path from "node:path";

import type { ResolvedTtscUnpluginOptions } from "../options/ResolvedTtscUnpluginOptions";
import { TtscPrecompilation } from "./TtscPrecompilation";
import type { TtscTransformResult } from "./TtscTransformResult";
import { createAliasPaths } from "./alias/createAliasPaths";
import { TERMINAL_TRANSFORM_GENERATIONS } from "./cache/TERMINAL_TRANSFORM_GENERATIONS";
import { TRANSFORM_CACHE_CASE_POLICIES } from "./cache/TRANSFORM_CACHE_CASE_POLICIES";
import { TRANSFORM_CACHE_DEPENDENCY_WITNESSES } from "./cache/TRANSFORM_CACHE_DEPENDENCY_WITNESSES";
import { TRANSFORM_CACHE_MEMBERSHIP_POLICIES } from "./cache/TRANSFORM_CACHE_MEMBERSHIP_POLICIES";
import { TRANSFORM_RESULT_FILESYSTEM } from "./cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscTransformCache } from "./cache/TtscTransformCache";
import { awaitOrEvict } from "./cache/awaitOrEvict";
import { createTransformCacheKey } from "./cache/createTransformCacheKey";
import { evictGeneration } from "./cache/evictGeneration";
import { replaysTerminalGeneration } from "./cache/replaysTerminalGeneration";
import { selectCachedGenerationAction } from "./cache/selectCachedGenerationAction";
import { transformCacheEpoch } from "./cache/transformCacheEpoch";
import { transformCacheTrustsNotifications } from "./cache/transformCacheTrustsNotifications";
import { transformFilesystem } from "./cache/transformFilesystem";
import { withdrawGenerationNotifications } from "./cache/withdrawGenerationNotifications";
import { deliverCachedTransform } from "./deliverCachedTransform";
import { TtscUnstableGenerationError } from "./errors/TtscUnstableGenerationError";
import { transformProject } from "./generation/transformProject";
import { preparePluginBuildEnvironments } from "./inputs/preparePluginBuildEnvironments";
import { TRANSFORM_CACHE_SESSIONS } from "./session/TRANSFORM_CACHE_SESSIONS";
import { settleProjectMutationEvents } from "./tracker/settleProjectMutationEvents";
import { resolveCompilerEnvironment } from "./tsconfig/resolveCompilerEnvironment";
import { resolveProjectSelection } from "./tsconfig/resolveProjectSelection";
import { isDeclarationFile } from "./utils/isDeclarationFile";
import { isHostWrapperQuery } from "./utils/isHostWrapperQuery";
import { pluginsAreDisabled } from "./utils/pluginsAreDisabled";
import { stripQuery } from "./utils/stripQuery";
import { TtscGenerationProof } from "./validation/TtscGenerationProof";
import type { TtscTransformHooks } from "./watch/TtscTransformHooks";
import type { TtscWatchSelection } from "./watch/TtscWatchSelection";
import { notifyRejectedGenerationInputs } from "./watch/notifyRejectedGenerationInputs";
import { prepareProjectRecordDirectories } from "./watch/prepareProjectRecordDirectories";
import { recordedDependencyWitnesses } from "./watch/recordedDependencyWitnesses";

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
 * @param id - Bundler module id (may carry a query string or virtual prefix),
 *   or, with `hooks.exactPath`, a bare filesystem path that keeps every `?` and
 *   `#` as part of its name.
 * @param source - Current file content supplied by the bundler.
 * @param options - Resolved plugin options.
 * @param aliases - Raw Vite alias configuration (object or array).
 * @param cache - Optional project cache. Callers with a real `buildStart`
 *   boundary declare it through `beginTtscTransformBuild`; other hosts retain
 *   persistent validation.
 * @param hooks - Optional adapter callbacks; see {@link TtscTransformHooks}.
 *   Dependency notifications fire on cache hits too; watch registrations are
 *   per build, not per compilation.
 * @evidence contracts/common.md#principled-implementation Project selection and generation-qualified admission preserve compiler disk authority; preparation shares selection, keys, capture and input proofs with delivery, while host effects and first-delivery permission remain exclusive to actual delivery. Fresh-only success still requires an explicit nonwatching lifecycle, coherent project declaration and supported host-cache withdrawal because incomplete observation cannot establish watch invalidation.
 * @evidence contracts/common.md#clear-and-simple-design One coordinator mode shares project selection, admission, compilation and output selection between preparation and delivery; dedicated owners retain proof and lifetime internals, and delivery alone performs host notification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Wrapper modules cannot poison source baselines. Preparation skips handoff rather than postcompile proof, and superseded preparation stops without reviving withdrawn generations. Incomplete local results share only explicitly nonwatching first deliveries in their exact pass; unknown/watching lifecycles or unsupported withdrawal reject and evict without invented persistent records or dependency closure.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs and argument tags explain project scope, no-transform outcomes, cache epochs and per-build notifications; coordinator prose identifies delivery-only effects and postpreparation admission, with maintained invalidation reference context.
 * @evidence contracts/performance.md#efficient-algorithms Selection and keys pay ancestor/config/alias/option/path-text work. Each iteration may prepare toolchains, settle notifications and replay source/project/external/universal proofs; reuse avoids compilation rather than those checks or output/map/notification/record work. Misses pay native compilation and input populations. Proven first deliveries skip redundant environment preparation and share synchronous proof queries; repeated delivery establishes fresh authority. Startup schedules explicit entries concurrently and skips delivery output/map/registration work. Supersession can repeat the outer loop without a retry or time bound.
 * @evidence contracts/performance.md#reuse-equivalent-work Config/options/plugins/aliases key the ordinary project Promise shared by preparation, simultaneous loads and sibling entries; completed generations, pass-qualified terminal verdicts and in-flight work remain reusable only under current source and dependency proof.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Optional cache state retains generation Promises/results and per-key dependency/case facts without a byte/key cap. Native tasks belong to compiler/capture owners; uncached captures retain no notification or persistent clock probe. Fresh-only delivery releases capture resources while retaining an admitted local pass result; failed or rejected incomplete handoff detaches its generation. Superseded preparation preserves the new owner, and withdrawal schedules disposal of its pending fulfilled result. Eviction/disposal attempt independent release; native failure need not close every handle or remove every probe.
 * @evidence contracts/portability.md#os-neutral-implementation Preparation and delivery use the same native project selection, path identity and cache-owned filesystem boundaries, with exact startup entry paths. Generation proof supplies case and watcher policy rather than OS-name assumptions.
 */
export function transformTtsc(
  id: string,
  source: string,
  options: ResolvedTtscUnpluginOptions,
  aliases?: unknown,
  cache?: TtscTransformCache,
  hooks?: TtscTransformHooks,
): Promise<TtscTransformResult | undefined> {
  return runTransformTtsc(id, source, options, aliases, cache, hooks, false);
}

/**
 * Coordinate capture and actual delivery through the same project cache.
 * Preparation stops before handoff: it cannot mark a module served, publish a
 * host record, acknowledge volatility or emit module diagnostics. A prepared
 * generation must still pass ordinary admission when the host requests it.
 */
async function runTransformTtsc(
  id: string,
  source: string,
  options: ResolvedTtscUnpluginOptions,
  aliases: unknown,
  cache: TtscTransformCache | undefined,
  hooks: TtscTransformHooks | undefined,
  preparing: boolean,
): Promise<TtscTransformResult | undefined> {
  const filesystem = transformFilesystem(cache);
  const exact = hooks?.exactPath === true;
  const clean = exact ? id : stripQuery(id);
  if (clean.includes("\0")) {
    return undefined;
  }
  // A wrapper the host generates around the file, such as `?raw`, is not the
  // file's program: substituting the compiled program would change what the
  // import yields, and its text would poison the generation's baseline
  // (samchon/ttsc#1394).
  if (!exact && isHostWrapperQuery(id)) {
    return undefined;
  }
  const file = path.resolve(clean);
  if (isDeclarationFile(file)) {
    return undefined;
  }
  if (pluginsAreDisabled(options.plugins)) {
    return undefined;
  }

  // Acquire host-owned storage before any generation observes directory inputs.
  // Writing the delivered record must not create a new member of that proof.
  prepareProjectRecordDirectories(hooks?.project);

  const selection =
    hooks?.projectSelection === undefined
      ? resolveProjectSelection(file, options.project, filesystem)
      : { tsconfig: path.resolve(hooks.projectSelection), consulted: [] };
  const tsconfig = selection.tsconfig;
  const selectedProjectRoot = path.resolve(
    options.projectRoot ?? path.dirname(tsconfig),
  );
  // Reported config reads and failed discovery candidates are watch inputs:
  // editing a solution's
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
  if (!preparing && cache !== undefined) {
    TtscPrecompilation.start(cache, options, aliasPaths, (entry, text) =>
      runTransformTtsc(
        entry,
        text,
        options,
        aliases,
        cache,
        { ...hooks, exactPath: true, projectSelection: undefined },
        true,
      ),
    );
  }
  const compilerEnvironment = resolveCompilerEnvironment(
    options.runExternalCode,
  );
  const key = createTransformCacheKey({
    aliasPaths,
    compilerEnvironment,
    compilerOptions: options.compilerOptions,
    plugins: options.plugins,
    projectRoot: selectedProjectRoot,
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
          await preparePluginBuildEnvironments(
            terminal.validation.cached.result,
            filesystem,
            undefined,
            terminal.validation.cached.projectRoot,
          );
          if (cache?.get(key) !== transformed) {
            if (preparing) return undefined;
            continue;
          }
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
          if (!preparing)
            notifyRejectedGenerationInputs(
              hooks,
              terminal,
              file,
              watchSelection,
            );
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
          if (!preparing)
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
        if (preparing) return undefined;
        continue;
      }
      // A generation captured while native notifications were trusted keeps
      // their watchers. Once the host or the environment declares polling,
      // their silence proves nothing, so the generation gives them up and is
      // proven from its recorded state from here on (samchon/ttsc#1542).
      if (!transformCacheTrustsNotifications(cache)) {
        withdrawGenerationNotifications(cached);
      }
      if (epoch === undefined) {
        await settleProjectMutationEvents(cached);
        if (cache?.get(key) !== transformed) {
          if (preparing) return undefined;
          continue;
        }
      }
      await TtscGenerationProof.prepare(cached, file, epoch);
      if (cache?.get(key) !== transformed) {
        if (preparing) return undefined;
        continue;
      }
      // No await between this observation and synchronous admission.
      const proof = TtscGenerationProof.create(cached, file, epoch);
      const action = selectCachedGenerationAction({
        proof,
        cache,
        cached,
        epoch,
        file,
        generation: transformed,
        key,
        source,
        reportDivergence: !preparing,
      });
      if (action === "retry") {
        continue;
      }
      if (action === "serve") {
        if (preparing) return undefined;
        return deliverCachedTransform({
          cache,
          cached,
          generation: transformed,
          key,
          epoch,
          file,
          source,
          hooks,
          selection: watchSelection,
        });
      }
      transformed = undefined;
    }

    if (transformed === undefined) {
      transformed = transformProject({
        aliasPaths,
        compilerOptions: options.compilerOptions,
        compilerEnvironment,
        runExternalCode: options.runExternalCode,
        compilerMembership:
          cache === undefined
            ? undefined
            : TRANSFORM_CACHE_MEMBERSHIP_POLICIES.get(cache)?.get(key),
        projectRoot: selectedProjectRoot,
        currentFile: file,
        currentSource: source,
        reportDivergence: !preparing,
        // Stamp the pass this compile was started for, not the one it happens
        // to finish in: a boundary crossed mid-compile leaves the generation
        // belonging to the earlier pass, so the next pass re-proves it.
        deliveryEpoch: epoch,
        filesystem,
        plugins: options.plugins,
        // One bounded recursive project observer witnesses content restored
        // during the compile itself. Build-scoped adapters close it with the
        // attempt; persistent adapters can retain qualified notification proof
        // to avoid repeated walks, without eliminating other delivery checks.
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
        // A cache without a list of its own takes the names the project's
        // record carries from an earlier process (samchon/ttsc#1743).
        witnessedDependencies:
          cache === undefined
            ? undefined
            : (TRANSFORM_CACHE_DEPENDENCY_WITNESSES.get(cache)?.get(key) ??
              recordedDependencyWitnesses(hooks?.project, tsconfig)),
      });
      cache?.set(key, transformed);
    }
    const generation = transformed;
    const cached = await awaitOrEvict(cache, key, generation).catch(
      (rejection: unknown) => {
        if (!preparing)
          notifyRejectedGenerationInputs(
            hooks,
            rejection,
            file,
            watchSelection,
          );
        throw rejection;
      },
    );
    if (cache !== undefined && cache.get(key) !== generation) {
      if (preparing) return undefined;
      continue;
    }
    if (cache !== undefined) {
      let witnesses = TRANSFORM_CACHE_DEPENDENCY_WITNESSES.get(cache);
      if (witnesses === undefined) {
        witnesses = new Map();
        TRANSFORM_CACHE_DEPENDENCY_WITNESSES.set(cache, witnesses);
      }
      witnesses.set(key, cached.externalDependencyInputs ?? []);
      const membership =
        cached.result.type === "exception"
          ? undefined
          : cached.result.graph?.membership;
      if (membership !== undefined) {
        let policies = TRANSFORM_CACHE_MEMBERSHIP_POLICIES.get(cache);
        if (policies === undefined) {
          policies = new Map();
          TRANSFORM_CACHE_MEMBERSHIP_POLICIES.set(cache, policies);
        }
        policies.set(key, membership);
      }
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
    if (preparing) return undefined;
    return deliverCachedTransform({
      cache,
      cached,
      generation,
      key,
      epoch,
      file,
      source,
      hooks,
      selection: watchSelection,
    });
  }
}
