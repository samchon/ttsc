import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { touchPluginCacheEntryInUse } from "../../../plugin/internal/source/touchPluginCacheEntryInUse";
import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { ResidentCheckProcess } from "../ResidentCheckProcess";
import { type ResidentCheckRequest } from "../ResidentCheckRequest";
import { assertSharedHostCompatibility } from "../sharedHost/assertSharedHostCompatibility";
import { selectSharedHostPlugin } from "../sharedHost/selectSharedHostPlugin";
import { BuildExecution } from "./BuildExecution";
import { BuildTiming } from "./BuildTiming";
import { NativePluginArguments } from "./NativePluginArguments";
import { PassthroughFlags } from "./PassthroughFlags";
import type { ResidentCheckWatchChange } from "./ResidentCheckWatchChange";
import type { RunBuildOptions } from "./RunBuildOptions";
import { TsgoArguments } from "./TsgoArguments";
import { appendBuildOutput } from "./appendBuildOutput";
import { bufferResidentCheckEntryRequests } from "./bufferResidentCheckEntryRequests";
import { normalizeBuildOutput } from "./normalizeBuildOutput";
import { planResidentCheckEntries } from "./planResidentCheckEntries";
import { residentCheckRequest } from "./residentCheckRequest";
import { takeResidentCheckEntryRequest } from "./takeResidentCheckEntryRequest";

/**
 * Watch coordinator for retained project selection and analysis-only Programs.
 *
 * The selected project and compatible check-stage processes stay resident
 * across ordinary source/data edits. A config, root-set, contributor, or plugin
 * topology transition calls for a full reset before the next cycle. In an
 * analysis cycle, transform hosts keep no Program: each runs its `check` verb
 * once per cycle after the resident check hosts. Emitting lanes retain only
 * project and plugin selection; each cycle runs a fresh one-shot build without
 * starting resident check sidecars.
 *
 * The watch launcher must serialize cycles and use reload when invocation
 * selection or startup environment changes. A session does not independently
 * compare every option/environment field before reusing its cached context.
 * `TTSC_WATCH_DEBUG_INPUTS` reports why selection is reset and the active
 * sidecar count being retired, distinguishes a failed resident transport, and
 * names each resident reply's telemetry, each recovery check and the private
 * incremental-state directory.
 *
 * @evidence contracts/common.md#principled-implementation Stable invocation selection and serialized cycles let compatible analysis-only checks retain their Program and emitting lanes retain only selection; explicit reload and observed input-topology changes reset selection before another cycle. Initial capture and warm refresh await the watch owner's publication before retaining topology; warm refresh compares physical dependency identity while publishing every declared-alias update.
 * @evidence contracts/common.md#clear-and-simple-design The session owns selected execution, dependency snapshot, process identities and per-entry delivery buffers while shared BuildExecution owns one-shot phase and failure policy. Initial capture wraps the existing discovery callback, and warm refresh joins discovery, comparison and watch registration without another topology owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Capability-aware residency retains the actual transport-failure one-shot path and distinct configured check positions. Pending or rejected registration cannot restamp topology, and unchanged physical dependencies cannot bypass declared-alias publication.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state supported lanes, reset causes and the caller's serialization/stable-invocation premise; private capture and refresh prose distinguish committed topology, physical comparison and declared-alias publication, while run and dispose document lifecycle effects.
 * @evidence contracts/portability.md#os-neutral-implementation Native filesystem checks, cache touch helpers and child creation retain selected binary paths and delegated executable/argv/environment handling. BuildExecution owns native discovery and path normalization; initial capture forwards its snapshot without native operations and warm comparison preserves physical and declared representations.
 * @evidence contracts/performance.md#efficient-algorithms Per-cycle command planning, key serialization and buffer unions process configured checks and pending path text; sorting/comparison bytes, native cache observations, subscribed input discovery and delegated checks add work. Initial capture adds one shallow options copy and one awaited callback; warm refresh adds one native discovery, linear normalized comparison and callback, avoiding reset when topology is unchanged. Accumulated output can repeatedly copy earlier phase text.
 * @evidence contracts/performance.md#reuse-equivalent-work Process keys include binary/name/argv/compiler payload, while stable invocation context and reload guard the remaining startup inputs. The upstream compiler's incremental state carries a plugin-free check across cycles; the compiler itself decides what is affected. Accepted snapshots serve warm topology comparison only after watch registration completes; execution reuse also requires equal physical dependency topology. Emitting cycles reuse descriptor and plugin selection, then load a fresh native Program.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A plugin-free analysis cycle's upstream build info lives in one session-allocated directory under the OS temporary root, removed by dispose and close only while its captured identity still holds; a killed process leaves it to the OS temporary root. Initial capture closes over the session and caller for its build; warm handoff retains the previous and next snapshots until successful registration replaces the accepted population, while rejection preserves it. Reset clears active maps, execution and snapshots while retiring children and join promises remain separately retained. Unknown joins retain rejection and prevent replacement; delegated termination is not descendant settlement. Stable options bound active process keys by configured checks, but pending unique paths and repeated disposal chains have no independent historical ceiling.
 */
export class ResidentCheckWatchSession {
  private execution:
    | ReturnType<typeof BuildExecution.resolveExecutionContext>
    | undefined;

  /** Undelivered changes keyed by configured check position, not process key. */
  private readonly pendingChanges = new Map<number, ResidentCheckRequest>();

  /** Latest normalized dependency population, plus declared watch aliases. */
  private projectInputs: ITtscProjectInputSnapshot | undefined;

  /** Sidecars acquired for the stable invocation; reset releases every key. */
  private readonly processes = new Map<string, ResidentCheckProcess>();
  private readonly retiringProcesses = new Set<ResidentCheckProcess>();
  private retirement: Promise<void> = Promise.resolve();
  private closed = false;
  private generation = 0;

  /** Private directory of the upstream incremental check state, once made. */
  private buildInfo: { directory: string; ownership: fs.Stats } | undefined;

  /**
   * Run one serialized watch cycle through the shared build/check policies.
   * Options identifying the invocation and startup environment must remain
   * stable until reload; callers must not run overlapping cycles.
   *
   * The first cycle, and any cycle after `change.reload`, resolves the project
   * and plugins. Compatible check entries may then start resident processes,
   * and transform hosts of an analysis cycle run their one-shot `check` after
   * them; emitting entries reuse selection but rebuild their Program each
   * cycle. A
   * resident process that fails is retired and its entry falls back to the
   * one-shot check for that cycle. Plugin and project watch handoffs complete
   * before checks begin; reused topology is republished through the same
   * completion boundary.
   *
   * @evidence contracts/common.md#principled-implementation Compatible no-emit selection uses the same diagnostic/failure policy as one-shot execution, including the shared analysis transform phase after resident checks; emitting selection retains its plugins but runs a fresh build, and reload, missing binaries and changed normalized dependency topology cold-resolve the next execution.
   * @evidence contracts/common.md#clear-and-simple-design The cycle separates setup/reuse, topology refresh, ordered checks and final diagnostics/timing, delegating each phase to its owning shared operation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed resident transport retires that process and uses the established real check command; the fallback neither drops forwarded compiler options nor converts a nonzero check into success.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs document serialization, stable startup inputs, reload and failed-sidecar behavior instead of claiming arbitrary option changes are handled automatically.
   * @evidence contracts/portability.md#os-neutral-implementation Native binary existence and cache freshness use filesystem helpers; all commands preserve selected cwd and use native process/environment abstractions without shell interpolation.
   * @evidence contracts/performance.md#efficient-algorithms Warm cycles avoid project/plugin re-resolution until a missing binary or changed subscribed topology resets selection. Emitting cycles still run whole-program native work; existence/cache touches, optional onProjectInputs discovery, command/key construction, per-entry unions/sorts, delegated host work and output normalization/merging retain their actual entry/text/byte costs.
   * @evidence contracts/performance.md#reuse-equivalent-work Selected context and capability-supported check sidecars survive only stable invocation cycles; change requests update resident check Programs, while emitting cycles reuse selection and reload a fresh native Program. Reload/topology transitions reset selection, and effectful configured entries remain separately scheduled.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The session retains active sidecars and per-entry pending changes; transport failure retires its process and awaits actual close before fallback. Reset clears active state but not unknown retiring ownership or its rejection. Unconsumed path sets have no finite bound while an earlier entry repeatedly fails; child close does not certify descendants.
   */
  public async run(
    options: RunBuildOptions,
    change: ResidentCheckWatchChange = {},
  ): Promise<TtscBuildResult> {
    let generation = this.generation;
    await this.retirement;
    this.assertOpen(generation);
    if (change.reload === true)
      generation = await this.resetForRun("watch-reload");

    const timing = BuildTiming.createBuildTiming(options);
    const projectFree = BuildExecution.runProjectFreeTerminalFlag(options);
    if (projectFree !== null) {
      await this.resetForRun("terminal-flag");
      return BuildTiming.appendTimingOutput(projectFree, timing);
    }

    let execution = this.execution;
    const reusedExecution = execution !== undefined;
    let buildOptions: RunBuildOptions;
    if (execution === undefined) {
      const setupStartedAt = process.hrtime.bigint();
      execution = await BuildExecution.resolveExecutionContextAsync(options);
      this.assertOpen(generation);
      const discoveryOptions = this.captureProjectInputs(options);
      const prepared = await BuildExecution.prepareBuildExecutionAsync(
        discoveryOptions,
        timing,
        execution,
        setupStartedAt,
      );
      this.assertOpen(generation);
      buildOptions = prepared.buildOptions;
      if (prepared.result !== undefined) {
        await this.resetForRun("preparation-result");
        return BuildTiming.appendTimingOutput(prepared.result, timing);
      }
      this.execution = execution;
    } else {
      // The session keeps running the plugin binaries it resolved without
      // resolving them again, so it records each cycle's use in their cache
      // entries, and a binary the cache removed anyway sends the session back
      // through resolution, which builds it again, rather than failing a
      // sidecar respawn.
      if (
        execution.nativePlugins.some((plugin) => !fs.existsSync(plugin.binary))
      ) {
        await this.resetForRun("missing-plugin-binary");
        return this.run(options);
      }
      for (const plugin of execution.nativePlugins)
        touchPluginCacheEntryInUse(plugin.binary);
      buildOptions = BuildExecution.applyProjectNoEmit(options, execution);
    }
    if (reusedExecution) {
      const topologyChanged = await this.refreshProjectInputTopology(
        options,
        execution,
      );
      this.assertOpen(generation);
      if (topologyChanged) {
        await this.resetForRun("project-input-topology");
        return this.run(options);
      }
    }

    // An emitting cycle still loads a fresh native Program. Only its stable
    // project/plugin selection survives, so a source edit does not reevaluate
    // descriptors while config, plugin, and input-topology changes reset it.
    if (!residentCheckExecutionIsCompatible(buildOptions)) {
      return BuildTiming.appendTimingOutput(
        BuildExecution.runPreparedBuild(options, timing, execution, {
          ...buildOptions,
          watchWriteIfChanged: true,
        }),
        timing,
      );
    }

    const transformHost = planTransformHost(buildOptions, execution);
    const checked = await this.runCheckPlugins(
      buildOptions,
      execution,
      timing,
      change,
      generation,
      transformHost,
    );
    this.assertOpen(generation);
    let result: TtscBuildResult;
    const transformed =
      checked.status === 0
        ? await this.runTransformHosts(
            buildOptions,
            execution,
            checked,
            timing,
            transformHost,
            generation,
          )
        : undefined;
    this.assertOpen(generation);
    if (checked.status !== 0 && checked.typeScriptDiagnosticsReported === true) {
      // The failing resident host acknowledged its loaded Program's complete
      // report, so a recovery check would only re-derive it (#1869).
      result = checked;
    } else if (checked.status !== 0) {
      if (process.env.TTSC_WATCH_DEBUG_INPUTS)
        process.stdout.write(`[ttsc:debug] recovery check\n`);
      result = BuildExecution.appendTypeScriptDiagnosticsAfterPluginFailure(
        checked,
        buildOptions,
        execution,
      );
    } else if (transformed !== undefined) {
      // The transform host's `check` follows the check hosts, as in a one-shot
      // build; only a resident-capable host keeps its Program.
      result = transformed;
    } else if (
      BuildExecution.checkPluginsReportTypeScriptDiagnostics(
        execution.nativePlugins,
      )
    ) {
      result = checked;
    } else {
      result = appendBuildOutput(
        checked,
        BuildExecution.runWatchTypeCheck(
          execution,
          buildOptions,
          this.buildInfoFile(),
        ),
      );
    }
    return BuildTiming.appendTimingOutput(result, timing);
  }

  /**
   * The session's private upstream build-info file, in a directory this
   * session allocated under the OS temporary root on first use. Every watch
   * process owns its own, so several watches over the same sources never share
   * compiler state, and the project and its cache stay untouched (#1866).
   * Allocation failure leaves the check non-incremental.
   */
  private buildInfoFile(): string | undefined {
    if (this.buildInfo === undefined) {
      try {
        const directory = createCanonicalTempDirectory("ttsc-watch-check-");
        this.buildInfo = { directory, ownership: fs.lstatSync(directory) };
        if (process.env.TTSC_WATCH_DEBUG_INPUTS)
          process.stdout.write(
            `[ttsc:debug] incremental check state ${JSON.stringify(directory)}\n`,
          );
      } catch {
        return undefined;
      }
    }
    return path.join(this.buildInfo.directory, "check.tsbuildinfo");
  }

  /** Remove the build-info directory if it is still the one this session made. */
  private releaseBuildInfo(): void {
    const owned = this.buildInfo;
    this.buildInfo = undefined;
    if (owned === undefined) return;
    try {
      const current = fs.lstatSync(owned.directory);
      if (
        current.isDirectory() &&
        !current.isSymbolicLink() &&
        current.dev === owned.ownership.dev &&
        current.ino === owned.ownership.ino
      )
        fs.rmSync(owned.directory, { recursive: true, force: true });
    } catch {
      // Already gone, or replaced by something this session does not own.
    }
  }

  /**
   * Request termination of every retained sidecar and discard session state.
   * This initiates retirement synchronously; a later run awaits actual child
   * close before selecting a fresh session. Use close for terminal, awaitable
   * release. Child termination and queued-request rejection belong to the
   * process owner.
   *
   * @evidence contracts/common.md#principled-implementation Reset visits each owned process before clearing its map and discards pending changes, dependency snapshot and selected execution together.
   * @evidence contracts/common.md#clear-and-simple-design Disposal uses the same reset boundary as topology transitions, keeping resource and cached-selection release in one place.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Release calls the supported child disposal API rather than replacing process methods or marking still-owned resources as successful check results.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes synchronous initiation, joined reuse and terminal close.
   * @evidence contracts/portability.md#os-neutral-implementation Platform-specific child termination is delegated to ResidentCheckProcess; this coordinator does not assume a POSIX signal guarantees process-tree exit on every OS.
   * @evidence contracts/performance.md#efficient-algorithms Reset deduplicates active and retiring children, traverses that population and collects previous/current promise outcomes; delegated disposal can reject queued child requests. Maps clear without a separate path-by-path pending-request scan, while debug serialization and callbacks add their own costs.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Disposal invalidates shared execution ownership rather than establishing reusable computation.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Every retained process receives retirement before map ownership is cleared; known failed exits can be replaced only after actual close, while unknown joins reject. Buffers and selected state release immediately and the generation rejects late work.
   */
  public dispose(): void {
    if (this.closed) return;
    void this.reset("dispose");
    this.releaseBuildInfo();
  }

  /**
   * Terminally close this session and await every retained or retiring child.
   * Unlike dispose, later runs are rejected and cannot start a fallback.
   *
   * @evidence contracts/common.md#principled-implementation Terminal admission closes before owned processes are retired, and completion awaits their actual child-close outcomes.
   * @evidence contracts/common.md#clear-and-simple-design The same reset boundary owns reusable disposal and terminal closure, with a separate admission flag for their different public contracts.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Closing forbids subsequent process acquisition or fallback and retains failed or unknown retirement as rejection.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes terminal closure from the compatible reusable dispose operation.
   * @evidence contracts/portability.md#os-neutral-implementation Native EOF and close validation belong to each process owner; the session joins outcomes without assuming POSIX signal behavior on Windows.
   * @evidence contracts/performance.md#efficient-algorithms Terminal reset deduplicates active and retiring children and observes their joins alongside the previous retirement promise. Outcome/failure collection and delegated queued-request disposal contribute work; unknown joins can reject at the child owner's event-loop deadline rather than becoming successful closes.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated terminal closes share the retirement promise, while subsequent computation is forbidden by terminal admission.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Closing releases maps and selected state immediately but retains join promises until every actual child outcome settles; failed or unknown ownership remains rejection.
   */
  public close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      void this.reset("close");
      this.releaseBuildInfo();
    }
    return this.retirement;
  }

  private assertOpen(generation = this.generation): void {
    if (this.closed)
      throw new Error("ttsc: resident check watch session closed");
    if (generation !== this.generation)
      throw new Error("ttsc: resident check watch cycle retired");
  }

  private async resetForRun(reason: string): Promise<number> {
    const retirement = this.reset(reason);
    const generation = this.generation;
    await retirement;
    this.assertOpen(generation);
    return generation;
  }

  /** Release selection immediately and join its children before replacement. */
  private reset(reason: string): Promise<void> {
    ++this.generation;
    if (process.env.TTSC_WATCH_DEBUG_INPUTS) {
      process.stdout.write(
        `[ttsc:debug] resident reset ${JSON.stringify({
          reason,
          selectedExecution: this.execution !== undefined,
          processes: this.processes.size,
        })}\n`,
      );
    }
    const previous = this.retirement;
    const children = new Set([
      ...this.processes.values(),
      ...this.retiringProcesses,
    ]);
    const retiring = [...children].map((child) => {
      const joined = this.trackRetirement(child);
      return this.closed ? child.close() : joined;
    });
    this.retirement = Promise.allSettled([previous, ...retiring]).then(
      (results) => {
        const errors = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (errors.length !== 0)
          throw new AggregateError(
            errors,
            "ttsc: resident check retirement failed",
          );
      },
    );
    void this.retirement.catch(() => {});
    this.processes.clear();
    this.pendingChanges.clear();
    this.execution = undefined;
    this.projectInputs = undefined;
    return this.retirement;
  }

  private trackRetirement(child: ResidentCheckProcess): Promise<void> {
    this.retiringProcesses.add(child);
    child.dispose();
    const joined = child.waitForExit();
    void joined.then(
      () => this.retiringProcesses.delete(child),
      () => {}, // Unknown ownership stays retained and prevents replacement.
    );
    return joined;
  }

  /**
   * Retain discovered project topology after its watch owner confirms the
   * publication; rejected registration leaves the previous snapshot intact.
   */
  private captureProjectInputs(options: RunBuildOptions): RunBuildOptions {
    const onProjectInputs = options.onProjectInputs;
    if (onProjectInputs === undefined) return options;
    const generation = this.generation;
    return {
      ...options,
      onProjectInputs: async (snapshot) => {
        await onProjectInputs(snapshot);
        this.assertOpen(generation);
        this.projectInputs = snapshot;
      },
    };
  }

  /**
   * Refresh normalized Program topology while always publishing declared alias
   * updates to the watcher, even when physical dependency identity is
   * unchanged. Await registration before checks reuse the selected execution.
   */
  private async refreshProjectInputTopology(
    options: RunBuildOptions,
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
  ): Promise<boolean> {
    if (options.onProjectInputs === undefined) return false;
    const generation = this.generation;
    const next = BuildExecution.discoverNativeProjectInputs(options, execution);
    const changed =
      this.projectInputs !== undefined &&
      !projectInputSnapshotsEqual(this.projectInputs, next);
    // Replaying an unchanged population still crosses the worker's publication
    // barrier. Starting checks first would accept edits before registration.
    await options.onProjectInputs(next);
    this.assertOpen(generation);
    this.projectInputs = next;
    return changed;
  }

  /**
   * Deliver changes in configured order, retaining later entries' undelivered
   * requests after an earlier failure. Process sharing never shares away a
   * configured check invocation.
   */
  private async runCheckPlugins(
    options: RunBuildOptions,
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    timing: BuildTiming.BuildTiming,
    change: ResidentCheckWatchChange,
    generation: number,
    transformHost: TransformHostPlan | undefined,
  ): Promise<TtscBuildResult> {
    let out: TtscBuildResult = {
      diagnostics: [],
      status: 0,
      stderr: "",
      stdout: "",
    };
    const tsgoArgs = TsgoArguments.createNativeTsgoArgs(options);
    const checks = planResidentCheckEntries(
      execution.nativePlugins,
      (plugin) =>
        NativePluginArguments.createNativeCheckArgs(execution, options, plugin),
      tsgoArgs,
      execution.compilerSelection.compilerArgsCwd,
    );
    const request = residentCheckRequest(change, execution.projectRoot);
    // Buffer the cycle for every resident plugin before running any of them.
    // An earlier plugin may fail and short-circuit diagnostics, but a later
    // sidecar must still receive every filesystem transition when it resumes.
    bufferResidentCheckEntryRequests(this.pendingChanges, checks, request);
    if (transformHost !== undefined)
      bufferResidentCheckEntryRequests(
        this.pendingChanges,
        [
          {
            args: transformHost.args,
            entryIndex: TRANSFORM_HOST_ENTRY,
            key: transformHost.key,
            plugin: transformHost.host,
          },
        ],
        request,
      );

    for (const { args, entryIndex, key, plugin } of checks) {
      this.assertOpen(generation);
      let result: TtscBuildResult;
      if (key === undefined) {
        result = BuildExecution.runNativePluginCommand(
          plugin,
          args,
          options,
          execution,
          "ttsc.check",
          timing,
          `ttsc check plugin ${plugin.name} time`,
          tsgoArgs,
        );
      } else {
        result = await this.requestResident({
          args,
          entryIndex,
          env: BuildExecution.nativePluginEnv(
            options.env,
            execution,
            plugin,
            tsgoArgs,
          ),
          execution,
          generation,
          key,
          plugin,
          timing,
          timingLabel: `ttsc check plugin ${plugin.name} time`,
          // A failed transport is not a request to drop the forwarded
          // compiler flags the resident host was started with.
          fallback: () =>
            BuildExecution.runNativePluginCommand(
              plugin,
              args,
              options,
              execution,
              "ttsc.check",
              { ...timing, enabled: false },
              "",
              tsgoArgs,
            ),
        });
      }
      out = appendBuildOutput(out, result);
      if (result.status !== 0) return out;
    }
    return out;
  }

  /**
   * Run the analysis cycle's transform hosts after successful check hosts, as
   * BuildExecution.runAnalysisTransformHosts does for a one-shot build. A
   * shared host that declares `residentCheck` answers through `check-serve`
   * and keeps its Program between cycles; any other host runs its one-shot
   * `check`. Returns undefined when the selection has no transform plugin.
   */
  private async runTransformHosts(
    options: RunBuildOptions,
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    checked: TtscBuildResult,
    timing: BuildTiming.BuildTiming,
    plan: TransformHostPlan | undefined,
    generation: number,
  ): Promise<TtscBuildResult | undefined> {
    if (plan === undefined) return undefined;
    if (plan.key === undefined)
      return BuildExecution.runAnalysisTransformHosts(
        options,
        execution,
        checked,
        timing,
      );
    // A failed transport falls back to the one-shot phase, which already owns
    // its output order and recovery policy, so its result stands as is.
    let fallen: TtscBuildResult | undefined;
    const compiled = await this.requestResident({
      args: plan.args,
      entryIndex: TRANSFORM_HOST_ENTRY,
      env: BuildExecution.nativePluginEnv(
        options.env,
        execution,
        plan.host,
        plan.tsgoArgs,
      ),
      execution,
      generation,
      key: plan.key,
      plugin: plan.host,
      timing,
      timingLabel: plan.timingLabel,
      fallback: () =>
        (fallen = BuildExecution.runAnalysisTransformHosts(
          options,
          execution,
          checked,
          { ...timing, enabled: false },
        )!),
    });
    if (fallen !== undefined) return fallen;
    const result = appendBuildOutput(checked, compiled);
    return compiled.status === 0 ||
      compiled.typeScriptDiagnosticsReported === true
      ? result
      : BuildExecution.appendTypeScriptDiagnosticsAfterPluginFailure(
          result,
          options,
          execution,
        );
  }

  /**
   * Deliver one entry's buffered changes to its resident host, starting the
   * host on first use. A failed transport retires the host, waits for its
   * actual close and runs the entry's one-shot fallback for this cycle; the
   * next cycle gets one clean respawn attempt.
   */
  private async requestResident(props: {
    args: readonly string[];
    entryIndex: number;
    env: NodeJS.ProcessEnv;
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>;
    fallback: () => TtscBuildResult;
    generation: number;
    key: string;
    plugin: ITtscLoadedNativePlugin;
    timing: BuildTiming.BuildTiming;
    timingLabel: string;
  }): Promise<TtscBuildResult> {
    const { execution, key, plugin } = props;
    const startedAt = process.hrtime.bigint();
    let resident = this.processes.get(key);
    if (resident === undefined) {
      resident = new ResidentCheckProcess({
        args: ["check-serve", ...props.args.slice(1)],
        binary: plugin.binary,
        cwd: execution.projectRoot,
        env: props.env,
      });
      this.processes.set(key, resident);
    }
    let result: TtscBuildResult;
    try {
      const reply = await resident.request(
        takeResidentCheckEntryRequest(this.pendingChanges, props.entryIndex),
      );
      if (process.env.TTSC_WATCH_DEBUG_INPUTS) {
        process.stdout.write(
          `[ttsc:debug] resident reply ${JSON.stringify({
            plugin: plugin.name,
            ...reply.telemetry,
          })}\n`,
        );
      }
      result = normalizeBuildOutput(
        {
          // The resident Program is this cycle's root-project Program, so its
          // reported files answer the topology's membership.
          ...residentProgramFiles(reply.programFiles, execution),
          ...(reply.typeScriptDiagnosticsReported === true
            ? { typeScriptDiagnosticsReported: true as const }
            : {}),
          status: reply.status,
          stderr: reply.stderr,
          stdout: reply.stdout,
        },
        execution.projectRoot,
      );
    } catch {
      if (process.env.TTSC_WATCH_DEBUG_INPUTS) {
        process.stdout.write(
          `[ttsc:debug] resident transport failed ${JSON.stringify({
            entryIndex: props.entryIndex,
            plugin: plugin.name,
          })}\n`,
        );
      }
      resident.dispose();
      this.processes.delete(key);
      const previousRetirement = this.retirement;
      this.retirement = Promise.allSettled([
        previousRetirement,
        this.trackRetirement(resident),
      ]).then((results) => {
        const failed = results.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
      });
      void this.retirement.catch(() => {});
      await this.retirement;
      this.assertOpen(props.generation);
      // The one-shot fallback observes the complete current filesystem, and a
      // later sidecar starts cold, so neither needs old deltas. A
      // capability-aware host may still disappear or violate framing; the
      // established one-shot command keeps this cycle correct.
      result = props.fallback();
    }
    BuildTiming.recordTiming(props.timing, props.timingLabel, startedAt);
    return result;
  }
}

/** Pending-change slot of the shared transform host, beside check entries. */
const TRANSFORM_HOST_ENTRY = -1;

/** How an analysis cycle runs its shared transform host. */
type TransformHostPlan = {
  args: string[];
  host: ITtscLoadedNativePlugin;
  /** Resident identity, or undefined when the host is not resident-capable. */
  key: string | undefined;
  timingLabel: string;
  tsgoArgs: string | undefined;
};

/**
 * Plan the analysis cycle's shared transform host, or undefined without a
 * transform plugin. The argv is the one-shot `check` command's, and the
 * resident identity includes it with the forwarded compiler payload and its
 * argument directory, like a check entry's.
 */
function planTransformHost(
  options: RunBuildOptions,
  execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
): TransformHostPlan | undefined {
  const compilers = execution.nativePlugins.filter(
    (plugin) => plugin.stage === "transform",
  );
  if (compilers.length === 0) return undefined;
  assertSharedHostCompatibility(compilers, "emit");
  const host = selectSharedHostPlugin(compilers);
  const args = NativePluginArguments.createNativeBuildArgs(
    execution,
    options,
    compilers,
  );
  const tsgoArgs = TsgoArguments.createNativeBuildTsgoArgs(execution, options);
  return {
    args,
    host,
    key:
      host.capabilities?.residentCheck === true
        ? `transform\0${host.binary}\0${JSON.stringify(args)}\0${tsgoArgs ?? ""}\0${execution.compilerSelection.compilerArgsCwd}`
        : undefined,
    timingLabel: NativePluginArguments.transformHostTimingLabel(compilers),
    tsgoArgs,
  };
}

/**
 * Translate a resident host's Program files into the spellings the selected
 * compiler lists. A Go host reads the default libraries from its embedded
 * bundle (`bundled:///libs/<name>`), while the installed `tsc` reads and
 * lists the same files beside its executable; the topology must see one
 * membership whichever producer answered, or it would read the difference as
 * a topology change. A library that cannot be found there withdraws the whole
 * report, and the topology lists the project itself.
 */
function residentProgramFiles(
  files: readonly string[] | undefined,
  execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
): { programFiles?: readonly string[] } {
  if (files === undefined) return {};
  const libraries = path.dirname(execution.tsgo.binary);
  const resolved: string[] = [];
  for (const file of files) {
    if (!file.startsWith("bundled:///libs/")) {
      resolved.push(file);
      continue;
    }
    const library = path.join(libraries, file.slice("bundled:///libs/".length));
    if (!fs.existsSync(library)) return {};
    resolved.push(library);
  }
  return { programFiles: resolved };
}

/**
 * Compare canonical physical topology; alias watch spellings refresh
 * separately.
 */
function projectInputSnapshotsEqual(
  left: ITtscProjectInputSnapshot,
  right: ITtscProjectInputSnapshot,
): boolean {
  const leftReloadFiles = left.reloadFiles ?? [];
  const rightReloadFiles = right.reloadFiles ?? [];
  const leftReloadDirectories = left.reloadDirectories ?? [];
  const rightReloadDirectories = right.reloadDirectories ?? [];
  return (
    left.root === right.root &&
    left.files.length === right.files.length &&
    left.globs.length === right.globs.length &&
    leftReloadDirectories.length === rightReloadDirectories.length &&
    leftReloadFiles.length === rightReloadFiles.length &&
    left.files.every((value, index) => value === right.files[index]) &&
    left.globs.every((value, index) => value === right.globs[index]) &&
    leftReloadDirectories.every(
      (value, index) => value === rightReloadDirectories[index],
    ) &&
    leftReloadFiles.every((value, index) => value === rightReloadFiles[index])
  );
}

/**
 * Residency serves analysis-only cycles without fix/format/terminal effects.
 * A transform plugin does not disqualify the cycle: emit is off, so its host
 * only runs `check`, one-shot, while the check-stage hosts stay resident
 * (#1864).
 */
function residentCheckExecutionIsCompatible(options: RunBuildOptions): boolean {
  return (
    options.emit === false &&
    options.fix !== true &&
    options.format !== true &&
    PassthroughFlags.forwardsTerminalTsgoFlag(options) === false
  );
}
