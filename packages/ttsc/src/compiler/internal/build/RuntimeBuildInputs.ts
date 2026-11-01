import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveNodeBinary } from "../../../internal/resolveNodeBinary";
import { runtimeExecutableIdentity } from "../../../internal/runtimeExecutableIdentity";
import { PluginContentIdentities } from "../../../plugin/internal/source/PluginContentIdentities";
import { pluginSourceStateHolds } from "../../../plugin/internal/source/pluginSourceStateHolds";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { CompilerArgumentsInspection } from "../CompilerArgumentsInspection";
import { resolveTsgo } from "../resolveTsgo";
import { SidecarEnvironment } from "../sharedHost/SidecarEnvironment";
import { spawnNative } from "../spawnNative";
import type { BuildExecution } from "./BuildExecution";
import { PassthroughFlags } from "./PassthroughFlags";
import type { RunBuildOptions } from "./RunBuildOptions";
import { RuntimeInputProof } from "./RuntimeInputProof";
import { TsgoArguments } from "./TsgoArguments";

/**
 * Prove runtime build inputs through the selected upstream compiler's read-only
 * effective configuration and source-selection commands. Repeating selection
 * discovers added roots and changed resolution candidates without guessing a
 * project boundary or treating workspace links as immutable dependencies.
 * Native plugin observations add their independently replayed input closure.
 * Custom compiler overrides require the physical identity of the installed
 * package compiler; wrappers with undisclosed external inputs stay fresh.
 *
 * @evidence contracts/common.md#principled-implementation The actual selected compiler defines effective options and source membership; content and physical identities cover that closure and package scopes, with separate native producer proof for checks.
 * @evidence contracts/common.md#clear-and-simple-design One factory supplies input capture and result admission to the runtime document store without changing normal build dispatch.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Incomplete descriptors, unsupported effectful compiler modes and unproved native producers and custom compilers without package authority use the existing fresh build rather than weakening diagnostics or substituting a compiler.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes compiler-owned membership, workspace scope and independent plugin observations.
 * @evidence contracts/portability.md#os-neutral-implementation The selected executable receives native argv and cwd; source and package scopes use native physical paths and preserve lexical spellings without OS-wide case folding.
 * @evidence contracts/performance.md#efficient-algorithms Each snapshot runs two read-only native queries and hashes selected source, package, executable and declared host input bytes; shared ancestor sets avoid repeated package-scope walks.
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
   * @evidence contracts/common.md#clear-and-simple-design Two closures share the resolved request while capture owns current selection and admission owns retained generation proof.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native transforms without complete emit observations and arbitrary external-code or profiling modes decline reuse rather than inventing input completeness. Custom compiler overrides need matching installed package identity, including inherited dependency hints; the original build remains the fallback.
   * @evidence contracts/common.md#meaningful-documentation Native prose states current producer support and private-runtime scope, including why fresh transformation remains necessary.
   * @evidence contracts/portability.md#os-neutral-implementation Source and package observations use native paths and bracketed byte reads, and upstream probes use the original compiler working directory and argv without shell composition.
   * @evidence contracts/performance.md#efficient-algorithms Capture performs two upstream selection/config queries, actual executable proofs and O(selected bytes) hashes; unique ancestor and path sets bound duplicate reads within one snapshot. Admission replays only recorded native inputs.
   * @evidence contracts/performance.md#reuse-equivalent-work Equal deterministic snapshots retain compiler arguments, versions, content, scope manifests, plugin binaries/configuration and environment; graph and host witnesses separately gate cached check reuse.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The resolved context and closures belong to one build; each capture releases local source and native-output buffers on return, with no resident process or historical map retained.
   */
  export function create(
    options: RunBuildOptions,
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
  ):
    | {
        capture: () => string | undefined;
        admit: (result: TtscBuildResult, emitDir: string) => boolean;
      }
    | undefined {
    if (
      options.runtimeCacheDir === undefined ||
      typeof options.isolateOutputsTo !== "string" ||
      options.emit !== true ||
      options.format === true ||
      execution.pluginSetupFailure !== undefined ||
      execution.compilerSelection.inspectionError !== undefined ||
      PassthroughFlags.forwardsTerminalTsgoFlag(options)
    )
      return undefined;
    const loaded = execution.pluginLoad;
    if (
      execution.nativePlugins.some((plugin) =>
        plugin.stage === "check"
          ? plugin.capabilities?.checkObservations !== true
          : plugin.capabilities?.emitObservations !== true,
      ) ||
      (loaded !== undefined &&
        (!loaded.discoveryInputsComplete ||
          !loaded.descriptorReadsDeclared ||
          loaded.observationsComplete === false))
    )
      return undefined;
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
          return undefined;
      } catch {
        return undefined;
      }
    }
    const identities =
      execution.identities ??
      PluginContentIdentities.open({
        projectRoot: execution.projectRoot,
        cacheDir: path.dirname(options.runtimeCacheDir),
        env,
      });
    if (identities === undefined) return undefined;
    let inspected: ReturnType<typeof CompilerArgumentsInspection.inspect>;
    try {
      inspected = CompilerArgumentsInspection.inspect(
        args,
        execution.compilerSelection.compilerArgsCwd,
      );
    } catch {
      return undefined;
    }
    if (
      inspected.args.some((arg) =>
        /^--?(?:runExternalCode|generateTrace|generateCpuProfile|pprofDir|diagnostics|extendedDiagnostics|traceResolution|explainFiles|listFiles|listEmittedFiles|build|watch)(?:=|$)/i.test(
          arg,
        ),
      )
    )
      return undefined;
    return {
      capture: () => {
        try {
          if (process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1") return undefined;
          const node =
            execution.nativePlugins.length === 0
              ? undefined
              : resolveNodeBinary(env, execution.projectRoot, identities);
          if (execution.nativePlugins.length !== 0 && node === undefined)
            return undefined;
          const binaries = [
            ...new Set([
              execution.tsgo.binary,
              ...execution.nativePlugins.map((plugin) => plugin.binary),
              ...(node === undefined ? [] : [node]),
            ]),
          ];
          const compilerIdentities = binaries.map((binary) =>
            runtimeExecutableIdentity(binary, identities),
          );
          if (compilerIdentities.some((identity) => identity === undefined))
            return undefined;
          for (const [directory, state] of Object.entries(
            loaded?.pluginSources ?? {},
          ))
            if (
              !pluginSourceStateHolds(directory, state, {
                projectRoot: execution.projectRoot,
              })
            )
              return undefined;
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
          const config = JSON.parse(query(["--showConfig"]));
          if (
            !config ||
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
            return undefined;
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
            return undefined;
          const inputs = new Set([
            ...listed,
            ...execution.project.configPaths,
            ...inspected.observations.keys(),
          ]);
          const scopes = new Set<string>();
          for (const file of listed) {
            for (const spelling of [file, fs.realpathSync.native(file)]) {
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
          const hashes = [...inputs].sort().map((file) => {
            try {
              const observed = JSON.parse(
                CompilerArgumentsInspection.observeInputFile(file),
              );
              return [file, observed[0], observed[2]];
            } catch (error) {
              if (
                (error as NodeJS.ErrnoException).code !== "ENOENT" &&
                (error as NodeJS.ErrnoException).code !== "ENOTDIR"
              )
                throw error;
              return [file, null, null];
            }
          });
          const hostInputs: [string, string | null, string | null][] = [];
          for (const [file, expected] of Object.entries(
            loaded?.hostInputHashes ?? {},
          ).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
            const [physical, hash] = RuntimeInputProof.observeHostInput(file);
            if (
              hash !== expected ||
              physical !== loaded?.hostInputRealpaths[file]
            )
              return undefined;
            hostInputs.push([file, physical, hash]);
          }
          for (const [file, before] of inspected.observations)
            if (CompilerArgumentsInspection.observeInputFile(file) !== before)
              return undefined;
          // Only private destination values are normalized. The relative layout
          // remains in the identity because source maps are output-relative.
          for (const key of [
            "outDir",
            "declarationDir",
            "tsBuildInfoFile",
            "outFile",
          ])
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
          if (Array.isArray(config.exclude))
            config.exclude = config.exclude.map((name: unknown) =>
              typeof name === "string" &&
              path.resolve(path.dirname(execution.tsconfig), name) === emitDir
                ? "<private-output>"
                : name,
            );
          const environment = Object.entries(env)
            .filter(([key]) => !/^TTSX_RUNTIME_/i.test(key))
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
          return JSON.stringify({
            format: 1,
            version: identities.version,
            compilerIdentities,
            config,
            hashes,
            hostInputs,
            environment: crypto
              .createHash("sha256")
              .update(JSON.stringify(environment))
              .digest("hex"),
            project: execution.tsconfig,
            cwd: execution.compilerSelection.compilerArgsCwd,
            layout: path.relative(emitDir, execution.projectRoot),
            unchecked: options.skipDiagnosticsCheck === true,
            plugins: execution.nativePlugins,
            pluginSources: loaded?.pluginSources,
            descriptor: loaded?.hostInputHashes,
          });
        } catch {
          return undefined;
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
        )
          return false;
        if (
          execution.nativePlugins.length !== 0 &&
          result.graph?.inputObservations === undefined
        )
          return false;
        return RuntimeInputProof.holds(result, execution.projectRoot, emitDir);
      },
    };
  }
}
