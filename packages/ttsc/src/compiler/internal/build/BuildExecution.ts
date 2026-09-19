import path from "node:path";

import { resolveFlagSpec } from "../../../flags/resolveFlagSpec";
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
import { resolveBinary } from "../resolveBinary";
import { resolveTsgo } from "../resolveTsgo";
import { ROOT_FILES_ENV } from "../sharedHost/ROOT_FILES_ENV";
import { TSGO_ARGS_ENV } from "../sharedHost/TSGO_ARGS_ENV";
import { assertSharedHostCompatibility } from "../sharedHost/assertSharedHostCompatibility";
import { clearInheritedRootFiles } from "../sharedHost/clearInheritedRootFiles";
import { clearInheritedSemanticConfigPath } from "../sharedHost/clearInheritedSemanticConfigPath";
import { clearInheritedTsgoArgs } from "../sharedHost/clearInheritedTsgoArgs";
import { inheritedSidecarEnv } from "../sharedHost/inheritedSidecarEnv";
import { linkedTransformPlugins } from "../sharedHost/linkedTransformPlugins";
import { resolvePluginConfigDir } from "../sharedHost/resolvePluginConfigDir";
import { selectSharedHostPlugin } from "../sharedHost/selectSharedHostPlugin";
import { spawnNative } from "../spawnNative";
import { BuildTiming } from "./BuildTiming";
import { CompilerDiagnostics } from "./CompilerDiagnostics";
import { NativePluginArguments } from "./NativePluginArguments";
import { PassthroughFlags } from "./PassthroughFlags";
import type { RunBuildOptions } from "./RunBuildOptions";
import { TsgoArguments } from "./TsgoArguments";
import { appendBuildOutput } from "./appendBuildOutput";
import { createProcessDiagnostic } from "./createProcessDiagnostic";
import { mergeProjectInputSnapshots } from "./mergeProjectInputSnapshots";
import { normalizeBuildOutput } from "./normalizeBuildOutput";
import { parseProjectInputSnapshot } from "./parseProjectInputSnapshot";

/**
 * The engine behind every ttsc build: resolve the project and its plugins, then
 * run TypeScript-Go directly or through native plugin hosts.
 *
 * {@link runBuild} runs it once per command; {@link ResidentCheckWatchSession}
 * runs the same phases per watch cycle while keeping a check host resident. The
 * phases are shared rather than duplicated so a watch cycle and a one-shot
 * build cannot disagree about which plugin runs, which flags reach the
 * compiler, or how a plugin failure falls back to a plain type-check.
 */
export namespace BuildExecution {
  /**
   * Merge extra environment variables over `process.env`, always injecting
   * `TTSC_NODE_BINARY` so child processes can re-invoke the same Node.js binary
   * without searching `PATH`. Root files an ancestor ttsc process published are
   * dropped: a build that replaces its roots publishes its own.
   */
  function mergeEnv(
    extra?: NodeJS.ProcessEnv,
    cwd: string = process.cwd(),
  ): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...extra,
    };
    clearInheritedRootFiles(env, extra);
    const node = resolveNodeBinary(env, cwd);
    if (node === undefined) delete env.TTSC_NODE_BINARY;
    else env.TTSC_NODE_BINARY = node;
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
        TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? execution.tsgo.binary,
        TTSC_TTSX_BINARY:
          process.env.TTSC_TTSX_BINARY ??
          path.join(__dirname, "..", "..", "..", "launcher", "ttsx.js"),
        ...extra,
      },
      execution.projectRoot,
    );
    // Forwarded tsgo argv is per-invocation state this host owns, exactly like
    // the config anchor below: publish this run's payload, or drop whatever an
    // ancestor ttsc process left behind when this lane forwards nothing.
    if (tsgoArgs !== undefined) {
      env[TSGO_ARGS_ENV] = tsgoArgs;
    } else {
      clearInheritedTsgoArgs(env, extra);
    }
    clearInheritedSemanticConfigPath(env, extra);
    // A build whose roots replace the project's file list hands the list to
    // every host, which builds its Program through `driver.LoadProgram`.
    if (execution.rootFiles !== undefined) {
      env[ROOT_FILES_ENV] = JSON.stringify(execution.rootFiles);
    }
    // The anchor is per-invocation state owned by this host: when this run
    // declared none (and the caller's env does not name one), drop any value
    // inherited from an ancestor ttsc process so a nested build never
    // mis-anchors its plugins at the outer project.
    if (
      execution.pluginConfigDir === undefined &&
      extra?.TTSC_PLUGIN_CONFIG_DIR === undefined
    ) {
      delete env.TTSC_PLUGIN_CONFIG_DIR;
    }
    if (plugin?.stage === "transform") {
      const linked = linkedTransformPlugins(execution.nativePlugins);
      if (linked.length !== 0) {
        env.TTSC_LINKED_PLUGINS_JSON =
          NativePluginArguments.serializeNativePlugins(linked);
      }
    }
    return env;
  }

  /**
   * Finish the setup phase of one build: record its timing, apply the project's
   * own `noEmit`, and report the project's non-TypeScript inputs to a watching
   * caller.
   *
   * Returns a finished `result` instead of options when plugin setup already
   * failed, so the caller reports that failure without running any compiler.
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
   * / `ttsc -?` only print tsgo's help — none of them needs a project, yet all
   * three died in project resolution because that layer ran first and
   * unconditionally. The classification is `FLAG_SCHEMA`'s (`terminal` +
   * `projectFree`), so marking a further flag project-free needs no edit here.
   *
   * A resolvable project keeps the established lane untouched: the build path
   * still forwards the flag with `-p <tsconfig>` from the project root, so
   * `ttsc --init` inside an existing project still reports tsgo's TS5054
   * instead of writing a second config into the current directory. Returns
   * `null` when this lane does not apply.
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
   * Whether a check-stage host already reports TypeScript's own diagnostics, in
   * which case a separate type-check pass would print each error twice.
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
   * a batch the plugin already reported itself.
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
    const passthrough: string[] = [];
    for (let i = 0; i < (options.passthrough?.length ?? 0); i++) {
      const token = options.passthrough![i]!;
      if (resolveFlagSpec(token)?.name === "--pretty") {
        // `--pretty` is boolean: it owns a following token only when that token
        // is the literal `true`/`false`, and the inline form carries its own.
        if (
          !token.includes("=") &&
          PassthroughFlags.isBooleanLiteral(options.passthrough![i + 1] ?? "")
        ) {
          i++;
        }
        continue;
      }
      passthrough.push(token);
    }
    return {
      ...options,
      passthrough,
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
    return runNativePluginCommand(
      host,
      NativePluginArguments.createNativeBuildArgs(execution, options, plugins),
      options,
      execution,
      "ttsc.build",
      timing,
      NativePluginArguments.transformHostTimingLabel(plugins),
      TsgoArguments.createNativeBuildTsgoArgs(execution, options),
    );
  }

  /**
   * Run `tsgo -p <tsconfig> [extraArgs]` and return the normalized result. Used
   * for the no-emit type-check pass that precedes file emission.
   *
   * `extraArgs` follow the forwarded flags: they are this pass's own contract
   * (`--noEmit`), and a runtime build that re-enables emit after the user's
   * flags must not turn its check pass into a second emit.
   */
  export function runTsgo(
    execution: ReturnType<typeof resolveExecutionContext>,
    extraArgs: readonly string[],
    options: RunBuildOptions,
  ): TtscBuildResult {
    const { binary, res } = spawnCompiler(execution, options, [
      "-p",
      execution.tsconfig,
      ...TsgoArguments.createTsgoDiagnosticArgs(options),
      ...TsgoArguments.createTsgoThreadingArgs(options),
      ...(options.passthrough ?? []),
      ...extraArgs,
      ...TsgoArguments.isolatedTsgoOutputArgs(options),
    ]);
    if (res.error) {
      throw new Error(
        "ttsc: failed to spawn " + binary + ": " + res.error.message,
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
   * Run the compiler with a TypeScript-Go argument list that starts with `-p
   * <tsconfig>`.
   *
   * That is the consuming project's `tsgo`, except for a build whose root files
   * replace the project's own list. TypeScript-Go's command line cannot combine
   * a project with a file list, so such a build runs the platform binary's
   * `compile-roots`, which takes the same arguments, parses the config where it
   * lives, and reports, lists emitted files, and exits the way the compiler
   * does. The roots travel in `TTSC_ROOT_FILES`, as they do to a plugin host.
   */
  function spawnCompiler(
    execution: ReturnType<typeof resolveExecutionContext>,
    options: RunBuildOptions,
    args: readonly string[],
  ): { binary: string; res: ReturnType<typeof spawnNative> } {
    const env = mergeEnv(options.env, execution.projectRoot);
    if (execution.rootFiles === undefined) {
      return {
        binary: execution.tsgo.binary,
        res: spawnNative(execution.tsgo.binary, args, {
          cwd: execution.projectRoot,
          env,
          encoding: "utf8",
        }),
      };
    }
    const binary = resolveBinary(options);
    if (binary === null) {
      throw new Error(
        [
          `ttsc: cannot compile ${execution.rootFiles.join(", ")} with the options of ${execution.tsconfig}: the @ttsc/${process.platform}-${process.arch} package is not installed.`,
          "The file is outside that project's file set, and the platform package's ttsc binary compiles it through the project's own config.",
          "Reinstall ttsc with optional dependencies enabled.",
        ].join("\n"),
      );
    }
    env[ROOT_FILES_ENV] = JSON.stringify(execution.rootFiles);
    // The platform binary links no plugin, so a linked-plugin manifest an
    // ancestor sidecar left behind names plugins it could never run.
    delete env.TTSC_LINKED_PLUGINS_JSON;
    return {
      binary,
      res: spawnNative(binary, ["compile-roots", ...args], {
        cwd: execution.projectRoot,
        env,
        encoding: "utf8",
      }),
    };
  }

  /**
   * Run `tsgo` with the full emit arguments and parse `TSFILE:` lines from
   * stdout into `emittedFiles`. The TSFILE lines are stripped before the result
   * is returned so they do not appear in the user-facing output.
   */
  function runTsgoBuild(
    execution: ReturnType<typeof resolveExecutionContext>,
    options: RunBuildOptions,
    args: readonly string[],
  ): TtscBuildResult {
    const { binary, res } = spawnCompiler(execution, options, args);
    if (res.error) {
      throw new Error(
        "ttsc.build: failed to spawn " + binary + ": " + res.error.message,
      );
    }
    const result = {
      status: res.status ?? 1,
      stdout: outputText(res.stdout),
      stderr: outputText(res.stderr),
    };
    const emittedFiles = parseEmittedFiles(result.stdout);
    // The `TSFILE:` lines are tsgo's `--listEmittedFiles` output. ttsc adds that
    // flag internally to learn the emitted paths and strips the lines back out
    // as noise — but when the user themselves forwarded `--listEmittedFiles`,
    // the listing is what they asked for, so it must survive to stdout.
    // The lookup is schema-driven (FLAG_SCHEMA marks `--listEmittedFiles` with
    // `internalShadow: true`); see `forwardsInternalShadowFlag` for the RC-2
    // background.
    const userListedEmitted = PassthroughFlags.forwardsInternalShadowFlag(
      options,
      "--listEmittedFiles",
    );
    if (emittedFiles.length !== 0 && !userListedEmitted) {
      result.stdout = stripEmittedFileLines(result.stdout);
    }
    if (options.quiet === false) {
      result.stdout += verboseBuildSummary(execution, options, emittedFiles);
    }
    return normalizeBuildOutput(
      { ...result, emittedFiles },
      execution.projectRoot,
    );
  }

  /**
   * The `--verbose` summary for the direct-tsgo lane, in the shape
   * `cmd/ttsc/build.go` already prints on the native-host lane.
   *
   * Verbosity is a launcher-owned presentation concern: which lane `runBuild`
   * selects is an implementation detail the user cannot see, so a documented
   * flag must not change meaning with it. This lane never consumed `quiet` at
   * all, which is why the flag was silent on every project without a ttsc
   * plugin.
   *
   * `sites=0` is a fact about this lane rather than a placeholder: it runs
   * precisely when the project declares no native plugin. A build that emitted
   * nothing prints the header and `emitted=0 files`, so the summary never
   * claims files that were not written.
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
      const result = runNativePluginCommand(
        plugin,
        NativePluginArguments.createNativeCheckArgs(execution, options, plugin),
        options,
        execution,
        "ttsc.check",
        timing,
        `ttsc check plugin ${plugin.name} time`,
        TsgoArguments.createNativeTsgoArgs(options),
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
   */
  export function resolveExecutionContext(
    options: TtscCommonOptions & {
      emit?: boolean;
      onWatchInputs?: (inputs: readonly string[]) => void;
      resolvedProject?: ITtscParsedProjectConfig;
      rootFiles?: readonly string[];
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
          cacheDir: options.cacheDir ?? options.env?.TTSC_CACHE_DIR,
          cwd,
          entries: options.plugins,
          env: inheritedSidecarEnv(options.env),
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
      rootFiles: options.rootFiles,
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
