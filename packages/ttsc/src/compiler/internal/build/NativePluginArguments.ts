import path from "node:path";

import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import type { TtscBuildOptions } from "../../../structures/internal/TtscBuildOptions";
import type { TtscCommonOptions } from "../../../structures/internal/TtscCommonOptions";
import { createNativeProjectContextArgs } from "../project/createNativeProjectContextArgs";
import { selectSharedHostPlugin } from "../sharedHost/selectSharedHostPlugin";
import type { BuildExecution } from "./BuildExecution";
import { PassthroughFlags } from "./PassthroughFlags";
import type { RunBuildOptions } from "./RunBuildOptions";
import { isAbsoluteLocalProjectInputPath } from "./isAbsoluteLocalProjectInputPath";

/**
 * The argv ttsc hands to a native plugin host.
 *
 * A native host speaks its own subcommands (`build`, `check`, `fix`, `format`,
 * `project-inputs`) and receives the project, the plugin list, and the compiler
 * flags as separate arguments rather than one tsgo command line. Optional
 * capabilities a host declares (threading, diagnostics timing) decide which of
 * ttsc's optional arguments are sent. This negotiation avoids sending those
 * extensions to undeclared hosts; it does not certify every host's acceptance
 * of the core protocol or the truth of its capability declaration.
 *
 * @evidence contracts/common.md#principled-implementation The namespace separates the host subcommand protocol from compiler forwarding and uses declared capabilities for optional host fields.
 * @evidence contracts/common.md#clear-and-simple-design Build, check and input-query composers share descriptor serialization while preserving each command's own supported modifiers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional protocol extensions require capabilities instead of mutating foreign flag sets or dispatching on a particular plugin name.
 * @evidence contracts/common.md#meaningful-documentation Namespace prose states protocol separation and capability purpose; composer comments explain project context, command effects and payload fields.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The grouping itself defines no native path representation; its selected argv composers address the paths they carry.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace contains no processing strategy apart from its separately selected composers and serializer.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This API grouping retains no completed or in-flight host query or payload.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No native host, buffer history or handle is owned by the namespace.
 */
export namespace NativePluginArguments {
  /**
   * Compose a shared transform host's build or no-emit check command.
   * Project-context arguments require the selected host's capability; quiet
   * modifiers remain absent on the compatibility check lane.
   *
   * A supplied provenancePath is a private absolute artifact destination and
   * requires explicit emitProvenance support from the selected host.
   *
   * @evidence contracts/common.md#principled-implementation Emit selection chooses build versus check; the selected host's independent capabilities gate explicit project context and a supplied absolute emit-proof artifact destination.
   * @evidence contracts/common.md#clear-and-simple-design Core protocol argv precedes optional project/output/verbosity fields; compiler passthrough travels separately through the environment.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Capability checks and omission of build-only modifiers protect actual strict-host protocol differences without recognizing plugin names or altering foreign flag parsers.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain shared-host selection, no-emit compatibility modifiers and the optional private provenance path's capability/absolute-path premise.
   * @evidence contracts/portability.md#os-neutral-implementation Native output paths resolve against execution cwd and remain individual argv elements; JSON serialization preserves plugin payload without shell escaping.
   * @evidence contracts/performance.md#efficient-algorithms Plugin projection/JSON encoding follows plugin count, name/stage text and configuration serialization work. Selected-host capability lookups may each scan the plugin list; optional project-context serialization and native output-path resolution add payload/path-text costs. Returned argv storage follows composed bytes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure argv composition coordinates no shared producer or retained cross-request result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Arguments are returned to the process owner and no process or persistent buffer is acquired here.
   */
  export function createNativeBuildArgs(
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    options: RunBuildOptions,
    plugins: readonly ITtscLoadedNativePlugin[],
    provenancePath?: string,
  ): string[] {
    const args = [
      options.emit === false ? "check" : "build",
      "--tsconfig=" + execution.tsconfig,
      "--plugins-json=" + serializeNativePlugins(plugins),
      "--cwd=" + execution.projectRoot,
    ];
    if (provenancePath !== undefined) {
      if (selectSharedHostPlugin(plugins).capabilities?.emitProvenance !== true)
        throw new Error(
          "ttsc: native compiler host does not support emit provenance",
        );
      if (!isAbsoluteLocalProjectInputPath(provenancePath))
        throw new Error(
          "ttsc: emit provenance destination must be an absolute native path",
        );
      args.push("--emit-provenance-json=" + provenancePath);
    }
    if (
      selectSharedHostPlugin(plugins).capabilities?.projectContextArgs === true
    ) {
      args.push(
        ...createNativeProjectContextArgs(
          execution.project,
          execution.pluginConfigDir,
        ),
      );
    }
    if (options.emit === true) {
      args.push("--emit");
    }
    if (options.outDir) {
      args.push("--outDir=" + path.resolve(execution.cwd, options.outDir));
    }
    // Third-party transform hosts already treat the `check` subcommand as a
    // quiet no-emit pass. Keep ttsc-owned build modifiers off that lane so older
    // strict hosts do not reject unknown optional flags before analysis starts.
    if (options.emit !== false) {
      if (options.quiet === false) {
        args.push("--verbose");
      } else if (options.quiet === true) {
        args.push("--quiet");
      }
    }
    return args;
  }

  /**
   * Compose one check-stage host's check, fix or format command. The full
   * plugin configuration accompanies the command; optional threading, timing
   * and project-context fields require that host's declared support.
   *
   * @evidence contracts/common.md#principled-implementation Subcommand selection follows format/fix options while capability-gated fields preserve the selected host's accepted protocol.
   * @evidence contracts/common.md#clear-and-simple-design Shared core fields are assembled before small helpers add threading and timing, separating host capability policy from compiler argv.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional flags use descriptor capabilities rather than special plugin names or monkey-patched foreign flag sets.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains command effects, full configuration delivery and capability-dependent fields.
   * @evidence contracts/portability.md#os-neutral-implementation cwd and output locations retain native path semantics; each protocol flag is a separate argv element and plugin configuration is JSON, not shell text.
   * @evidence contracts/performance.md#efficient-algorithms Composition serializes plugin count/name/stage/config fields; capability-gated timing selection projects the unexpanded forwarded argv frame with token/name/value costs. Optional project-context encoding and native output-path resolution add text work; returned storage follows argv bytes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Building one command does not coordinate completed or in-flight execution across consumers.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No sidecar or persistent argument cache is owned by this composer.
   */
  export function createNativeCheckArgs(
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    options: TtscBuildOptions,
    plugin: ITtscLoadedNativePlugin,
  ): string[] {
    const args = [
      nativeCheckSubcommand(options),
      "--tsconfig=" + execution.tsconfig,
      "--plugins-json=" + serializeNativePlugins(execution.nativePlugins),
      "--cwd=" + execution.projectRoot,
    ];
    if (plugin.capabilities?.projectContextArgs === true) {
      args.push(
        ...createNativeProjectContextArgs(
          execution.project,
          execution.pluginConfigDir,
        ),
      );
    }
    if (options.outDir) {
      args.push("--outDir=" + path.resolve(execution.cwd, options.outDir));
    }
    if (options.quiet === false) {
      args.push("--verbose");
    } else if (options.quiet === true) {
      args.push("--quiet");
    }
    args.push(...createNativeCheckThreadingArgs(options, plugin));
    args.push(...createNativeCheckDiagnosticsArgs(options, plugin));
    return args;
  }

  /**
   * Build the argv of a native host's `project-inputs` query, which reports the
   * non-TypeScript files (documents, schemas, configs) the host's rules read,
   * so watch and cache invalidation can observe them.
   *
   * The caller must check projectInputs capability before launching this query.
   *
   * @evidence contracts/common.md#principled-implementation Project selection and complete plugin configuration let the host report its actual rule inputs; optional project context is sent only when supported.
   * @evidence contracts/common.md#clear-and-simple-design This composer owns query argv while the discovery operation owns capability selection, execution and snapshot validation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit project-inputs protocol queries declared dependencies instead of guessing files from plugin names or dropping unsupported inputs.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains non-TypeScript dependencies, invalidation purpose and the caller's capability premise.
   * @evidence contracts/portability.md#os-neutral-implementation Selected tsconfig/cwd spellings travel as separate native argv fields; no slash rewriting or shell construction is applied to paths.
   * @evidence contracts/performance.md#efficient-algorithms Plugin descriptors are projected and JSON-encoded once, with plugin count, name/stage/config serialization costs. Optional project-context encoding and composed native path-field text add work/storage; fixed field count does not make payload cost constant.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Query composition establishes no cross-request reuse of host dependency discovery.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned argv has caller ownership; this function acquires no native resource or retained snapshot.
   */
  export function createNativeProjectInputsArgs(
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    plugin: ITtscLoadedNativePlugin,
  ): string[] {
    const args = [
      "project-inputs",
      "--tsconfig=" + execution.tsconfig,
      "--plugins-json=" + serializeNativePlugins(execution.nativePlugins),
      "--cwd=" + execution.projectRoot,
    ];
    if (plugin.capabilities?.projectContextArgs === true) {
      args.push(
        ...createNativeProjectContextArgs(
          execution.project,
          execution.pluginConfigDir,
        ),
      );
    }
    return args;
  }

  /**
   * Send threading options only to check hosts declaring support. An unknown
   * strict host may reject optional flags before it can analyze the project;
   * transform hosts use the separate build/compiler-options channel.
   */
  function createNativeCheckThreadingArgs(
    options: TtscCommonOptions,
    plugin: ITtscLoadedNativePlugin,
  ): string[] {
    if (!nativeHostAcceptsThreadingArgs(plugin)) return [];
    const args: string[] = [];
    if (options.singleThreaded === true) {
      args.push("--singleThreaded");
    }
    if (options.checkers !== undefined) {
      args.push("--checkers=" + String(options.checkers));
    }
    return args;
  }

  /**
   * Return true when the loaded native check-stage host has declared
   * `capabilities.threadingArgs` in its plugin descriptor.
   *
   * An absent declaration means unsupported, regardless of package ownership or
   * plugin name, because the host's native flag set is otherwise unknown.
   */
  function nativeHostAcceptsThreadingArgs(
    plugin: ITtscLoadedNativePlugin,
  ): boolean {
    return plugin.capabilities?.threadingArgs === true;
  }

  function createNativeCheckDiagnosticsArgs(
    options: TtscCommonOptions,
    plugin: ITtscLoadedNativePlugin,
  ): string[] {
    if (!nativeHostAcceptsDiagnosticsTiming(plugin)) return [];
    if (!PassthroughFlags.hasDiagnosticsFlag(options)) return [];
    return ["--diagnostics"];
  }

  function nativeHostAcceptsDiagnosticsTiming(
    plugin: ITtscLoadedNativePlugin,
  ): boolean {
    return plugin.capabilities?.diagnosticsTiming === true;
  }

  /**
   * The `--diagnostics` timing label of one transform-host run, naming every
   * plugin that shared the host so a slow run can be attributed.
   *
   * @evidence contracts/common.md#principled-implementation Names of all selected participants form one label for the shared execution, rather than attributing its duration to only one plugin.
   * @evidence contracts/common.md#clear-and-simple-design A single name projection and join supplies timing attribution without coupling labels to process selection.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Participant names come from the actual loaded selection, not a fixed benchmark label or special plugin list.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies the shared-host timing purpose and attribution scope.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Formatting participant names touches no native path, filesystem or process boundary.
   *
   * @evidence contracts/performance.md#efficient-algorithms One projection and join cost O(P plus participant-name/output bytes) for P plugins, with no repeated string-prefix rebuilding.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A label formatter coordinates no shared computation beyond the supplied participant list.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The formatter returns text without retaining selection history or handles.
   */
  export function transformHostTimingLabel(
    plugins: readonly ITtscLoadedNativePlugin[],
  ): string {
    return (
      `ttsc transform host [` +
      `${plugins.map((plugin) => plugin.name).join(", ")}] time`
    );
  }

  /**
   * Decide which native plugin subcommand the lint sidecar should run for the
   * current `runBuild` invocation. The launcher selects exactly one of `fix` /
   * `format` / `check` via subcommand dispatch, so at most one of the
   * `options.fix` / `options.format` booleans is true.
   */
  function nativeCheckSubcommand(options: TtscBuildOptions): string {
    if (options.format === true) return "format";
    if (options.fix === true) return "fix";
    return "check";
  }

  /**
   * Serialize the plugin list to a compact JSON string for `--plugins-json=`.
   * Only the fields the native binary protocol requires are included.
   *
   * @evidence contracts/common.md#principled-implementation Projection retains config, name and stage, the protocol's declared plugin descriptor fields, without serializing host-loader implementation details.
   * @evidence contracts/common.md#clear-and-simple-design One explicit projection defines the JSON wire representation separately from in-memory plugin metadata.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Standard JSON encoding preserves configuration structure without handcrafted quoting or mutation of foreign descriptors.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the compact protocol purpose and deliberate field restriction.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation JSON descriptor serialization accesses no native filesystem or process and applies no path normalization.
   *
   * @evidence contracts/performance.md#efficient-algorithms One projection visits P plugins and standard JSON serialization traverses config/name/stage values into returned bytes. Custom getters/toJSON and exceptional or cyclic config values follow ordinary JSON semantics and can add work or throw; no serialization work ceiling is supplied here. Only required descriptor fields are explicitly projected.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Mutable plugin configuration is serialized for the current invocation without establishing cross-request equivalence.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Local projections become returned text; no persistent descriptor cache or handle is retained.
   */
  export function serializeNativePlugins(
    plugins: readonly ITtscLoadedNativePlugin[],
  ): string {
    return JSON.stringify(
      plugins.map((plugin) => ({
        config: plugin.config,
        name: plugin.name,
        stage: plugin.stage,
      })),
    );
  }
}
