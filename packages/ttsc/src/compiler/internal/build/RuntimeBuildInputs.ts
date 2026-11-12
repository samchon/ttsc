import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveNodeBinary } from "../../../internal/resolveNodeBinary";
import { runtimeExecutableIdentity } from "../../../internal/runtimeExecutableIdentity";
import { PluginContentIdentities } from "../../../plugin/internal/source/PluginContentIdentities";
import { pluginSourceStateHolds } from "../../../plugin/internal/source/pluginSourceStateHolds";
import type { ITtscCompilerTransformation } from "../../../structures/ITtscCompilerTransformation";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { CompilerArgumentsInspection } from "../CompilerArgumentsInspection";
import { readJsoncFile } from "../project/readJsoncFile";
import { resolveTsgo } from "../resolveTsgo";
import { SidecarEnvironment } from "../sharedHost/SidecarEnvironment";
import { spawnNative } from "../spawnNative";
import type { BuildExecution } from "./BuildExecution";
import { CompilerTraceObservations } from "./CompilerTraceObservations";
import { PassthroughFlags } from "./PassthroughFlags";
import type { RunBuildOptions } from "./RunBuildOptions";
import { RuntimeBuildExplanation } from "./RuntimeBuildExplanation";
import { RuntimeInputContents } from "./RuntimeInputContents";
import { RuntimeInputProof } from "./RuntimeInputProof";
import { TsgoArguments } from "./TsgoArguments";
import { runtimeBuildEnvironment } from "./runtimeBuildEnvironment";

/**
 * Prove runtime build inputs through the selected upstream compiler's read-only
 * effective configuration and source-selection commands. Repeating selection
 * discovers added roots and changed resolution candidates without guessing a
 * project boundary or treating workspace links as immutable dependencies.
 * Native plugin and descriptor observations add their independently replayed
 * input closure. Descriptor discovery can take different cold and warm paths;
 * its captured reads belong to result admission, while the resolved native
 * execution determines snapshot equivalence. Custom compiler overrides require
 * the physical identity of the installed package compiler; wrappers with
 * undisclosed external inputs stay fresh.
 *
 * @evidence contracts/common.md#principled-implementation The actual selected compiler defines effective options and source membership; content and physical identities cover that closure and package scopes, with separate native producer proof for checks.
 * @evidence contracts/common.md#clear-and-simple-design One factory supplies input capture, generation-owned descriptor proof and result admission to the runtime document store without changing normal build dispatch.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Incomplete descriptors, unsupported effectful compiler modes and unproved native producers and custom compilers without package authority use the existing fresh build rather than weakening diagnostics or substituting a compiler.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes compiler-owned membership, workspace scope and independent plugin observations.
 * @evidence contracts/portability.md#os-neutral-implementation The selected executable receives native argv and cwd; source and package scopes use native physical paths and preserve lexical spellings without OS-wide case folding.
 * @evidence contracts/performance.md#efficient-algorithms Each snapshot runs two native membership/configuration queries and observes selected source/package metadata. The content owner reuses each file's hash under its own separable unchanged witness and reads only the files that moved; executable and declared host proofs retain their independent owners, and shared ancestor sets avoid repeated package-scope walks.
 * @evidence contracts/performance.md#reuse-equivalent-work A completed emit may be reused only for equal selected input snapshots and currently valid native witnesses; unsupported proof falls back to compilation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Query buffers and path/hash records are call-local, with source/report bytes unbounded by this factory; the document store owns persistent byte limits and retention.
 */
export namespace RuntimeBuildInputs {
  /**
   * Construct the proof owners for one private runtime request.
   * Program-mutating transform hosts need their declared emit-input sidecar.
   * Check hosts need their declared observation protocol and complete
   * descriptor discovery; no-plugin builds use the actual compiler's
   * source/configuration selection directly. Custom selections are reusable
   * only when they name that same package-backed compiler.
   *
   * @evidence contracts/common.md#principled-implementation Eligibility requires a private emitting request, complete descriptor selection and supported check witnesses; captures bracket content identities and native source selection, and result admission requires complete emitted-source ownership.
   * @evidence contracts/common.md#clear-and-simple-design Capture owns current selection, record conservatively merges original descriptor observations into the fresh generation, and admission replays its complete proof. Missing or conflicting declarations stay unavailable.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native transforms without complete emit observations and arbitrary external-code or profiling modes decline reuse rather than inventing input completeness. Custom compiler overrides need matching installed package identity, including inherited dependency hints; the original build remains the fallback.
   * @evidence contracts/common.md#meaningful-documentation Native prose states current producer support and private-runtime scope, including why fresh transformation remains necessary.
   * @evidence contracts/portability.md#os-neutral-implementation Source and package observations use native paths and bracketed byte reads, and upstream probes use the original compiler working directory and argv without shell composition.
   * @evidence contracts/performance.md#efficient-algorithms Capture performs two upstream queries, executable proofs and one metadata request per selected path with one physical resolution per directory; a file whose proof moved adds its own byte hashing. Unique ancestor/path sets bound duplicate scope work, and admission replays recorded native inputs.
   * @evidence contracts/performance.md#reuse-equivalent-work Equal deterministic snapshots retain compiler arguments, versions, content, scope manifests, resolved native plugins and the environment variables their processes read (runtimeBuildEnvironment), never the whole environment. Descriptor reads are validated currently and captured with the fresh result for later admission, so discovery-cache temperature changes no execution key; graph and host witnesses separately gate reuse.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The resolved context and closures belong to one build; each capture releases local source and native-output buffers on return, with no resident process or historical map retained.
   */
  export function create(
    options: RunBuildOptions,
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
  ):
    | {
        capture: () => string | undefined;
        admit: (result: TtscBuildResult, emitDir: string) => boolean;
        record: (result: TtscBuildResult) => TtscBuildResult;
        identity?: () => string | undefined;
        begin?: () => void;
        replay?: (
          result: TtscBuildResult,
          emitDir: string,
        ) => string | undefined;
      }
    | undefined {
    const refuse = (reason: string): undefined => {
      if (
        options.runtimeCacheDir !== undefined ||
        options.bundleRuntimeOutputs === true
      )
        RuntimeBuildExplanation.report({
          outcome: "ineligible",
          project: execution.tsconfig,
          reason,
        });
      return undefined;
    };
    if (
      options.runtimeCacheDir === undefined ||
      typeof options.isolateOutputsTo !== "string" ||
      options.emit !== true ||
      options.format === true ||
      execution.pluginSetupFailure !== undefined ||
      execution.compilerSelection.inspectionError !== undefined ||
      PassthroughFlags.forwardsTerminalTsgoFlag(options)
    )
      return refuse(
        options.runtimeCacheDir === undefined
          ? "persistence-disabled"
          : execution.pluginSetupFailure !== undefined
            ? "plugin-setup-failed"
            : execution.compilerSelection.inspectionError !== undefined
              ? "compiler-selection-unavailable"
              : "unsupported-runtime-request",
      );
    const loaded = execution.pluginLoad;
    const unsupported = execution.nativePlugins.find((plugin) =>
      plugin.stage === "check"
        ? plugin.capabilities?.checkObservations !== true
        : plugin.capabilities?.emitObservations !== true,
    );
    if (unsupported !== undefined) {
      RuntimeBuildExplanation.report({
        outcome: "ineligible",
        project: execution.tsconfig,
        plugin: unsupported.name ?? unsupported.binary,
        stage: unsupported.stage,
        reason:
          unsupported.stage === "check"
            ? "missing-check-observations"
            : "missing-emit-observations",
      });
      return undefined;
    }
    if (
      loaded !== undefined &&
      (!loaded.discoveryInputsComplete ||
        !loaded.descriptorReadsDeclared ||
        loaded.observationsComplete === false)
    ) {
      RuntimeBuildExplanation.report({
        outcome: "ineligible",
        project: execution.tsconfig,
        reason: !loaded.discoveryInputsComplete
          ? "incomplete-plugin-discovery"
          : !loaded.descriptorReadsDeclared
            ? "undeclared-descriptor-inputs"
            : "incomplete-descriptor-observations",
      });
      return undefined;
    }
    if (loaded !== undefined) {
      const deferred = new Set(loaded.deferredHostInputs);
      if (
        loaded.hostInputs.some(
          (file) =>
            !deferred.has(file) &&
            (!Object.hasOwn(loaded.hostInputHashes, file) ||
              !Object.hasOwn(loaded.hostInputRealpaths, file)),
        )
      )
        return refuse("descriptor-input-proof-unavailable");
    }
    const emitDir = options.isolateOutputsTo;
    const args = TsgoArguments.createTsgoBuildArgs(execution, options, {
      listEmittedFiles: false,
    });
    const env = SidecarEnvironment.merge(process.env, options.env);
    // A custom executable can be a wrapper with undisclosed external inputs.
    // Inherited hints to the installed compiler still have package authority.
    if (execution.tsgo.packageJson === "") {
      try {
        const packaged = resolveTsgo({
          cwd: execution.projectRoot,
          env: SidecarEnvironment.merge(env, { TTSC_TSGO_BINARY: undefined }),
        });
        if (
          fs.realpathSync.native(packaged.binary) !==
          fs.realpathSync.native(execution.tsgo.binary)
        )
          return refuse("custom-compiler-without-package-authority");
      } catch {
        return refuse("compiler-package-authority-unavailable");
      }
    }
    const identities =
      execution.identities ??
      PluginContentIdentities.open({
        projectRoot: execution.projectRoot,
        cacheDir: path.dirname(options.runtimeCacheDir),
        env,
      });
    if (identities === undefined)
      return refuse("content-identity-store-unavailable");
    let inspected: ReturnType<typeof CompilerArgumentsInspection.inspect>;
    try {
      inspected = CompilerArgumentsInspection.inspect(
        args,
        execution.compilerSelection.compilerArgsCwd,
      );
    } catch {
      return refuse("compiler-arguments-unavailable");
    }
    if (
      inspected.args.some((arg) =>
        /^--?(?:runExternalCode|generateTrace|generateCpuProfile|pprofDir|diagnostics|extendedDiagnostics|traceResolution|explainFiles|listFiles|listEmittedFiles|build|watch)(?:=|$)/i.test(
          arg,
        ),
      )
    )
      return refuse("effectful-compiler-options");
    // Declared in a config of the chain, these select work a stored result
    // cannot stand for: other projects' builds, external code, or reports and
    // traces written beside it. Any config of the chain declaring one refuses,
    // whichever the effective value is.
    const declaresUnsupportedConfiguration = (): boolean =>
      execution.project.configPaths.some((config) => {
        const declared = readJsoncFile(config) as {
          compilerOptions?: Record<string, unknown>;
          references?: unknown;
        };
        return (
          (Array.isArray(declared.references) &&
            declared.references.length !== 0) ||
          [
            "runExternalCode",
            "generateTrace",
            "generateCpuProfile",
            "pprofDir",
            "diagnostics",
            "extendedDiagnostics",
            "traceResolution",
            "explainFiles",
            "listFiles",
            "listEmittedFiles",
          ].some((name) => declared.compilerOptions?.[name])
        );
      });
    // A native host that has not declared its environment reads may read any
    // variable with os.Getenv, so a project using one is keyed by the complete
    // environment, as every project was. Hosts that declare them, and projects
    // without plugins, are keyed by what their processes read
    // (samchon/ttsc#1852).
    const environment = (): unknown =>
      execution.nativePlugins.every(
        (plugin) => plugin.capabilities?.environmentInputs === true,
      )
        ? runtimeBuildEnvironment(env)
        : crypto
            .createHash("sha256")
            .update(
              JSON.stringify(
                Object.entries(env)
                  .filter(([key]) => !/^TTSX_RUNTIME_/i.test(key))
                  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
              ),
            )
            .digest("hex");
    const privately = (arg: string): string =>
      arg === emitDir || arg.startsWith(emitDir + path.sep)
        ? "<private-output>" + arg.slice(emitDir.length)
        : arg;
    // A stored result is proven by replaying the filesystem questions its
    // compiler asked, so finding and proving it runs no compiler and reads no
    // unchanged file, with plugins or without (samchon/ttsc#1852). With native
    // plugins the emitting producer is one of ttsc's own hosts, which reports
    // those questions itself. Without plugins the user's tsc compiles, and the
    // same questions come from one query of that tsc made just before the build
    // (CompilerTraceObservations); the replay after the build brackets it.
    let replaying = false;
    // The declared host inputs the last identity or capture observed. The cache
    // admits a result right after one of them, so admission compares the
    // result's recorded witnesses with these instead of observing each input a
    // second time within the same proof (samchon/ttsc#1852).
    let hostObservations = new Map<
      string,
      readonly [string | null, string | null]
    >();
    const observeHostInput = (file: string) => {
      const observed = RuntimeInputProof.observeHostInput(file);
      hostObservations.set(file, observed);
      return observed;
    };
    let traced:
      | Record<string, ITtscCompilerTransformation.IInputObservation>
      | undefined;
    const replayed =
      options.forceEmitProvenance === true
        ? {
            identity: (): string | undefined => {
              replaying = false;
              hostObservations = new Map();
              try {
                if (process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1")
                  return refuse("descriptor-bootstrap");
                const node =
                  execution.nativePlugins.length === 0
                    ? undefined
                    : resolveNodeBinary(env, execution.projectRoot, identities);
                if (execution.nativePlugins.length !== 0 && node === undefined)
                  return refuse("node-executable-proof-unavailable");
                // Plugin bytes are deterministic inputs of the pipeline, so a
                // harmless stamp or link change keeps their identity; compiler
                // and Node authority keep the strict physical identity.
                const compiler = [
                  ...new Set([
                    execution.tsgo.binary,
                    ...execution.nativePlugins.map((plugin) => plugin.binary),
                    ...(node === undefined ? [] : [node]),
                  ]),
                ].map((binary) =>
                  runtimeExecutableIdentity(
                    binary,
                    identities,
                    binary === execution.tsgo.binary || binary === node,
                  ),
                );
                if (compiler.some((identity) => identity === undefined))
                  return refuse(
                    "compiler-or-plugin-executable-proof-unavailable",
                  );
                for (const [directory, state] of Object.entries(
                  loaded?.pluginSources ?? {},
                ))
                  if (
                    !pluginSourceStateHolds(directory, state, {
                      projectRoot: execution.projectRoot,
                    })
                  )
                    return refuse("plugin-source-proof-changed");
                if (declaresUnsupportedConfiguration())
                  return refuse("unsupported-effective-configuration");
                for (const [file, expected] of Object.entries(
                  loaded?.hostInputHashes ?? {},
                ).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
                  const [physical, hash] = observeHostInput(file);
                  if (
                    hash !== expected ||
                    physical !== loaded?.hostInputRealpaths[file]
                  )
                    return refuse("descriptor-host-input-changed");
                }
                const responses: [string, string][] = [];
                for (const [file, before] of inspected.observations) {
                  if (
                    CompilerArgumentsInspection.observeInputFile(file) !==
                    before
                  )
                    return refuse("compiler-argument-input-changed");
                  responses.push([file, (JSON.parse(before) as string[])[2]!]);
                }
                // Only private destination values are normalized. The relative
                // layout remains in the identity because source maps are
                // output-relative.
                replaying = true;
                return JSON.stringify({
                  format: 4,
                  version: identities.version,
                  compiler,
                  args: inspected.args.map(privately),
                  responses,
                  environment: environment(),
                  project: execution.tsconfig,
                  cwd: execution.compilerSelection.compilerArgsCwd,
                  layout: path.relative(emitDir, execution.projectRoot),
                  unchecked: options.skipDiagnosticsCheck === true,
                  plugins: execution.nativePlugins,
                  pluginSources: loaded?.pluginSources,
                });
              } catch {
                replaying = false;
                return refuse("input-snapshot-failed");
              }
            },
            begin: (): void => {
              traced = undefined;
              if (execution.nativePlugins.length !== 0) return;
              const contents = RuntimeInputContents.open(
                execution.tsconfig,
                identities,
                RuntimeInputProof.textCodec,
              );
              try {
                const result = spawnNative(
                  execution.tsgo.binary,
                  [
                    ...args,
                    "--listFilesOnly",
                    "true",
                    "--listEmittedFiles",
                    "false",
                    "--traceResolution",
                    "true",
                  ],
                  { cwd: execution.compilerSelection.compilerArgsCwd, env },
                );
                if (
                  result.error === undefined &&
                  result.status === 0 &&
                  result.signal === null
                )
                  traced = CompilerTraceObservations.observe({
                    output: String(result.stdout),
                    configPaths: execution.project.configPaths,
                    configInputs: execution.project.configInputs ?? [],
                    contents,
                  });
              } catch {
                traced = undefined;
              } finally {
                contents.close();
              }
            },
            replay: (
              result: TtscBuildResult,
              produced: string,
            ): string | undefined => {
              if (result.compilerObservations === undefined) return "";
              const contents = RuntimeInputContents.open(
                execution.tsconfig,
                identities,
                RuntimeInputProof.textCodec,
              );
              try {
                return RuntimeInputProof.replay(
                  result.compilerObservations,
                  produced,
                  contents,
                );
              } finally {
                contents.close();
              }
            },
          }
        : {};
    return {
      ...replayed,
      record: (fresh) => {
        // The plugin-free producer reports nothing itself; the query taken
        // just before it stands for its reads once the replay after it holds.
        const result =
          traced === undefined || fresh.compilerObservations !== undefined
            ? fresh
            : { ...fresh, compilerObservations: traced };
        traced = undefined;
        if (loaded === undefined) return result;
        // Evaluation-time reads differ between a cold typed configuration and
        // its validated cached answer. Preserve their original proof with the
        // result instead of making discovery-cache temperature a program key.
        const deferred = new Set(loaded.deferredHostInputs);
        const populations = [
          result,
          {
            ...loaded,
            // Forwarded config paths have not been read by the descriptor.
            // Their consuming native generation supplies any required proof.
            hostInputs: loaded.hostInputs.filter((file) => !deferred.has(file)),
          },
        ];
        const hostInputs = [
          ...new Set(
            populations.flatMap((owner) => [
              ...(owner.hostInputs ?? []),
              ...Object.keys(owner.hostInputHashes ?? {}),
              ...Object.keys(owner.hostInputRealpaths ?? {}),
            ]),
          ),
        ].sort();
        const merge = (key: "hostInputHashes" | "hostInputRealpaths") => {
          const witnesses: Record<string, string | null> = {};
          const unavailable = new Set<string>();
          for (const owner of populations) {
            for (const file of owner.hostInputs ?? [])
              if (!Object.hasOwn(owner[key] ?? {}, file)) unavailable.add(file);
            for (const [file, value] of Object.entries(owner[key] ?? {})) {
              if (Object.hasOwn(witnesses, file) && witnesses[file] !== value)
                unavailable.add(file);
              witnesses[file] = value;
            }
          }
          for (const file of unavailable) delete witnesses[file];
          return witnesses;
        };
        return {
          ...result,
          hostInputs,
          hostInputHashes: merge("hostInputHashes"),
          hostInputRealpaths: merge("hostInputRealpaths"),
          ...(loaded.observationsComplete === false
            ? { observationsComplete: false as const }
            : {}),
        };
      },
      capture: () => {
        hostObservations = new Map();
        try {
          if (process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1")
            return refuse("descriptor-bootstrap");
          const node =
            execution.nativePlugins.length === 0
              ? undefined
              : resolveNodeBinary(env, execution.projectRoot, identities);
          if (execution.nativePlugins.length !== 0 && node === undefined)
            return refuse("node-executable-proof-unavailable");
          const binaries = [
            ...new Set([
              execution.tsgo.binary,
              ...execution.nativePlugins.map((plugin) => plugin.binary),
              ...(node === undefined ? [] : [node]),
            ]),
          ];
          const compilerIdentities = binaries.map((binary) =>
            // Native plugin bytes are deterministic inputs of the completed
            // pipeline; harmless timestamp/link changes can force a new hash
            // without changing that execution. Compiler/Node authority retains
            // its existing strict physical/metadata identity.
            runtimeExecutableIdentity(
              binary,
              identities,
              binary === execution.tsgo.binary || binary === node,
            ),
          );
          if (compilerIdentities.some((identity) => identity === undefined))
            return refuse("compiler-or-plugin-executable-proof-unavailable");
          for (const [directory, state] of Object.entries(
            loaded?.pluginSources ?? {},
          ))
            if (
              !pluginSourceStateHolds(directory, state, {
                projectRoot: execution.projectRoot,
              })
            )
              return refuse("plugin-source-proof-changed");
          const query = (flags: string[]) => {
            const result = spawnNative(
              execution.tsgo.binary,
              [...args, ...flags],
              { cwd: execution.compilerSelection.compilerArgsCwd, env },
            );
            if (result.error || result.status !== 0 || result.signal !== null)
              throw new Error("runtime input inspection unavailable");
            return String(result.stdout);
          };
          // The effective configuration is a function of the arguments and
          // the config chain. When every file the chain read is known, those
          // files are witnessed with the other inputs and the arguments enter
          // the snapshot, so the compiler is not started a second time only to
          // restate them (samchon/ttsc#1852).
          const chained = execution.project.configInputsComplete === true;
          if (chained && declaresUnsupportedConfiguration())
            return refuse("unsupported-effective-configuration");
          const config = chained
            ? undefined
            : JSON.parse(query(["--showConfig"]));
          if (
            chained
              ? false
              : !config ||
                typeof config.compilerOptions !== "object" ||
                config.compilerOptions === null ||
                config.references?.length ||
                config.compilerOptions.runExternalCode === true ||
                [
                  "generateTrace",
                  "generateCpuProfile",
                  "pprofDir",
                  "diagnostics",
                  "extendedDiagnostics",
                  "traceResolution",
                  "explainFiles",
                  "listFiles",
                  "listEmittedFiles",
                ].some((name) => config.compilerOptions[name])
          )
            return refuse("unsupported-effective-configuration");
          const listed = query([
            "--listFilesOnly",
            "true",
            "--listEmittedFiles",
            "false",
          ])
            .split(/\r?\n/)
            .filter((line) => line.length !== 0);
          if (
            listed.length === 0 ||
            !listed.every(
              (file) =>
                path.isAbsolute(file) && /\.(?:[cm]?[jt]sx?|json)$/i.test(file),
            )
          )
            return refuse("source-selection-unavailable");
          // The selected sources are witnessed first: their physical
          // directories name the package scopes whose manifests, present or
          // absent, are inputs of the same compile.
          const contents = RuntimeInputContents.open(
            execution.tsconfig,
            identities,
          );
          const inputs = new Set([
            ...listed,
            ...execution.project.configPaths,
            ...(chained ? (execution.project.configInputs ?? []) : []),
            ...inspected.observations.keys(),
          ]);
          const scopes = new Set<string>();
          for (const [file, physical] of contents.observe(listed)) {
            // The compiler just listed it, so its absence is a moving input.
            if (physical === null)
              throw new Error("runtime source selection moved");
            for (const spelling of [file, physical]) {
              let directory = path.dirname(spelling);
              while (!scopes.has(directory)) {
                scopes.add(directory);
                inputs.add(path.join(directory, "package.json"));
                const parent = path.dirname(directory);
                if (parent === directory) break;
                directory = parent;
              }
            }
          }
          const hashes = contents.observe([...inputs].sort());
          contents.close();
          for (const [file, expected] of Object.entries(
            loaded?.hostInputHashes ?? {},
          ).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
            const [physical, hash] = observeHostInput(file);
            if (
              hash !== expected ||
              physical !== loaded?.hostInputRealpaths[file]
            )
              return refuse("descriptor-host-input-changed");
          }
          for (const [file, before] of inspected.observations)
            if (CompilerArgumentsInspection.observeInputFile(file) !== before)
              return refuse("compiler-argument-input-changed");
          // Only private destination values are normalized. The relative layout
          // remains in the identity because source maps are output-relative.
          for (const key of config === undefined
            ? []
            : ["outDir", "declarationDir", "tsBuildInfoFile", "outFile"])
            if (
              typeof config.compilerOptions[key] === "string" &&
              (path.resolve(
                path.dirname(execution.tsconfig),
                config.compilerOptions[key],
              ) === options.isolateOutputsTo ||
                path
                  .resolve(
                    path.dirname(execution.tsconfig),
                    config.compilerOptions[key],
                  )
                  .startsWith(emitDir + path.sep))
            )
              config.compilerOptions[key] =
                "<private-output>" +
                path.relative(
                  emitDir,
                  path.resolve(
                    path.dirname(execution.tsconfig),
                    config.compilerOptions[key],
                  ),
                );
          // Upstream synthesizes an exclusion for the overridden outDir too.
          if (config !== undefined && Array.isArray(config.exclude))
            config.exclude = config.exclude.map((name: unknown) =>
              typeof name === "string" &&
              path.resolve(path.dirname(execution.tsconfig), name) === emitDir
                ? "<private-output>"
                : name,
            );
          return JSON.stringify({
            format: 3,
            version: identities.version,
            compilerIdentities,
            config: config ?? { arguments: inspected.args.map(privately) },
            hashes,
            environment: environment(),
            project: execution.tsconfig,
            cwd: execution.compilerSelection.compilerArgsCwd,
            layout: path.relative(emitDir, execution.projectRoot),
            unchecked: options.skipDiagnosticsCheck === true,
            plugins: execution.nativePlugins,
            pluginSources: loaded?.pluginSources,
          });
        } catch {
          return refuse("input-snapshot-failed");
        }
      },
      admit: (result, emitDir) => {
        if (
          result.status !== 0 ||
          result.emittedSources === undefined ||
          Object.keys(result.emittedSourceProofFailures ?? {}).length !== 0 ||
          !Object.values(result.emittedSources).every(
            (sources) =>
              Array.isArray(sources) &&
              sources.length > 0 &&
              sources.every(
                (source) =>
                  typeof source === "string" && path.isAbsolute(source),
              ),
          )
        ) {
          RuntimeBuildExplanation.report({
            outcome: "rejected",
            project: execution.tsconfig,
            reason: "emit-ownership-unavailable",
          });
          return false;
        }
        if (
          execution.nativePlugins.length !== 0 &&
          result.graph?.inputObservations === undefined
        ) {
          RuntimeBuildExplanation.report({
            outcome: "rejected",
            project: execution.tsconfig,
            reason: "native-input-graph-unavailable",
          });
          return false;
        }
        // The plugins of this build would run under env, so a recorded
        // environment read must still hold there.
        const accepted = RuntimeInputProof.holds(
          result,
          execution.projectRoot,
          emitDir,
          env,
          // The replayed proof validates this population whole, but only a
          // request that took its identity runs that replay.
          replaying && result.compilerObservations !== undefined,
          hostObservations,
        );
        if (!accepted)
          RuntimeBuildExplanation.report({
            outcome: "rejected",
            project: execution.tsconfig,
            reason:
              result.observationsComplete === false
                ? "producer-observations-incomplete"
                : Object.keys(result.graph?.inputProofFailures ?? {}).length !==
                    0
                  ? "producer-input-proof-failure"
                  : "producer-input-observations-changed",
          });
        return accepted;
      },
    };
  }
}
