import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { resolveNodeBinary } from "../../../internal/resolveNodeBinary";
import { hasProjectPluginEntries } from "../../../plugin/internal/load/hasProjectPluginEntries";
import { loadProjectPlugins } from "../../../plugin/internal/load/loadProjectPlugins";
import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildOptions } from "../../../structures/internal/TtscBuildOptions";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import type { TtscCommonOptions } from "../../../structures/internal/TtscCommonOptions";
import { outputText } from "../outputText";
import { readProjectConfig } from "../project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../readEffectiveCompilerOptions";
import { resolveBinary } from "../resolveBinary";
import { resolveTsgo } from "../resolveTsgo";
import { TSGO_ARGS_ENV } from "../sharedHost/TSGO_ARGS_ENV";
import { assertSharedHostCompatibility } from "../sharedHost/assertSharedHostCompatibility";
import { clearInheritedSemanticConfigPath } from "../sharedHost/clearInheritedSemanticConfigPath";
import { clearInheritedTsgoArgs } from "../sharedHost/clearInheritedTsgoArgs";
import { inheritedSidecarEnv } from "../sharedHost/inheritedSidecarEnv";
import { linkedTransformPlugins } from "../sharedHost/linkedTransformPlugins";
import { publishLinkedTransformPlugins } from "../sharedHost/publishLinkedTransformPlugins";
import { resolvePluginConfigDir } from "../sharedHost/resolvePluginConfigDir";
import { selectSharedHostPlugin } from "../sharedHost/selectSharedHostPlugin";
import { SidecarEnvironment } from "../sharedHost/SidecarEnvironment";
import { spawnNative } from "../spawnNative";
import { runNativeCheckWithObservations } from "../runNativeCheckWithObservations";
import { BuildTiming } from "./BuildTiming";
import { CompilerDiagnostics } from "./CompilerDiagnostics";
import { NativePluginArguments } from "./NativePluginArguments";
import { PassthroughFlags } from "./PassthroughFlags";
import type { RunBuildOptions } from "./RunBuildOptions";
import { TsgoArguments } from "./TsgoArguments";
import { appendBuildOutput } from "./appendBuildOutput";
import { createProcessDiagnostic } from "./createProcessDiagnostic";
import { isAbsoluteLocalProjectInputPath } from "./isAbsoluteLocalProjectInputPath";
import { mergeProjectInputSnapshots } from "./mergeProjectInputSnapshots";
import { normalizeBuildOutput } from "./normalizeBuildOutput";
import { parseProjectInputSnapshot } from "./parseProjectInputSnapshot";
import { runExternalEmitProvenance } from "./runExternalEmitProvenance";

/**
 * The shared runBuild execution engine: resolve the project and plugins, then
 * run TypeScript-Go directly or through native plugin hosts.
 *
 * {@link runBuild} runs it once per command; {@link ResidentCheckWatchSession}
 * runs the same phases per watch cycle while keeping a check host resident. The
 * shared phases centralize plugin/flag and failed-plugin diagnostic policy.
 * Watch residency and its cycle-specific preparation remain with the watch
 * owner; sharing these operations is not a guarantee of identical invocation
 * inputs or outputs across watch and one-shot runs.
 *
 * @evidence contracts/common.md#principled-implementation Resolution, preparation and ordered execution share selected project/plugin semantics, with independent failed-plugin diagnostic recovery preserving the original failure.
 * @evidence contracts/common.md#clear-and-simple-design The grouping owns build phase policy while native argv, flag classification, diagnostic normalization and watch lifetime remain separate responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Capability-gated host behavior and format-only/terminal lanes follow real supported differences; failure recovery supplements diagnostics without hiding a disproven setup or enabling emission.
 * @evidence contracts/common.md#meaningful-documentation Namespace prose explains common one-shot/watch phases; public comments document policy precedence, environment ownership and returned versus thrown failures.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This namespace grouping has no independent native representation; selected operations acknowledge environment, filesystem and process boundaries individually.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Each selected phase/command function owns its processing strategy; grouping those operations introduces no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace owns no cached selection; resolved context reuse belongs to its operations and the watch session.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No persistent resource is acquired by this namespace; synchronous commands and resident sessions have separate owners.
 */
export namespace BuildExecution {
  /**
   * Merge extra environment variables over `process.env`, always injecting
   * `TTSC_NODE_BINARY` selected by the runtime capability owner. Explicit
   * compatible overrides can select a different Node executable; this is not
   * necessarily the current process binary.
   */
  function mergeEnv(
    extra?: NodeJS.ProcessEnv,
    cwd: string = process.cwd(),
    ...later: readonly (NodeJS.ProcessEnv | undefined)[]
  ): NodeJS.ProcessEnv {
    const env = SidecarEnvironment.merge(process.env, extra, ...later);
    const node = resolveNodeBinary(env, cwd);
    SidecarEnvironment.write(env, "TTSC_NODE_BINARY", node);
    return env;
  }

  /**
   * Build the environment for a native plugin spawn. Injects `TTSC_TSGO_BINARY`
   * and `TTSC_TTSX_BINARY` alongside the base env from `mergeEnv`, plus
   * `TTSC_PLUGIN_CONFIG_DIR` when the caller declared a plugin config anchor
   * (an embedder compiling through a generated wrapper tsconfig) so config-file
   * discovery walks the real project instead of the wrapper's temp-dir
   * ancestry. For transform-stage plugins, also passes
   * `TTSC_LINKED_PLUGINS_JSON` containing any linked sources so they run inside
   * the same process as the host plugin.
   *
   * Caller-provided values override inherited defaults, except the invocation's
   * selected compiler remains authoritative. Absent per-invocation payloads
   * remove stale inherited state rather than leaking an ancestor's project.
   *
   * @evidence contracts/common.md#principled-implementation Environment layering preserves caller overrides while the resolved compiler wins last; per-run compiler/config/link payloads are published or cleared according to invocation ownership.
   * @evidence contracts/common.md#clear-and-simple-design Shared environment helpers own merging and key access; runtime discovery precedes the pure composer that owns invocation payload publication.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported environment channels convey compiler/plugin context without patching strict sidecar parsers; clearing inherited payloads corrects ownership rather than compensating for a stale ancestor selection.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain config anchoring, linked sources, precedence and absent-payload effects without mixing prose into tags.
   * @evidence contracts/portability.md#os-neutral-implementation Native environment helpers normalize Windows key aliases while retaining POSIX case distinctions; node:path builds the default launcher path and binary values remain native executable selections.
   * @evidence contracts/performance.md#efficient-algorithms Environment layering copies inherited/caller fields, and Windows channel reads/writes repeatedly scan native-equivalent key names with key-text normalization costs. Linked selection/projection/JSON adds plugin count and payload work. Ordered runtime-candidate probes are delegated before publication and remain native process costs of this call.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Fresh environment composition depends on current invocation and mutable process environment, and coordinates no persistent producer.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The fresh environment and intermediate linked payload have invocation-local ownership and transfer to the spawn caller. Runtime probe acquisition/timeout/cleanup belongs to the capability owner, not a native-release guarantee made here; this function stores no child handle or global payload.
   */
  export function nativePluginEnv(
    extra: NodeJS.ProcessEnv | undefined,
    execution: ReturnType<typeof resolveExecutionContext>,
    plugin?: ITtscLoadedNativePlugin,
    tsgoArgs?: string,
  ): NodeJS.ProcessEnv {
    const env = mergeEnv(
      {
        ...(execution.pluginConfigDir === undefined
          ? {}
          : { TTSC_PLUGIN_CONFIG_DIR: execution.pluginConfigDir }),
        TTSC_TTSX_BINARY:
          process.env.TTSC_TTSX_BINARY ??
          path.join(__dirname, "..", "..", "..", "launcher", "ttsx.js"),
      },
      execution.projectRoot,
      extra,
      // The invocation's resolved compiler owns the final environment layer.
      { TTSC_TSGO_BINARY: execution.tsgo.binary },
    );
    return composeNativePluginEnv(
      env,
      extra,
      execution,
      SidecarEnvironment.read(env, "TTSC_NODE_BINARY"),
      plugin,
      tsgoArgs,
    );
  }

  /**
   * Publish this invocation's payloads into its already layered environment.
   *
   * The caller owns the fresh environment and the selected Node executable.
   * Executable capability discovery remains at the native spawn boundary;
   * this composer only writes protocol values and removes stale payloads.
   *
   * @evidence contracts/common.md#principled-implementation The selected compiler and Node executable own their channels; config, forwarded arguments and linked transforms are published or cleared according to this invocation and explicit caller ownership.
   * @evidence contracts/common.md#clear-and-simple-design A synchronous payload composer consumes the existing merged environment, keeping native executable discovery in nativePluginEnv without copying environment layers again.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied executable selections are preserved without guessing capabilities, launching a substitute producer or mutating the global environment.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the required fresh layered environment, caller ownership and the separation of runtime discovery from protocol publication.
   * @evidence contracts/portability.md#os-neutral-implementation SidecarEnvironment preserves native Windows name identity and POSIX spelling; executable values are supplied native paths rather than shell commands.
   * @evidence contracts/performance.md#efficient-algorithms Protocol channel reads/writes include Windows environment-name scans and key-text costs. Transform-stage publication also filters P native plugins and projects/JSON-serializes linked config/name/stage values with ordinary JSON conversion/error semantics. No capability subprocess or extra environment-layer merge is performed by this composer.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Invocation-owned writes apply to current mutable caller state rather than a reusable producer computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The supplied environment remains caller-owned and is returned without retaining it or acquiring a child process.
   */
  export function composeNativePluginEnv(
    env: NodeJS.ProcessEnv,
    extra: NodeJS.ProcessEnv | undefined,
    execution: ReturnType<typeof resolveExecutionContext>,
    nodeBinary: string | undefined,
    plugin?: ITtscLoadedNativePlugin,
    tsgoArgs?: string,
  ): NodeJS.ProcessEnv {
    SidecarEnvironment.write(env, "TTSC_NODE_BINARY", nodeBinary);
    SidecarEnvironment.write(env, "TTSC_TSGO_BINARY", execution.tsgo.binary);
    // Forwarded tsgo argv is per-invocation state this host owns, exactly like
    // the config anchor below: publish this run's payload, or drop whatever an
    // ancestor ttsc process left behind when this lane forwards nothing.
    if (tsgoArgs !== undefined) {
      SidecarEnvironment.write(env, TSGO_ARGS_ENV, tsgoArgs);
    } else {
      clearInheritedTsgoArgs(env, extra);
    }
    clearInheritedSemanticConfigPath(env, extra);
    // The anchor is per-invocation state owned by this host: when this run
    // declared none (and the caller's env does not name one), drop any value
    // inherited from an ancestor ttsc process so a nested build never
    // mis-anchors its plugins at the outer project.
    SidecarEnvironment.write(
      env,
      "TTSC_PLUGIN_CONFIG_DIR",
      SidecarEnvironment.read(extra, "TTSC_PLUGIN_CONFIG_DIR") ??
        execution.pluginConfigDir,
    );
    publishLinkedTransformPlugins(
      env,
      extra,
      plugin?.stage === "transform"
        ? linkedTransformPlugins(execution.nativePlugins)
        : [],
    );
    return env;
  }

  /**
   * Finish the setup phase of one build: record its timing, apply the project's
   * own `noEmit`, and report the project's non-TypeScript inputs to a watching
   * caller.
   *
   * Returns a finished `result` alongside effective options when plugin setup
   * failed, so plugin compilation/emission is skipped. An independent no-emit
   * compiler pass may still collect TypeScript diagnostics alongside it.
   * Input-discovery, recovery and caller callback exceptions propagate rather
   * than being converted to another completed setup result.
   *
   * @evidence contracts/common.md#principled-implementation Project noEmit is applied before dispatch; setup failure remains the result while independent diagnostic recovery may supplement it, and successful watch setup reports real dependency snapshots.
   * @evidence contracts/common.md#clear-and-simple-design Preparation separates setup timing, effective options and dependency reporting from compile execution, returning an explicit finished-result alternative.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Setup failure prevents plugin execution instead of retrying a malformed setup; independent type checking preserves the original failure rather than replacing it.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish skipped plugin emission from permitted independent diagnostics and explain watch-input reporting.
   * @evidence contracts/portability.md#os-neutral-implementation Native input discovery delegates spawning and identity reconciliation to the established process/filesystem boundaries; selected execution paths are preserved.
   * @evidence contracts/performance.md#efficient-algorithms Preparation records one optional timing line and applies options, potentially shallow-copying their fields. Applicable recovery/discovery adds argument/env projection, native child/runtime, snapshot or diagnostic text processing; supplied callback work is also part of this call and can throw. Fixed orchestration branches do not bound those inputs or duration.
   * @evidence contracts/performance.md#reuse-equivalent-work The resolved execution and setup result are reused by the build phase instead of reloading plugins or the project.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Preparation returns build-local state and uses synchronous discovery/check operations; retained watch state belongs to its caller.
   */
  export function prepareBuildExecution(
    options: RunBuildOptions,
    timing: BuildTiming.BuildTiming,
    execution: ReturnType<typeof resolveExecutionContext>,
    setupStartedAt: bigint,
  ): { buildOptions: RunBuildOptions; result?: TtscBuildResult } {
    if (
      execution.nativePlugins.length > 0 ||
      execution.pluginSetupFailure !== undefined
    ) {
      BuildTiming.recordTiming(
        timing,
        "ttsc plugin setup time",
        setupStartedAt,
      );
    }
    const buildOptions = applyProjectNoEmit(options, execution);
    if (execution.pluginSetupFailure !== undefined) {
      return {
        buildOptions,
        result: appendTypeScriptDiagnosticsAfterPluginFailure(
          execution.pluginSetupFailure,
          buildOptions,
          execution,
        ),
      };
    }
    if (options.onProjectInputs !== undefined) {
      options.onProjectInputs(discoverNativeProjectInputs(options, execution));
    }
    return { buildOptions };
  }

  /**
   * Run the compile phase of a prepared build.
   *
   * With native plugins, check-stage hosts run first and a failure stops the
   * build (with TypeScript diagnostics collected separately when the host did
   * not report them); transform-stage hosts then emit through one shared host.
   * Without plugins, TypeScript-Go runs directly.
   *
   * Format mode only performs configured formatting and never adds an unrelated
   * type-check or transform pass. Launch and compatibility errors may throw.
   * Required emit provenance keeps the selected producer: an opted-in native
   * host reports its captured generation, while the direct compiler adapter
   * admits only a stable observed selection and supported output layout.
   * Unknown ownership remains explicit for consumers rather than guessed.
   *
   * @evidence contracts/common.md#principled-implementation Ordered checks block emit on failure and retain negotiated same-generation input observations; transforms use one compatible host. Normally completed native partial emission and supported stable external emission can retain actual-write provenance alongside unchanged nonzero status, while interrupted or unknown generations establish no proof.
   * @evidence contracts/common.md#clear-and-simple-design This dispatcher owns phase policy while argv, spawning, normalization and fallback comparison remain shared helpers used by one-shot and watch lanes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Format bypass follows its write-only contract; capability-based diagnostics/provenance and failure fallback preserve supported producer semantics without plugin-name shortcuts, foreign mutation or filename-based ownership guesses.
   * @evidence contracts/common.md#meaningful-documentation Native prose states ordering, format effects and thrown boundary failures; branch comments explain nonobvious emission and display policies.
   * @evidence contracts/portability.md#os-neutral-implementation Commands preserve native executable/argv/cwd boundaries; provenance uses a canonical unique temporary directory and absolute native wire paths without post-compile realpath reconstruction or OS-derived case folding.
   * @evidence contracts/performance.md#efficient-algorithms Plugin selection scans the configured population; required external proof adds read-only compiler probes and linear source/executable-byte observations, while phase output accumulation may recopy earlier report bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work A check host declaring TypeScript diagnostics avoids an equivalent extra successful check, while compatible transform plugins share one host; effectful configured checks still execute in order.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Command/proof bytes grow with reports and output-source associations, but remain build-local; native proof owns one private file/directory released with directory-identity checks in finally on success, nonzero or throw. Replaced directories stay untouched and cleanup failure preserves the primary outcome; no history or resident sidecar is retained.
   */
  export function runPreparedBuild(
    options: RunBuildOptions,
    timing: BuildTiming.BuildTiming,
    execution: ReturnType<typeof resolveExecutionContext>,
    buildOptions: RunBuildOptions,
  ): TtscBuildResult {
    if (execution.nativePlugins.length > 0) {
      const compilers = execution.nativePlugins.filter(
        (plugin) => plugin.stage === "transform",
      );
      const checked = runNativeCheckPlugins(buildOptions, execution, timing);
      if (checked.status !== 0) {
        return appendTypeScriptDiagnosticsAfterPluginFailure(
          checked,
          buildOptions,
          execution,
        );
      }

      if (buildOptions.emit === false) {
        if (buildOptions.format === true) {
          // Format mode is write-only by contract: the lint sidecar
          // already rewrote source files and reported nothing. Running
          // tsgo --noEmit OR a transform compiler afterwards would either
          // surface unrelated type errors as if they were format failures
          // (tsgo path) or apply transform-stage rewrites on top of the
          // formatted source (transform path), both of which break the
          // documented "ttsc format only formats" guarantee. The
          // short-circuit fires before either branch so format mode is a
          // single concern regardless of how many compilers the project
          // configures. Callers that want a recheck or a transform pass
          // after format should run `ttsc check` / `ttsc build` as a
          // separate invocation.
          return checked;
        }
        if (compilers.length !== 0) {
          assertSharedHostCompatibility(compilers, "emit");
          const compiled = buildWithNativeCompilerPlugins(
            buildOptions,
            execution,
            compilers,
            timing,
          );
          const result = appendBuildOutput(checked, compiled);
          return compiled.status === 0
            ? result
            : appendTypeScriptDiagnosticsAfterPluginFailure(
                result,
                buildOptions,
                execution,
              );
        }
        if (checkPluginsReportTypeScriptDiagnostics(execution.nativePlugins)) {
          return checked;
        }
        return appendBuildOutput(
          checked,
          runTsgo(execution, ["--noEmit"], buildOptions),
        );
      }

      let result: TtscBuildResult;
      if (compilers.length !== 0) {
        assertSharedHostCompatibility(compilers, "emit");
        const compiled = buildWithNativeCompilerPlugins(
          buildOptions,
          execution,
          compilers,
          timing,
        );
        result = appendBuildOutput(checked, compiled);
        if (compiled.status !== 0) {
          result = appendTypeScriptDiagnosticsAfterPluginFailure(
            result,
            buildOptions,
            execution,
          );
        }
      } else {
        if (
          buildOptions.skipDiagnosticsCheck !== true &&
          !checkPluginsReportTypeScriptDiagnostics(execution.nativePlugins) &&
          !PassthroughFlags.forwardsTerminalTsgoFlag(buildOptions)
        ) {
          const tsgoChecked = runTsgo(execution, ["--noEmit"], buildOptions);
          if (tsgoChecked.status !== 0) {
            return appendBuildOutput(checked, tsgoChecked);
          }
        }
        const args = TsgoArguments.createTsgoBuildArgs(
          execution,
          buildOptions,
          {
            listEmittedFiles: buildOptions.forceListEmittedFiles === true,
          },
        );
        const emitted = runTsgoBuild(execution, buildOptions, args);
        result = appendBuildOutput(checked, emitted);
      }

      return result;
    }

    if (buildOptions.format === true) {
      // Format mode is write-only by contract — see the matching
      // short-circuit in the with-native-plugins branch above. When no
      // native plugin is loaded there is nothing for `ttsc format` to
      // rewrite, so emit an empty success result rather than falling
      // through to a tsgo pass that would surface unrelated type errors
      // as if they were format failures.
      return {
        diagnostics: [],
        status: 0,
        stdout: "",
        stderr: "",
      };
    }

    const args = TsgoArguments.createTsgoBuildArgs(execution, buildOptions, {
      // `--verbose` promises the emitted-file list on every lane, and the list
      // only exists if tsgo is asked for it. ttsc adds the flag for itself here
      // exactly as it does for `forceListEmittedFiles`, and strips the raw
      // `TSFILE:` lines back out below.
      listEmittedFiles:
        buildOptions.emit !== false &&
        (buildOptions.forceListEmittedFiles === true ||
          buildOptions.quiet === false),
      noEmitOnError:
        buildOptions.emit !== false &&
        buildOptions.skipDiagnosticsCheck !== true &&
        !PassthroughFlags.forwardsTerminalTsgoFlag(buildOptions),
    });
    return runTsgoBuild(execution, buildOptions, args);
  }

  /**
   * Answer a forwarded terminal flag whose meaning precedes a project, when no
   * project can be resolved.
   *
   * `ttsc --init` exists to write the starter `tsconfig.json`, and `ttsc --all`
   * / `ttsc -?` only print tsgo's help: none of them needs a project, so a
   * project-resolution failure must not stop them. The classification is `FLAG_SCHEMA`'s (`terminal` +
   * `projectFree`), so marking a further flag project-free needs no edit here.
   *
   * A resolvable project keeps the established lane untouched: the build path
   * still forwards the flag with `-p <tsconfig>` from the project root, so
   * `ttsc --init` inside an existing project still reports tsgo's TS5054
   * instead of writing a second config into the current directory. Returns
   * `null` when this lane does not apply.
   *
   * @evidence contracts/common.md#principled-implementation Schema project-free terminal semantics permit compiler execution after any project resolution failure; an existing selected project returns null so its ordinary compiler answer remains authoritative.
   * @evidence contracts/common.md#clear-and-simple-design A narrow early lane probes project availability before direct terminal execution and leaves all project-dependent builds to shared preparation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The caught resolution failure is legitimate only for commands not requiring a project; ordinary compilation failures do not enter this bypass.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain project-independent commands, existing-project behavior and null applicability; the catch comment states its deliberate broad premise.
   * @evidence contracts/portability.md#os-neutral-implementation Invocation cwd is resolved natively and spawnNative receives executable/argv separately with platform-aware environment merging.
   * @evidence contracts/performance.md#efficient-algorithms Nonapplicable flag selection exits before config IO; an applicable lane performs one project probe and one selected compiler command.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A project probe and effectful terminal invocation establish no retained or shared cross-request result.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous terminal process completes before normalization and no process or project probe state is retained.
   */
  export function runProjectFreeTerminalFlag(
    options: RunBuildOptions,
  ): TtscBuildResult | null {
    if (!PassthroughFlags.forwardsProjectFreeTerminalTsgoFlag(options))
      return null;
    if (options.resolvedProject !== undefined) return null;
    const cwd = path.resolve(options.cwd ?? process.cwd());
    try {
      readProjectConfig({
        cwd,
        projectRoot: options.projectRoot,
        tsconfig: options.tsconfig,
      });
      return null;
    } catch {
      // Any resolution failure takes this branch, not only "not found": a
      // malformed config and an explicitly named missing `-p` path are equally
      // beside the point for a flag whose meaning does not presuppose a project.
      // Forward it to tsgo from the invocation directory instead of failing.
    }
    const tsgo = resolveTsgo({ ...options, cwd });
    const res = spawnNative(tsgo.binary, [...(options.passthrough ?? [])], {
      cwd,
      env: mergeEnv(options.env, cwd),
      encoding: "utf8",
    });
    if (res.error) {
      throw new Error(
        `ttsc: failed to spawn ${tsgo.binary}: ${res.error.message}`,
      );
    }
    return normalizeBuildOutput(
      {
        status: res.status ?? 1,
        stdout: outputText(res.stdout),
        stderr: outputText(res.stderr),
      },
      cwd,
    );
  }

  /**
   * A tsconfig-level `noEmit: true` is an analysis-only build unless the user
   * explicitly asks `ttsc --emit` to override it. Treat it like CLI `--noEmit`
   * before composing tsgo/native-host arguments so ttsc does not add emit-only
   * guards around projects that cannot emit.
   *
   * @evidence contracts/common.md#principled-implementation An explicit emit selection takes precedence; only absent selection combined with project noEmit maps to analysis-only options.
   * @evidence contracts/common.md#clear-and-simple-design A small shared option adapter applies project policy once before either native or direct argument composition.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This reflects declared project and caller policy instead of special-casing particular configs or mutating compiler internals.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains explicit override precedence and why application precedes argument composition.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Selecting an emit boolean accesses no native filesystem, path or process boundary.
   *
   * @evidence contracts/performance.md#efficient-algorithms Two scalar checks return the original options when possible; only a changed policy requires a shallow copy of option fields.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This policy adapter does not coordinate a repeated producer or persistent result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Option ownership remains with the caller and no retained state or handle is acquired.
   */
  export function applyProjectNoEmit(
    options: RunBuildOptions,
    execution: ReturnType<typeof resolveExecutionContext>,
  ): RunBuildOptions {
    if (options.emit !== undefined || execution.projectNoEmit !== true) {
      return options;
    }
    return { ...options, emit: false };
  }

  /**
   * Whether a check-stage host declares reporting TypeScript's diagnostics,
   * in which case another pass can duplicate already-reported diagnostics.
   * This trusts an explicit descriptor contract; it does not independently
   * measure the completed host's diagnostic completeness or success.
   *
   * @evidence contracts/common.md#principled-implementation Only check-stage descriptors explicitly declaring TypeScript diagnostic reporting satisfy the predicate; transform metadata cannot supply that declaration. The dispatcher owns when it may trust this contract rather than treating a true predicate as observed runtime completeness.
   * @evidence contracts/common.md#clear-and-simple-design One capability query is shared by both analysis and emission orchestration rather than duplicating plugin classifications.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Descriptor semantics drive diagnostic policy without recognizing particular plugin names or trusting a previous passing example.
   * @evidence contracts/common.md#meaningful-documentation Native prose gives the declared reporting premise and why a redundant type check should be avoided.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Inspecting stage/reporting metadata does not access native paths or processes.
   *
   * @evidence contracts/performance.md#efficient-algorithms A short-circuit scan performs O(plugin count) scalar checks without allocating a filtered population.
   * @evidence contracts/performance.md#reuse-equivalent-work This predicate identifies the descriptor guarantee that permits a completed check's TypeScript diagnostics to serve the following build phase; the owning dispatcher determines when it applies.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The capability query retains no descriptor history or process handle.
   */
  export function checkPluginsReportTypeScriptDiagnostics(
    plugins: readonly ITtscLoadedNativePlugin[],
  ): boolean {
    return plugins.some(
      (plugin) =>
        plugin.stage === "check" &&
        plugin.reportsTypeScriptDiagnostics === true,
    );
  }

  /**
   * Preserve a failed plugin's output and status while collecting TypeScript
   * diagnostics through an independent no-emit pass.
   *
   * A sidecar can fail before it loads the project Program, including when a Go
   * panic or another runtime error terminates the process. The plugin failure
   * must still block emit, but it must not hide unrelated errors in the user's
   * TypeScript source. The fallback runs only after a plugin failure, skips
   * modes whose contract intentionally omits diagnostics, and avoids appending
   * a batch the plugin already reported itself. A returned recovery preserves
   * the original status; secondary compiler/environment/normalization errors
   * can propagate before that result merge. NoEmit prevents compiler emission,
   * not unrelated native/cache effects or incremental metadata writes.
   *
   * @evidence contracts/common.md#principled-implementation An independent no-emit pass adds only unreported diagnostics, seeds an otherwise unstructured plugin failure when needed and restores the original failure status after output merging.
   * @evidence contracts/common.md#clear-and-simple-design Recovery policy, compiler execution and diagnostic identity comparison are separate shared operations, with one result merge preserving the failed producer's ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The second pass addresses a supported failed-sidecar reporting gap; it never retries emission or converts the plugin failure into a successful build.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain independent diagnostics, blocked emission, excluded modes and duplicate suppression; the seeding comment explains structured-consumer visibility.
   * @evidence contracts/portability.md#os-neutral-implementation Compiler execution uses the selected native binary/cwd; diagnostic filenames normalize against the same project root through the shared parser.
   * @evidence contracts/performance.md#efficient-algorithms Excluded modes use scalar checks and the delegated forwarded-frame terminal selector. Applicable recovery adds option copy/pretty filtering, one native compiler check, indexed diagnostic/text selection and output merging; argument/environment/path/report bytes and child runtime remain inputs to the work.
   * @evidence contracts/performance.md#reuse-equivalent-work Existing reported diagnostics suppress equivalent fallback reports, while failed plugin execution cannot guarantee a complete Program check and therefore cannot replace this independent pass.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The fallback runs synchronously without a timeout supplied here. Intermediate failure/check/selected records and text remain live through merge; returned records transfer to the caller and no historical cache is retained. Delegated capture release is best effort, not a certificate that native descendants or failed cleanup resources were released.
   */
  export function appendTypeScriptDiagnosticsAfterPluginFailure(
    failure: TtscBuildResult,
    options: RunBuildOptions,
    execution: ReturnType<typeof resolveExecutionContext>,
  ): TtscBuildResult {
    if (
      options.format === true ||
      options.skipDiagnosticsCheck === true ||
      PassthroughFlags.forwardsTerminalTsgoFlag(options)
    ) {
      return failure;
    }
    const typechecked = runTsgo(
      execution,
      ["--noEmit"],
      createPluginFailureTypecheckOptions(options),
    );
    const fallback = CompilerDiagnostics.filterReportedTypeScriptDiagnostics(
      failure,
      typechecked,
      execution.projectRoot,
    );
    if (fallback === null) {
      return failure;
    }
    // Structured consumers (the public API's `IFailure.diagnostics`) never see
    // stdout/stderr, so a plugin failure that reported no parsable diagnostics
    // must be seeded as one before recovered TypeScript diagnostics are appended
    // — otherwise the recovery would replace the plugin error with unrelated
    // type errors instead of surfacing both.
    const seeded =
      failure.diagnostics.length === 0
        ? { ...failure, diagnostics: [createProcessDiagnostic(failure)] }
        : failure;
    const status = failure.status;
    return {
      ...appendBuildOutput(seeded, fallback),
      status,
    };
  }

  /**
   * Make the recovery pass parseable regardless of the user's display flags.
   * This is an internal second pass, so plain output is required to remove only
   * diagnostics that the failed plugin already printed.
   */
  function createPluginFailureTypecheckOptions(
    options: RunBuildOptions,
  ): RunBuildOptions {
    return {
      ...options,
      passthrough: PassthroughFlags.withoutBooleanFlags(
        options.passthrough ?? [],
        ["--pretty"],
      ),
      structuredDiagnostics: true,
    };
  }

  /**
   * Dispatch a build through the shared-host native plugin. The host plugin is
   * the one that owns the process (non-linked); all other transform plugins
   * ride inside it via the `--plugins-json` flag.
   */
  function buildWithNativeCompilerPlugins(
    options: RunBuildOptions,
    execution: ReturnType<typeof resolveExecutionContext>,
    plugins: readonly ITtscLoadedNativePlugin[],
    timing: BuildTiming.BuildTiming,
  ): TtscBuildResult {
    const host = selectSharedHostPlugin(plugins);
    const run = (provenancePath?: string): TtscBuildResult =>
      runNativePluginCommand(
        host,
        NativePluginArguments.createNativeBuildArgs(
          execution,
          options,
          plugins,
          provenancePath,
        ),
        options,
        execution,
        "ttsc.build",
        timing,
        NativePluginArguments.transformHostTimingLabel(plugins),
        TsgoArguments.createNativeBuildTsgoArgs(execution, options),
      );
    if (options.forceEmitProvenance !== true) return run();
    if (host.capabilities?.emitProvenance !== true) {
      throw new Error(
        `ttsc: selected native compiler host ${host.name ?? host.binary} does not support required emit provenance`,
      );
    }
    return captureNativeEmitProvenance(run);
  }

  /**
   * Read an opted-in producer's normally completed emit proof through a unique
   * private artifact, including writes preceding an emit diagnostic. Nonzero
   * status and diagnostics remain unchanged; missing or invalid failed-run
   * metadata supplies no proof. Interrupted runs never admit an artifact.
   * Removal targets only the artifact and its empty, identity-checked
   * directory; a cleanup failure preserves an earlier thrown error or nonzero
   * compiler result as its aggregate cause, including the original diagnostics
   * and text.
   */
  function captureNativeEmitProvenance(
    run: (provenancePath: string) => TtscBuildResult,
  ): TtscBuildResult {
    const directory = createCanonicalTempDirectory("ttsc-emit-provenance-");
    const ownership = fs.lstatSync(directory);
    const provenancePath = path.join(directory, "emitted-sources.json");
    let completed: TtscBuildResult | undefined;
    let failed = false;
    let failure: unknown;
    try {
      const result = run(provenancePath);
      completed = result;
      if (result.processCompletedNormally !== true) return result;
      let value: unknown;
      try {
        assertEmitProvenanceDirectory(directory, ownership);
        if (!fs.lstatSync(provenancePath).isFile())
          throw new Error(
            "ttsc: native emit provenance is not an ordinary file",
          );
        value = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
      } catch (error) {
        if (
          result.status !== 0 &&
          (error instanceof SyntaxError ||
            (error as NodeJS.ErrnoException).code === "ENOENT")
        )
          return result;
        throw new Error("ttsc: native emit provenance could not be read", {
          cause: new AggregateError([result, error]),
        });
      }
      if (!isEmitProvenance(value)) {
        if (result.status !== 0) return result;
        throw new Error(
          "ttsc: native compiler returned invalid emit provenance",
          {
            cause: result,
          },
        );
      }
      return { ...result, emittedSources: value };
    } catch (error) {
      failed = true;
      failure = error;
      throw error;
    } finally {
      try {
        assertEmitProvenanceDirectory(directory, ownership);
        fs.rmSync(provenancePath, { force: true });
        fs.rmdirSync(directory);
      } catch (error) {
        if (failed) {
          throw new AggregateError(
            [failure, error],
            "ttsc: native emit provenance failed and its private artifact could not be released",
            { cause: failure },
          );
        }
        if (completed !== undefined && completed.status !== 0) {
          throw new AggregateError(
            [completed, error],
            `ttsc: native compiler exited with status ${String(completed.status)} and its private emit provenance artifact could not be released`,
            { cause: completed },
          );
        }
        throw error;
      }
    }
  }

  /** Refuse artifact IO or deletion through a replaced private directory. */
  function assertEmitProvenanceDirectory(
    directory: string,
    captured: fs.Stats,
  ): void {
    const current = fs.lstatSync(directory);
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      current.dev !== captured.dev ||
      current.ino !== captured.ino
    )
      throw new Error(
        "ttsc: native emit provenance directory ownership changed",
      );
  }

  /**
   * Validate the native wire representation without re-resolving compile-time
   * identities against a potentially changed filesystem. Empty and ambiguous
   * source lists stay intact; they cannot justify unique runtime routing.
   */
  function isEmitProvenance(
    value: unknown,
  ): value is Record<string, readonly string[]> {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.entries(value).every(
        ([output, sources]) =>
          isAbsoluteLocalProjectInputPath(output) &&
          Array.isArray(sources) &&
          sources.every(
            (source: unknown) =>
              typeof source === "string" &&
              isAbsoluteLocalProjectInputPath(source),
          ),
      )
    );
  }

  /**
   * Run `tsgo -p <tsconfig> [extraArgs]` and return the normalized result. Used
   * for the no-emit type-check pass that precedes file emission.
   *
   * `extraArgs` follow the forwarded flags: they are this pass's own contract
   * (`--noEmit`), and a runtime build that re-enables emit after the user's
   * flags must not turn its check pass into a second emit.
   *
   * @evidence contracts/common.md#principled-implementation Pass-owned extra flags follow forwarded flags, so noEmit cannot be overridden into accidental emission; output isolation remains final even for incremental build information.
   * @evidence contracts/common.md#clear-and-simple-design One synchronous compiler boundary composes diagnostics/threading and delegates normalization, serving all independent check operations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported compiler options express the check contract without intercepting writes or replacing compiler APIs; spawn errors remain errors.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains the no-emit use and load-bearing argument precedence.
   * @evidence contracts/portability.md#os-neutral-implementation spawnNative uses the selected executable, separate argv and project cwd; environment composition handles native variable aliases and output text decoding is explicit UTF-8.
   * @evidence contracts/performance.md#efficient-algorithms One argv composition includes delegated option-presence classification, threading/isolation text and argument copies. Environment composition can perform native runtime capability probes before the compiler launch; complete capture/decoding and diagnostic normalization follow. Work/storage depend on argument/env/path/report bytes and native child work, without an asserted measured cost ranking.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This executes the requested compiler pass; equivalence with other phases must be established by orchestration rather than caching a result here.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous compiler call has no timeout or output-byte ceiling supplied here. Output/diagnostic records transfer to the caller; delegated file capture attempts cleanup with suppressed errors, so native release and inherited descendants are not certified by returning.
   */
  export function runTsgo(
    execution: ReturnType<typeof resolveExecutionContext>,
    extraArgs: readonly string[],
    options: RunBuildOptions,
  ): TtscBuildResult {
    const res = spawnNative(
      execution.tsgo.binary,
      [
        "-p",
        execution.tsconfig,
        ...TsgoArguments.createTsgoDiagnosticArgs(options),
        ...TsgoArguments.createTsgoThreadingArgs(options),
        ...(options.passthrough ?? []),
        ...extraArgs,
        ...TsgoArguments.isolatedTsgoOutputArgs(options),
      ],
      {
        cwd: execution.projectRoot,
        env: mergeEnv(options.env, execution.projectRoot),
        encoding: "utf8",
      },
    );
    if (res.error) {
      throw new Error(
        "ttsc: failed to spawn " +
          execution.tsgo.binary +
          ": " +
          res.error.message,
      );
    }
    return normalizeBuildOutput(
      {
        status: res.status ?? 1,
        stdout: outputText(res.stdout),
        stderr: outputText(res.stderr),
      },
      execution.projectRoot,
    );
  }

  /**
   * Run `tsgo` with the full emit arguments and parse `TSFILE:` lines from
   * stdout into `emittedFiles`. Internally requested TSFILE lines are stripped;
   * a user's own listEmittedFiles selection preserves its displayed listing.
   * Required provenance observes this same selected executable before and after
   * its single emitting run; unsupported or unstable relations stay unknown.
   */
  function runTsgoBuild(
    execution: ReturnType<typeof resolveExecutionContext>,
    options: RunBuildOptions,
    args: readonly string[],
  ): TtscBuildResult {
    const env = mergeEnv(options.env, execution.projectRoot);
    const userOptions = readEffectiveCompilerOptions(
      execution.project,
      options.passthrough,
      execution.tsgo.binary,
      env,
    );
    const userListedEmitted = userOptions?.("listEmittedFiles") === true;
    const run = (
      commandArgs: readonly string[],
    ): { result: TtscBuildResult; completedNormally: boolean } => {
      const res = spawnNative(execution.tsgo.binary, commandArgs, {
        cwd: execution.projectRoot,
        env,
        encoding: "utf8",
      });
      if (res.error) {
        throw new Error(
          "ttsc.build: failed to spawn " +
            execution.tsgo.binary +
            ": " +
            res.error.message,
        );
      }
      const captured = {
        status: res.status ?? 1,
        stdout: outputText(res.stdout),
        stderr: outputText(res.stderr),
      };
      // Collect structured diagnostics now, but keep captured streams in their
      // producer channels until listing/provenance and display handling finish.
      return {
        completedNormally: res.status !== null && res.signal === null,
        result: {
          ...normalizeBuildOutput(captured, execution.projectRoot),
          stdout: captured.stdout,
          stderr: captured.stderr,
        },
      };
    };
    const result =
      options.forceEmitProvenance === true
        ? runExternalEmitProvenance({
            args,
            binary: execution.tsgo.binary,
            cwd: execution.projectRoot,
            env,
            run,
          })
        : run(args).result;
    const displayed = applyEmittedFileListing(result, userListedEmitted);
    const emittedFiles = displayed.emittedFiles ?? [];
    if (options.quiet === false) {
      // A producer's last stdout line (the tsgo statistics block ends without a
      // newline) must not swallow the summary's first marker.
      if (displayed.stdout.length !== 0 && !displayed.stdout.endsWith("\n")) {
        displayed.stdout += "\n";
      }
      displayed.stdout += verboseBuildSummary(execution, options, emittedFiles);
    }
    return normalizeBuildOutput(displayed, execution.projectRoot);
  }

  /**
   * Retain emitted-file metadata while displaying only user-selected listing.
   * The caller supplies the original effective option before internally added
   * reporting flags. Status, diagnostics and other producer facts are preserved.
   *
   * @evidence contracts/common.md#principled-implementation TSFILE lines establish reported emitted files, while the original effective boolean alone owns their user-visible display; internal reporting does not enable the user's option.
   * @evidence contracts/common.md#clear-and-simple-design One pure operation separates metadata collection from display and is shared by the actual direct compiler build path.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No producer status or diagnostic is replaced, and option presence is not substituted for the effective config and ordered assignment value.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains original option ownership, internally added reporting and retained producer facts.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This stream calculation acquires no native capability; compiler spawning and path representation remain with their existing owners.
   * @evidence contracts/performance.md#efficient-algorithms Parsing and optional stripping each scan the captured output once; time and transient text/path storage are linear in the output bytes.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each completed producer result has its own bytes and requested display value; no history or shared computation is retained.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The copied result and emitted-file array transfer to the caller without retaining a process or handle.
   */
  export function applyEmittedFileListing(
    result: TtscBuildResult,
    displayListing: boolean,
  ): TtscBuildResult {
    const emittedFiles = parseEmittedFiles(result.stdout);
    return {
      ...result,
      emittedFiles,
      stdout: displayListing || emittedFiles.length === 0
        ? result.stdout
        : stripEmittedFileLines(result.stdout),
    };
  }

  /**
   * The `--verbose` summary for the direct-tsgo lane, in the shape
   * `cmd/ttsc/build.go` already prints on the native-host lane.
   *
   * Verbosity is a launcher-owned presentation concern: which lane `runBuild`
   * selects is an implementation detail the user cannot see, so a documented
   * flag must not change meaning with it.
   *
   * `sites=0` is a fact about this lane rather than a placeholder: it runs
   * without a transform-stage host, even if check-stage plugins ran earlier. An
   * emitting build with no files prints `emitted=0 files`; an analysis-only
   * build prints no emitted count.
   */
  function verboseBuildSummary(
    execution: ReturnType<typeof resolveExecutionContext>,
    options: RunBuildOptions,
    emittedFiles: readonly string[],
  ): string {
    const lines = [
      `// ttsc: tsconfig=${execution.tsconfig} cwd=${execution.cwd} sites=0 emit=${options.emit !== false}`,
    ];
    if (options.emit !== false) {
      lines.push(`// ttsc: emitted=${emittedFiles.length} files`);
      for (const file of emittedFiles) {
        lines.push(`  + ${path.relative(execution.cwd, file) || file}`);
      }
    }
    return `${lines.join("\n")}\n`;
  }

  /**
   * Run every check-stage plugin in order, short-circuiting on the first
   * non-zero exit. Aggregates diagnostics and output across all check plugins.
   * Opted-in observations come from that same check generation; undeclared
   * transport leaves the host's original argv and input contract intact.
   */
  function runNativeCheckPlugins(
    options: TtscBuildOptions,
    execution: ReturnType<typeof resolveExecutionContext>,
    timing: BuildTiming.BuildTiming,
  ): TtscBuildResult {
    let out: TtscBuildResult = {
      diagnostics: [],
      status: 0,
      stdout: "",
      stderr: "",
    };
    for (const plugin of execution.nativePlugins.filter(
      (plugin) => plugin.stage === "check",
    )) {
      const args = NativePluginArguments.createNativeCheckArgs(
        execution,
        options,
        plugin,
      );
      const result = runNativeCheckWithObservations(plugin, (extraArgs) =>
        runNativePluginCommand(
          plugin,
          [...args, ...extraArgs],
          options,
          execution,
          "ttsc.check",
          timing,
          `ttsc check plugin ${plugin.name} time`,
          TsgoArguments.createNativeTsgoArgs(options),
        ),
      );
      out = appendBuildOutput(out, result);
      if (result.status !== 0) {
        return out;
      }
    }
    return out;
  }

  /**
   * Ask every check-stage host that declares the `projectInputs` capability for
   * the files its rules read beyond the TypeScript Program, and merge the
   * answers into one snapshot for watch and cache invalidation.
   *
   * Launch, nonzero query results and invalid snapshots throw instead of
   * leaving a declared dependency unwatched. The selected project root must
   * agree with every contributing snapshot after filesystem identity
   * resolution.
   *
   * @evidence contracts/common.md#principled-implementation Only capable check hosts are queried, their JSON and native paths are validated, and identity-based merging rejects contributions anchored at another project.
   * @evidence contracts/common.md#clear-and-simple-design Discovery owns host selection/execution while parsing and alias-preserving reconciliation remain dedicated operations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported hosts are not probed by guessed names, and invalid query output is rejected instead of silently dropping declared dependencies.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain dependency purpose, thrown query/validation failures and shared-root enforcement.
   * @evidence contracts/portability.md#os-neutral-implementation Native spawning preserves cwd/argv and the path classifier plus identity resolver distinguish valid native spelling from physical filesystem equality.
   * @evidence contracts/performance.md#efficient-algorithms Selection is linear in plugins; each capable host runs once, and merging uses indexed identity/alias membership plus canonical sorting of contributed paths.
   * @evidence contracts/performance.md#reuse-equivalent-work A single merge identity context reuses repeated path resolution across hosts; each host query remains necessary because its rules may contribute distinct effect-dependent inputs.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Query processes complete synchronously; snapshots and identity memoization are scoped to discovery and the merged result transfers to the watch/cache owner.
   */
  export function discoverNativeProjectInputs(
    options: TtscBuildOptions,
    execution: ReturnType<typeof resolveExecutionContext>,
  ): ITtscProjectInputSnapshot {
    const snapshots: ITtscProjectInputSnapshot[] = [];
    for (const plugin of execution.nativePlugins.filter(
      (candidate) =>
        candidate.stage === "check" &&
        candidate.capabilities?.projectInputs === true,
    )) {
      const res = spawnNative(
        plugin.binary,
        NativePluginArguments.createNativeProjectInputsArgs(execution, plugin),
        {
          cwd: execution.projectRoot,
          env: nativePluginEnv(options.env, execution, plugin),
          encoding: "utf8",
        },
      );
      if (res.error) {
        throw new Error(
          `ttsc.project-inputs: failed to spawn ${plugin.binary}: ${res.error.message}`,
        );
      }
      const stdout = outputText(res.stdout).trim();
      if (res.status !== 0) {
        const detail = outputText(res.stderr).trim() || stdout;
        throw new Error(
          `ttsc.project-inputs: ${plugin.name ?? plugin.binary} failed${detail ? `: ${detail}` : ""}`,
        );
      }
      const snapshot = parseProjectInputSnapshot(stdout, plugin);
      snapshots.push(snapshot);
    }
    return mergeProjectInputSnapshots(execution.projectRoot, snapshots);
  }

  /**
   * Spawn a single native plugin binary with the given args and return the
   * normalized build result. `label` is used in the thrown error message so the
   * caller's context (e.g. `"ttsc.check"` or `"ttsc.build"`) is preserved.
   *
   * Nonzero exits are results; launch failures throw. Timing records the
   * completed native invocation before launch failure is reported.
   *
   * @evidence contracts/common.md#principled-implementation The selected plugin receives the composed invocation context, and actual exit status/output become a normalized result while native launch errors remain thrown failures.
   * @evidence contracts/common.md#clear-and-simple-design One command boundary owns environment publication, timing and output normalization for native build and check phases.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Execution uses the loaded binary and supported protocol rather than patching its implementation or manufacturing success on launch failure.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes result failures, thrown launch failures and error/timing label attribution.
   * @evidence contracts/portability.md#os-neutral-implementation spawnNative receives executable and argv separately with native project cwd; platform-aware environment helpers publish compiler/context payloads without shell interpolation.
   * @evidence contracts/performance.md#efficient-algorithms One synchronous native invocation and one normalization pass are performed, with captured-output storage proportional to produced bytes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A requested effectful plugin command cannot be reused merely because argv matches; scheduling and shared-host compatibility belong to orchestration.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous child completes before return; timing/result data transfer to the build owner without retaining a process.
   */
  export function runNativePluginCommand(
    plugin: ITtscLoadedNativePlugin,
    args: readonly string[],
    options: TtscBuildOptions,
    execution: ReturnType<typeof resolveExecutionContext>,
    label: string,
    timing: BuildTiming.BuildTiming,
    timingLabel: string,
    tsgoArgs?: string,
  ): TtscBuildResult {
    const startedAt = process.hrtime.bigint();
    const res = spawnNative(plugin.binary, args, {
      cwd: execution.projectRoot,
      env: nativePluginEnv(options.env, execution, plugin, tsgoArgs),
      encoding: "utf8",
    });
    BuildTiming.recordTiming(timing, timingLabel, startedAt);
    if (res.error) {
      throw new Error(
        `${label}: failed to spawn ${plugin.binary}: ${res.error.message}`,
      );
    }
    return normalizeBuildOutput(
      {
        processCompletedNormally: res.status !== null && res.signal === null,
        status: res.status ?? 1,
        stdout: outputText(res.stdout),
        stderr: outputText(res.stderr),
      },
      execution.projectRoot,
    );
  }

  /**
   * Resolve all runtime context needed for a build: cwd, tsconfig path, project
   * root, tsgo binary location, and the loaded native plugin list. Centralised
   * here so every code path in `runBuild` shares the same resolution logic.
   *
   * A supplied resolvedProject preserves the caller's lexical project identity.
   * Plugin admission, loading and watch-input callbacks inside the guarded
   * acquisition branch become setup-failure results on error. Initial project/
   * compiler resolution and final config-anchor resolution outside it may throw.
   *
   * @evidence contracts/common.md#principled-implementation One selected project supplies root, config and compiler policy; explicit resolvedProject preserves prior selection, and the guarded plugin admission/loading/watch-input callback branch is converted to a setup failure.
   * @evidence contracts/common.md#clear-and-simple-design A single context carries compiler/project/plugin selection to all phases, with plugin acquisition isolated from project and executable resolution.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Loader failures remain explicit setup failures rather than empty successful plugin selection; preserving lexical project identity avoids mixed alias assumptions without patching filesystem APIs.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe selected context, supplied-project meaning and the exact returned-versus-thrown failure boundary.
   * @evidence contracts/portability.md#os-neutral-implementation Native path and binary resolvers select cwd/project/executables; TTSC_CACHE_DIR uses platform-aware environment lookup and already-selected project spelling is not independently canonicalized again.
   * @evidence contracts/performance.md#efficient-algorithms Initial project resolution (unless supplied) and compiler selection precede plugin admission. Admission and loading can separately resolve entries; config bytes, module/native search, environment-name/path text and delegated source builds/capability probes remain call costs. The no-entry branch avoids loading but can invoke the supplied callback.
   * @evidence contracts/performance.md#reuse-equivalent-work The supplied project reference and returned selection records serve multiple phases without a second top-level context acquisition. They are not a frozen filesystem or deep immutable snapshot; the build/session owns their continued authority, while source-artifact reuse follows loader validity.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This returns selection metadata rather than resident child handles; persistent plugin build caches are owned by the loader, while context lifetime belongs to the build/session.
   */
  export function resolveExecutionContext(
    options: TtscCommonOptions & {
      emit?: boolean;
      onWatchInputs?: (inputs: readonly string[]) => void;
      resolvedProject?: ITtscParsedProjectConfig;
      tsconfig?: string;
    },
  ) {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const project =
      options.resolvedProject ??
      readProjectConfig({
        cwd,
        projectRoot: options.projectRoot,
        tsconfig: options.tsconfig,
      });
    const tsconfig = project.path;
    const projectRoot = project.root;
    const tsgo = resolveTsgo({ ...options, cwd: projectRoot });
    let pluginSetupFailure: TtscBuildResult | undefined;
    let nativePlugins: ITtscLoadedNativePlugin[] = [];
    try {
      if (hasProjectPluginEntries(project, options.plugins)) {
        nativePlugins = loadProjectPlugins({
          binary: resolveBinary(options) ?? "",
          cacheDir:
            options.cacheDir ??
            SidecarEnvironment.read(options.env, "TTSC_CACHE_DIR"),
          cwd,
          entries: options.plugins,
          env: inheritedSidecarEnv(options.env, options.binary),
          onWatchInputs: options.onWatchInputs,
          pluginConfigDir: options.pluginConfigDir,
          projectRoot,
          tsconfig,
        }).nativePlugins;
      } else {
        options.onWatchInputs?.([]);
      }
    } catch (error) {
      pluginSetupFailure = {
        diagnostics: [],
        status: 2,
        stdout: "",
        stderr: `${error instanceof Error ? error.message : String(error)}\n`,
      };
    }
    return {
      cwd,
      nativePlugins,
      pluginConfigDir: resolvePluginConfigDir({
        cwd,
        pluginConfigDir: options.pluginConfigDir,
      }),
      pluginSetupFailure,
      project,
      projectNoEmit: project.compilerOptions.noEmit === true,
      projectRoot,
      rewriteRelativeImportExtensionsForEmit:
        options.emit === true &&
        project.compilerOptions.allowImportingTsExtensions === true,
      tsgo,
      tsconfig,
    };
  }

  /**
   * Extract `TSFILE: <path>` lines from tsgo stdout and return the absolute
   * paths. tsgo emits these when `--listEmittedFiles` is passed.
   */
  function parseEmittedFiles(stdout: string): string[] {
    const out: string[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      const match = line.match(/^TSFILE:\s*(.+)$/);
      if (match?.[1]) {
        out.push(path.resolve(match[1].trim()));
      }
    }
    return out;
  }

  /**
   * Remove `TSFILE:` lines from tsgo stdout so they do not appear in the
   * user-facing output after they have been parsed into `emittedFiles`.
   */
  function stripEmittedFileLines(stdout: string): string {
    return stdout
      .split(/\r?\n/)
      .filter((line) => !/^TSFILE:\s*/.test(line))
      .join("\n")
      .replace(/\n+$/, "");
  }
}
