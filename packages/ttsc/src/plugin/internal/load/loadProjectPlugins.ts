import childProcess from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readJsonFile } from "../../../compiler/internal/project/readJsonFile";
import { readProjectConfig } from "../../../compiler/internal/project/readProjectConfig";
import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { E2ETrace } from "../../../internal/E2ETrace";
import { OwnedSynchronousProcess } from "../../../internal/OwnedSynchronousProcess";
import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { javascriptRuntimeCapabilities } from "../../../internal/javascriptRuntimeCapabilities";
import { resolveNodeBinary } from "../../../internal/resolveNodeBinary";
import { spawnSyncResilient } from "../../../internal/spawnSyncResilient";
import type { ITtscPlugin } from "../../../structures/ITtscPlugin";
import type { ITtscPluginContributor } from "../../../structures/ITtscPluginContributor";
import type { ITtscPluginFactoryContext } from "../../../structures/ITtscPluginFactoryContext";
import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import { pluginDescriptorFailureReason } from "../pluginDescriptorFailureReason";
import { pluginDescriptorProcessFailure } from "../pluginDescriptorProcessFailure";
import { NativeSourcePackages } from "../source/NativeSourcePackages";
import type { PluginBuildEnvironmentWitness } from "../source/PluginBuildEnvironmentWitness";
import { PluginContentIdentities } from "../source/PluginContentIdentities";
import { SourcePluginWorkspace } from "../source/SourcePluginWorkspace";
import { buildSourcePlugin } from "../source/buildSourcePlugin";
import { isPathWithin } from "../source/isPathWithin";
import { pluginBuildEnvironment } from "../source/pluginBuildEnvironment";
import { pluginBuildVersions } from "../source/pluginBuildVersions";
import { pluginModuleReplaceDirectories } from "../source/pluginModuleReplaceDirectories";
import { pluginSourceState } from "../source/pluginSourceState";
import { resolvePluginGoModule } from "../source/resolvePluginGoModule";
import { COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE } from "./COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE";
import { PLUGIN_DESCRIPTOR_SHIM_SOURCE } from "./PLUGIN_DESCRIPTOR_SHIM_SOURCE";
import { PluginDescriptorAdmission } from "./PluginDescriptorAdmission";
import { PluginDescriptorEvaluationCache } from "./PluginDescriptorEvaluationCache";
import { PluginPackageResolution } from "./PluginPackageResolution";
import { ProjectPluginEntries } from "./ProjectPluginEntries";
import { collectProjectHostInputs } from "./collectProjectHostInputs";
import { composePluginSources } from "./composePluginSources";
import { declaresHostInputReads } from "./declaresHostInputReads";
import { hashHostInputPaths } from "./hashHostInputPaths";
import { moduleResolutionBaseSelects } from "./moduleResolutionBaseSelects";
import { pluginLabel } from "./pluginLabel";
import { realpathHostInput } from "./realpathHostInput";
import { realpathHostInputPaths } from "./realpathHostInputPaths";
import { rejectJsTransformFunctions } from "./rejectJsTransformFunctions";
import { requirePluginSource } from "./requirePluginSource";
import { resolveNativeSource } from "./resolveNativeSource";
import { validatePluginContributors } from "./validatePluginContributors";
import { validatePluginSource } from "./validatePluginSource";
import { visitImportMappedCandidates } from "./visitImportMappedCandidates";

/**
 * Resolve, load, and build all native plugin sidecars for a TypeScript project.
 *
 * Reads the project config, discovers plugin entries (from tsconfig and package
 * auto-discovery), validates and composes their descriptors, then invokes
 * `buildSourcePlugin` to compile each Go source package into a cached binary.
 * Native ownership comes from the selected Go packages in generated build
 * workspaces. The source-selected tool proposes nested transform ownership
 * under generic host manifests while preserving source-relative input layout.
 * Main proposals must agree in their full owning module; linked proposals must
 * agree inside every selected transform host. Errors or disagreement terminate
 * the load rather than changing the proposed kind. Watch callers first receive
 * structurally selected source/module/contributor repair interests, before
 * metadata can reject them. Valid records then narrow those interests to the
 * exact build directories; interests alone never admit a plugin, certify a kind
 * or supply reusable source-state proof. Returns the ordered native plugins,
 * parsed project config, recorded JavaScript-host inputs and unresolved
 * selection candidates, and the keyed state of reported Go source directories
 * supplied to the builds (`pluginSources`): each plugin's module root and each
 * contributor's source, with its state (`pluginSourceState`), the sources as
 * the build read them together with the environment a build there is keyed on.
 * Directories within ttsc's installed package, including its overlays and the
 * fallback linked-plugin host, are keyed but omitted from this report under the
 * installed-package/version ownership policy. That policy does not prove the
 * installation cannot be edited in place. Descriptor completeness relies on the
 * runtime recorder's status and the descriptor's explicit external-read
 * declaration. Sequential content, metadata and physical-path observations are
 * not an atomic snapshot or detection of every omitted read.
 *
 * @param options.binary - Absolute path to the ttsc native helper binary.
 * @param options.cacheDir - Override the plugin binary cache directory.
 * @param options.cwd - Working directory for resolving relative paths.
 * @param options.entries - Explicit plugin entries; `false` disables all
 *   plugins (skips both tsconfig entries and package auto-discovery).
 * @param options.env - Effective environment for source-plugin builds and
 *   isolated descriptor evaluators, including the `ttsx` fallback, merged with
 *   native environment-name identity. Defaults to `process.env` for CLI
 *   callers, so ambient behavior is unchanged.
 * @param options.file - Path to the tsconfig/jsconfig file.
 * @param options.pluginConfigDir - Caller-declared anchor for plugin
 *   config-file discovery (see `ITtscPluginFactoryContext.pluginConfigDir`).
 * @param options.projectRoot - Override the project root directory.
 * @param options.tsconfig - Alias for `file`.
 * @evidence contracts/common.md#principled-implementation The loader brackets project discovery observations, evaluates descriptors in isolated processes and validates declarations before publishing conservative source repair interests. Metadata refusal remains terminal; valid records narrow watch interests before final admission/build, while contradictory content or physical observations are omitted from proof rather than retroactively blessed.
 * @evidence contracts/common.md#clear-and-simple-design The operation owns one ordered load generation; private helpers separate discovery, evaluation, validation, composition and proof merging, while package resolution and source building remain their own modules.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Descriptor module caches are isolated rather than deleting application singletons. ttsx retry occurs only for explicit supported TypeScript loader incompatibility, with plugins disabled to avoid recursive self-hosting; arbitrary descriptor failures are not retried into false success.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains result provenance, environment and path options; helper comments explain input races, conservative proof omission, fallback authority and cleanup. Member/tag spacing and separated concepts follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path/file-URL conversion, createRequire and hidden spawn with explicit argv/environment implement OS-neutral selection and process execution. Physical identities are preserved separately from lexical candidates; Bun-specific differences are capability decisions, not OS guesses.
 * @evidence contracts/performance.md#efficient-algorithms Input merging and conflicts use Sets/maps and sorted path populations, with path/key/value byte costs. Discovery can repeat config/manifest/candidate reads and full hashes; descriptor work includes runtime probes, full observation/JSON processing and possibly synchronous evaluation. Watch-only preliminary publication can temporarily digest/watch the full admitted module as well as its package before kind is known; callbacks delegate topology reconciliation. Load-local replacement readings serve preliminary and final publication. Package selection groups equivalent module contexts and batches entries through Go list without dependency compilation; per-load selected-tool manifest readers share overlay readings. Builds delegate source/environment hashing, copying, cold materialized ownership admission and Go execution; per-load digest maps share selected work. Composition can be quadratic in configured plugins/aliases, and native lookup/file/output bytes are not bounded by plugin count alone.
 * @evidence contracts/performance.md#reuse-equivalent-work Descriptor hits require the cache's context/environment/runtime/version identity and matching recorded projections, subject to producer declarations and sequential-observation limits. Per-load source/environment maps share directory-keyed digests between package selection and builds, and one selected transform host serves linked contributors. Across processes, the record store opened here proves unchanged sources, toolchain and runtime from separable metadata and answers equal package selections and runtime probes (#1721, #1722, #1723); a store whose root lies inside a plugin source is withdrawn before any source is proven. These identities do not certify every undeclared read or atomic filesystem stability.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Finally restores injected environment locators, attempts evaluator directory removal and closes direct-evaluator diagnostic descriptors. Close/removal can fail; synchronous completion concerns the selected evaluator and does not certify arbitrary descendants are gone. Generation maps/results scale with observed data, and disk diagnostics/result/observation files have no independent byte ceiling here. Default disk pruning has its own interval/protection/failure policy; explicit roots remain caller-owned.
 */
export function loadProjectPlugins(options: {
  /** Absolute native ttsc helper used in descriptor factory contexts. */
  binary: string;

  /** Caller-owned cache-root override; omitted for workspace-local policy. */
  cacheDir?: string;

  /** Invocation working directory for project discovery and relative inputs. */
  cwd?: string;

  /** Replacement plugin list, false to disable, or omitted for discovery. */
  entries?: readonly ITtscProjectPluginConfig[] | false;

  /** Effective build/evaluator environment, already merged by API callers. */
  env?: NodeJS.ProcessEnv;

  /** Explicit project config, resolved from cwd. */
  file?: string;

  /**
   * Record store the caller already opened for this invocation, so its later
   * native spawns share it; the loader opens its own when omitted.
   */
  identities?: PluginContentIdentities.Store;

  /** Observe plugin build roots before building, including failed builds. */
  onWatchInputs?: (inputs: readonly string[]) => void;

  /** Caller-selected anchor for plugin-owned configuration discovery. */
  pluginConfigDir?: string;

  /** Project root override for generated config wrappers. */
  projectRoot?: string;

  /** Alias for the selected file option. */
  tsconfig?: string;
}): {
  /**
   * Whether config selection has complete observations. Module-based extends is
   * unproved; descriptor/module proof is carried separately by host inputs.
   */
  discoveryInputsComplete: boolean;

  /** Inputs only the native plugin reads, whose proof must come from it. */
  deferredHostInputs: string[];

  /**
   * Whether every descriptor reported complete runtime observations and an
   * explicit external-read declaration (`declaresHostInputReads`). This flag
   * does not discover reads omitted by that producer. Without the declaration,
   * the host inputs cannot prove the load's answer to a later launch. The
   * runtime must also explicitly complete its module observations; retained
   * partial records do not establish that declaration's input graph.
   */
  descriptorReadsDeclared: boolean;

  /** Content observations captured when host inputs influenced the load. */
  hostInputHashes: Record<string, string | null>;

  /** Physical observations captured alongside the host-input reads. */
  hostInputRealpaths: Record<string, string | null>;

  /** Reported loader inputs, including unresolved discovery candidates. */
  hostInputs: string[];

  /**
   * Negative-only descriptor observation status. It records an incomplete
   * producer channel independently of external-read declarations or dropped
   * mutation witnesses; omission makes no positive completeness claim.
   */
  observationsComplete?: false;

  /**
   * Record store this load proved its inputs through, for the invocation's
   * later native spawns (#1723); absent when the project loads no plugin.
   */
  identities?: PluginContentIdentities.Store;

  /** Check-stage entries followed by transform-stage entries in stable order. */
  nativePlugins: ITtscLoadedNativePlugin[];

  /** Plugin-provided Go directory states that the actual builds were keyed on. */
  pluginSources: Record<string, string>;

  /** Resolved project values and logical/physical configuration identity. */
  project: ITtscParsedProjectConfig;
} {
  // Snapshot the caller environment before `withPluginLoaderEnv` injects
  // host-owned Node/ttsx locators into process.env. Under a Bun parent the
  // direct descriptor evaluator must remain Bun unless the caller explicitly
  // selected another runtime.
  const effectiveEnv = SidecarEnvironment.merge(options.env ?? process.env);
  const projectSnapshot = readProjectHostInputSnapshot({
    cwd: options.cwd,
    file: options.file,
    includePluginDiscovery: options.entries === undefined,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  const { project } = projectSnapshot;
  const projectHostInputs = projectSnapshot.hostInputs;
  const projectHostInputHashes = projectSnapshot.hostInputHashes;
  const projectHostInputRealpaths = projectSnapshot.hostInputRealpaths;
  const entries: ProjectPluginEntries.ProjectPluginEntry[] =
    options.entries === false
      ? []
      : ProjectPluginEntries.resolvePluginEntries(
          project,
          options.entries,
        ).filter((entry) => entry.config.enabled !== false);
  if (entries.length === 0) {
    options.onWatchInputs?.([]);
    return {
      ...collectHostInputSnapshot(
        project,
        {},
        [],
        projectHostInputs,
        revalidateHostInputHashes(projectHostInputHashes, projectHostInputs),
        revalidateHostInputRealpaths(
          projectHostInputRealpaths,
          projectHostInputs,
        ),
      ),
      descriptorReadsDeclared: true,
      discoveryInputsComplete: project.configInputsComplete === true,
      nativePlugins: [],
      pluginSources: {},
      project,
    };
  }

  const cwd = path.resolve(options.cwd ?? process.cwd());
  const context = {
    binary: options.binary,
    cwd,
    ...(options.pluginConfigDir === undefined || options.pluginConfigDir === ""
      ? {}
      : { pluginConfigDir: path.resolve(cwd, options.pluginConfigDir) }),
    projectRoot: project.root,
    tsconfig: project.path,
  };
  // Where isolated descriptor evaluations keep their answers across launches
  // (`PluginDescriptorEvaluationCache`).
  // WARNING (#1721, #1722, #1723): a warm load must prove its unchanged inputs
  // from this store, not re-read them. Every launch is a new process, so any
  // module-level memo of this load's work dies with it; a 27 s warm typia
  // launch whose native build took 0.28 s is what that looked like.
  const identities =
    options.identities ??
    PluginContentIdentities.open({
      projectRoot: project.root,
      cacheDir: options.cacheDir,
      env: effectiveEnv,
    });
  const descriptorCache: DescriptorCacheOptions = {
    cacheDir: options.cacheDir,
    identities,
    version: pluginBuildVersions(project.root).ttsc,
  };
  const loadedEntries = withPluginLoaderEnv(
    () =>
      entries.map((entry) => {
        const specifier = entry.config.transform;
        if (typeof specifier !== "string" || specifier.length === 0) {
          throw new Error(
            `ttsc: plugin entry is missing a string "transform" field`,
          );
        }
        const entryParent = path.join(entry.baseDir, "package.json");
        const probedCandidates = collectModuleResolutionCandidates(
          specifier,
          entryParent,
          undefined,
        );
        // Capture every candidate before resolution chooses the descriptor entry.
        // A post-resolution snapshot could bless a higher-priority file created
        // after the resolver had already selected the old entry.
        const probedCandidateHashes = hashHostInputPaths(probedCandidates);
        const probedCandidateRealpaths =
          realpathHostInputPaths(probedCandidates);
        const request = PluginPackageResolution.resolvePluginRequest(
          specifier,
          entry.baseDir,
        );
        // Keep the candidates of the search roots up to the one the entry
        // resolved in: the lookup never read the roots after it
        // (`moduleResolutionBaseSelects`).
        const read = new Set(
          collectModuleResolutionCandidates(
            specifier,
            entryParent,
            request,
          ).map((candidate) => path.resolve(candidate)),
        );
        const entryCandidates = probedCandidates.filter((candidate) =>
          read.has(path.resolve(candidate)),
        );
        const entryCandidateHashes = pickHostInputEntries(
          probedCandidateHashes,
          entryCandidates,
        );
        const entryCandidateRealpaths = pickHostInputEntries(
          probedCandidateRealpaths,
          entryCandidates,
        );
        const loaded = loadPluginEntry(
          entry.config,
          { ...context, plugin: entry.config },
          request,
          effectiveEnv,
          descriptorCache,
        );
        const loadedHostInputHashes = mergeObservedHostInputHashes(
          loaded.hostInputHashes,
          hashHostInputPaths(Object.keys(loaded.hostInputHashes)),
        );
        const loadedHostInputRealpaths = mergeObservedHostInputRealpaths(
          loaded.hostInputRealpaths,
          realpathHostInputPaths(Object.keys(loaded.hostInputRealpaths)),
        );
        const hostInputHashes = mergeObservedHostInputHashes(
          entryCandidateHashes,
          loadedHostInputHashes,
        );
        const hostInputRealpaths = mergeObservedHostInputRealpaths(
          entryCandidateRealpaths,
          loadedHostInputRealpaths,
        );
        for (const input of loaded.hostInputs) {
          const absolute = path.resolve(input);
          if (
            !Object.prototype.hasOwnProperty.call(
              loadedHostInputHashes,
              absolute,
            )
          ) {
            delete hostInputHashes[absolute];
          }
        }
        return {
          ...loaded,
          hostInputHashes,
          hostInputRealpaths,
          hostInputs: [...loaded.hostInputs, ...entryCandidates],
          request,
        };
      }),
    identities,
  );
  const plugins = composePluginSources(
    entries,
    loadedEntries.map((entry) => entry.plugin),
  );

  const { ttsc: ttscVersion, tsgo: tsgoVersion } = pluginBuildVersions(
    context.projectRoot,
  );
  const candidates = plugins
    .map((plugin, index) => {
      const stage = PluginDescriptorAdmission.stage(plugin);
      validatePluginSource(plugin);
      const contributors = validatePluginContributors(plugin);
      const source = resolvePluginSource(plugin.source, context.projectRoot);
      const label = pluginLabel(plugin, entries[index]!.config, index);
      requirePluginSource(source, label);
      return { plugin, index, stage, contributors, source, label };
    })
    .map((candidate) => ({
      ...candidate,
      ...resolvePluginGoModule(candidate.source, candidate.label),
    }));
  // One reading of each source directory, shared by package selection and
  // every build below and reported as the state the binaries were keyed on.
  const sourceDigests = new Map<string, string>();
  // And one reading of the environment each build directory is keyed on, which
  // a plugin module root's state reports as it is.
  const environmentDigests = new Map<string, string>();
  // With the witness of each such reading, so a build of a directory package
  // selection already read keys on that reading instead of probing Go again.
  const environmentWitnesses = new Map<
    string,
    PluginBuildEnvironmentWitness.Record
  >();
  const readings = {
    sources: sourceDigests,
    environments: environmentDigests,
    witnesses: environmentWitnesses,
  };
  // Records describing sources must never land inside one, so the store is
  // admitted for source proofs only once every source of the load is known.
  const sourceIdentities = PluginContentIdentities.outside(identities, [
    ...candidates.flatMap((candidate) => [
      candidate.moduleRoot,
      candidate.packageDir,
      ...(candidate.contributors ?? []).map((input) => input.source),
    ]),
    ...SourcePluginWorkspace.findTtscOverlayDirs(),
  ]);
  // One fixed-effective-environment load owns manifest syntax sharing from the
  // first watch query through metadata and builds. Do not allocate this after
  // watch projection: that silently repeats selected-Go work (#1712).
  const packageReaders = new Map<string, SourcePluginWorkspace.GoModReader>();
  const watchReplacements =
    options.onWatchInputs === undefined
      ? undefined
      : new Map<string, readonly string[]>();
  if (options.onWatchInputs !== undefined) {
    // The prospective context reads the admitted module layout and anchors its
    // tool there before kind exists. Keep both possible final-root baselines:
    // a linked package keeps packageDir, and an executable keeps moduleRoot.
    const interests = new Set(
      candidates
        .flatMap((candidate) => [
          candidate.moduleRoot,
          candidate.packageDir,
          ...(candidate.contributors ?? []).map((input) => input.source),
        ])
        .filter(reportsPluginSource),
    );
    options.onWatchInputs([...interests].sort());
    const initialSize = interests.size;
    for (const candidate of candidates) {
      // Nested source-only proposals replace the outer root manifests. Do not
      // activate their irrelevant module graph just to discover watch inputs.
      if (candidate.stage === "transform" && candidate.entry !== ".") continue;
      for (const directory of pluginReplacementWatchDirectories(
        candidate.moduleRoot,
        effectiveEnv,
        watchReplacements,
        packageReaders,
      ))
        if (reportsPluginSource(directory)) interests.add(directory);
    }
    if (interests.size !== initialSize)
      options.onWatchInputs([...interests].sort());
  }
  const proposals = NativeSourcePackages.propose(
    candidates.map((candidate) => ({
      ...candidate,
      ownModule: candidate.stage !== "transform",
    })),
    effectiveEnv,
    packageReaders,
    sourceIdentities,
    readings,
  );
  const records = candidates.map(
    ({ plugin, index, stage, contributors, source, packageDir }) => {
      const { kind, moduleRoot } = resolveNativeSource(
        source,
        plugin,
        entries[index]!.config,
        index,
        {
          env: effectiveEnv,
          observation: proposals[index]!.observation,
        },
      );
      if (kind === "linked" && stage !== "transform") {
        throw new Error(
          `ttsc: plugin "${pluginLabel(plugin, entries[index]!.config, index)}" source is a linked Go package, but only transform-stage plugins can be linked into a compiler host`,
        );
      }
      const linkedContributorName =
        kind === "linked"
          ? `linked_${String(index).padStart(6, "0")}`
          : undefined;
      const hostInputs = validatePluginHostInputs(plugin, index);
      const pluginHostInputHashes = validatePluginHostInputHashes(
        plugin,
        index,
        hostInputs,
      );
      const pluginHostInputRealpaths = validatePluginHostInputRealpaths(
        plugin,
        index,
        hostInputs,
      );
      return {
        capabilities: plugin.capabilities,
        contributors,
        config: entries[index]!.config,
        kind,
        label: pluginLabel(plugin, entries[index]!.config, index),
        linkedContributorName,
        name: plugin.name,
        reportsTypeScriptDiagnostics:
          plugin.reportsTypeScriptDiagnostics === true,
        request: loadedEntries[index]!.request,
        hostInputHashes: mergePluginHostInputHashes(
          loadedEntries[index]!.hostInputHashes,
          pluginHostInputHashes,
          loadedEntries[index]!.hostInputs,
          hostInputs,
        ),
        hostInputRealpaths: mergePluginHostInputHashes(
          loadedEntries[index]!.hostInputRealpaths,
          pluginHostInputRealpaths,
          loadedEntries[index]!.hostInputs,
          hostInputs,
        ),
        hostInputs: [...loadedEntries[index]!.hostInputs, ...hostInputs],
        moduleRoot,
        packageDir,
        source,
        stage,
      };
    },
  );
  const executableCandidates = candidates.filter(
    (candidate) =>
      records[candidate.index]!.kind === "executable" &&
      !proposals[candidate.index]!.ownModule,
  );
  // Admission can now narrow the provisional interests without restamping the
  // retained package/module baselines. Final host errors still keep these roots.
  options.onWatchInputs?.(
    pluginBuildDirectories(
      records,
      effectiveEnv,
      watchReplacements,
      packageReaders,
    ),
  );
  const linkedContributors = records
    .filter((record) => record.stage === "transform")
    .flatMap((record) =>
      record.kind === "linked"
        ? [{ name: record.linkedContributorName!, source: record.source }]
        : [],
    );
  const transformHosts = records.filter(
    (record) => record.stage === "transform" && record.kind === "executable",
  );
  const hostContributors =
    linkedContributors.length === 0 ? undefined : linkedContributors;
  // Every host compiles the linked sources under its own module/tool context.
  // Equivalent entries in one module share this metadata command and reader;
  // a second executable host can select a genuinely different Go context.
  const admittedExecutables = new Set<string>();
  if (linkedContributors.length !== 0) {
    const hosts =
      transformHosts.length === 0
        ? [
            {
              source: path.join(ttscPackageRoot(), "cmd", "utility-host"),
              label: "linked-plugin-host",
            },
          ]
        : transformHosts;
    const contexts = new Map<
      string,
      { source: string; label: string; records: typeof transformHosts }
    >();
    for (const host of hosts) {
      const moduleRoot = resolvePluginGoModule(
        host.source,
        host.label,
      ).moduleRoot;
      let context = contexts.get(moduleRoot);
      if (context === undefined) {
        context = { source: host.source, label: host.label, records: [] };
        contexts.set(moduleRoot, context);
      }
    }
    for (const record of transformHosts)
      contexts.get(record.moduleRoot)!.records.push(record);
    for (const host of contexts.values()) {
      const moduleHosts = host.records;
      const hostEntries = moduleHosts.map((record) => ({
        entry: resolvePluginGoModule(record.source, record.label).entry,
      }));
      const observations = NativeSourcePackages.inspect({
        source: host.source,
        pluginName: host.label,
        env: effectiveEnv,
        readers: packageReaders,
        identities: sourceIdentities,
        readings,
        packages: [
          ...hostEntries,
          ...linkedContributors.map((input) => ({
            ...input,
            entry: `./contrib/${input.name}`,
          })),
        ],
      });
      moduleHosts.forEach((record, index) => {
        NativeSourcePackages.kind(
          observations[index]!,
          record.label,
          "executable",
        );
        admittedExecutables.add(record.source);
      });
      linkedContributors.forEach((input, index) => {
        NativeSourcePackages.kind(
          observations[hostEntries.length + index]!,
          `${input.name} inside host ${host.label}`,
          "linked",
        );
      });
    }
  }
  // A nested main proposal still needs its actual owning manifests. Hosts
  // with linked contributors were admitted together above; other equivalent
  // entries share one standalone observation, with no repeated host copy.
  const standaloneCandidates = executableCandidates.filter(
    (candidate) => !admittedExecutables.has(candidate.source),
  );
  const executablePackages = NativeSourcePackages.ownPackages(
    standaloneCandidates,
    effectiveEnv,
    packageReaders,
    sourceIdentities,
    readings,
  );
  standaloneCandidates.forEach((candidate, index) => {
    NativeSourcePackages.kind(
      executablePackages[index]!,
      candidate.label,
      "executable",
    );
  });
  const packageOwnership = (source: string, label: string, linked: boolean) => [
    {
      entry: resolvePluginGoModule(source, label).entry,
      kind: "executable" as const,
    },
    ...(linked
      ? linkedContributors.map((input) => ({
          entry: `./contrib/${input.name}`,
          kind: "linked" as const,
        }))
      : []),
  ];
  const builtTransformHosts = new Map<object, string>();
  for (const record of transformHosts) {
    builtTransformHosts.set(
      record,
      buildSourcePlugin({
        baseDir: context.projectRoot,
        cacheDir: options.cacheDir,
        contributors: mergeContributors(record.contributors, hostContributors),
        env: effectiveEnv,
        goModReaders: packageReaders,
        identities: sourceIdentities,
        pluginName: record.label,
        packageOwnership: packageOwnership(record.source, record.label, true),
        source: record.source,
        environmentDigests,
        environmentWitnesses,
        sourceDigests,
        ttscVersion,
        tsgoVersion,
      }),
    );
  }
  const fallbackDriverHost =
    transformHosts.length === 0 && linkedContributors.length !== 0
      ? buildSourcePlugin({
          baseDir: context.projectRoot,
          cacheDir: options.cacheDir,
          contributors: linkedContributors,
          env: effectiveEnv,
          goModReaders: packageReaders,
          identities: sourceIdentities,
          label: "linked plugin host",
          pluginName: "linked-plugin-host",
          source: path.join(ttscPackageRoot(), "cmd", "utility-host"),
          packageOwnership: packageOwnership(
            path.join(ttscPackageRoot(), "cmd", "utility-host"),
            "linked-plugin-host",
            true,
          ),
          environmentDigests,
          environmentWitnesses,
          sourceDigests,
          ttscVersion,
          tsgoVersion,
        })
      : undefined;
  const selectedTransformHost =
    transformHosts.length === 0
      ? fallbackDriverHost
      : builtTransformHosts.get(transformHosts[0]!);
  const nativePlugins: ITtscLoadedNativePlugin[] = records.map((record) => {
    const binary =
      record.stage === "transform" && record.kind === "linked"
        ? selectedTransformHost
        : record.stage === "transform"
          ? builtTransformHosts.get(record)
          : buildSourcePlugin({
              baseDir: context.projectRoot,
              cacheDir: options.cacheDir,
              contributors: record.contributors,
              env: effectiveEnv,
              goModReaders: packageReaders,
              identities: sourceIdentities,
              pluginName: record.label,
              packageOwnership: packageOwnership(
                record.source,
                record.label,
                false,
              ),
              source: record.source,
              environmentDigests,
              environmentWitnesses,
              sourceDigests,
              ttscVersion,
              tsgoVersion,
            });
    if (binary === undefined) {
      throw new Error(
        `ttsc: plugin "${record.label}" is a linked Go package, but no compiler host is available`,
      );
    }
    return {
      binary,
      // This fallback is compiled from our utility-host, whose actual writer
      // publishes provenance and supports a separate compiler argument cwd.
      // A separately selected executable host must opt
      // in itself; a linked library cannot certify that foreign host.
      capabilities:
        record.stage === "transform" &&
        record.kind === "linked" &&
        fallbackDriverHost !== undefined
          ? {
              ...record.capabilities,
              compilerArgsCwd: true,
              emitProvenance: true,
            }
          : record.capabilities,
      config: record.config,
      contributors: record.contributors,
      kind: record.kind,
      name: record.name,
      reportsTypeScriptDiagnostics: record.reportsTypeScriptDiagnostics,
      source: record.source,
      stage: record.stage,
    };
  });
  return {
    ...collectHostInputSnapshot(
      project,
      context,
      records,
      projectHostInputs,
      revalidateHostInputHashes(projectHostInputHashes, projectHostInputs),
      revalidateHostInputRealpaths(
        projectHostInputRealpaths,
        projectHostInputs,
      ),
    ),
    descriptorReadsDeclared: loadedEntries.every(
      (entry) =>
        entry.observationsComplete && declaresHostInputReads(entry.plugin),
    ),
    discoveryInputsComplete: project.configInputsComplete === true,
    ...(identities === undefined ? {} : { identities }),
    nativePlugins: orderNativePlugins(nativePlugins),
    ...(loadedEntries.some((entry) => !entry.observationsComplete)
      ? { observationsComplete: false as const }
      : {}),
    // The directories the watch inputs named before the builds, as the builds
    // read them.
    pluginSources: Object.fromEntries(
      [...sourceDigests]
        .filter(([directory]) => reportsPluginSource(directory))
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([directory, sourceDigest]) => [
          directory,
          pluginSourceState(directory, {
            env: effectiveEnv,
            sourceDigest,
            environment:
              environmentDigests.get(directory) ??
              pluginBuildEnvironment(
                directory,
                effectiveEnv,
                undefined,
                sourceIdentities,
              ),
          }),
        ]),
    ),
    project,
  };
}

type ProjectHostInputSnapshot = {
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
  project: ITtscParsedProjectConfig;
};

/**
 * Collect exact JavaScript-host files that universally influence the loaded
 * transform. Program files belong to the native reference graph; this list is
 * deliberately limited to config ancestry, descriptor entries, the project
 * manifest controlling auto-discovery, and explicit plugin config files.
 */
function collectHostInputSnapshot(
  project: ITtscParsedProjectConfig,
  context: { pluginConfigDir?: string },
  records: readonly {
    config: ITtscProjectPluginConfig;
    hostInputHashes: Readonly<Record<string, string | null>>;
    hostInputRealpaths: Readonly<Record<string, string | null>>;
    hostInputs: readonly string[];
    request: string;
  }[],
  baselineInputs: readonly string[],
  baselineHashes: Readonly<Record<string, string | null>>,
  baselineRealpaths: Readonly<Record<string, string | null>>,
): {
  deferredHostInputs: string[];
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
} {
  const inputs = new Set<string>(
    baselineInputs.map((file) => path.resolve(file)),
  );
  // A path consumed by any JavaScript-host stage keeps that stage's proof
  // obligation, even when another plugin merely forwards the same spelling as
  // its conventional native `configFile`. Otherwise one non-consuming record
  // could let the native result replace a missing/raced JavaScript proof for a
  // different record that really read the file.
  const consumed = new Set<string>(
    baselineInputs.map((file) => path.resolve(file)),
  );
  for (const record of records) {
    for (const hostInput of record.hostInputs) {
      consumed.add(path.resolve(hostInput));
    }
  }
  const deferred = new Set<string>();
  const configBase = context.pluginConfigDir ?? path.dirname(project.path);
  for (const record of records) {
    inputs.add(path.resolve(record.request));
    for (const hostInput of record.hostInputs) {
      inputs.add(path.resolve(hostInput));
    }
    const descriptorManifest = PluginPackageResolution.findNearestPackageJson(
      record.request,
    );
    if (descriptorManifest !== undefined) {
      inputs.add(path.resolve(descriptorManifest));
    }
    const configFile = record.config.configFile;
    if (typeof configFile === "string" && configFile.trim() !== "") {
      const absolute = path.isAbsolute(configFile)
        ? path.resolve(configFile)
        : path.resolve(configBase, configFile);
      inputs.add(absolute);
      // `configFile` is a convention forwarded to the native plugin, not a
      // file the JavaScript loader reads. Its compile-time proof must therefore
      // come back from that plugin. A descriptor that separately reports the
      // same path did consume it here and remains subject to its own proof.
      if (!consumed.has(absolute)) {
        deferred.add(absolute);
      }
    }
  }
  const hostInputs = [...inputs].sort();
  const evaluationHashes = mergeObservedHostInputHashes(
    baselineHashes,
    ...records.map((record) => record.hostInputHashes),
  );
  const evaluationRealpaths = mergeObservedHostInputRealpaths(
    baselineRealpaths,
    ...records.map((record) => record.hostInputRealpaths),
  );
  for (const record of records) {
    for (const input of record.hostInputs) {
      const absolute = path.resolve(input);
      if (
        !Object.prototype.hasOwnProperty.call(record.hostInputHashes, absolute)
      ) {
        delete evaluationHashes[absolute];
      }
      if (
        !Object.prototype.hasOwnProperty.call(
          record.hostInputRealpaths,
          absolute,
        )
      ) {
        delete evaluationRealpaths[absolute];
      }
    }
  }
  const hostInputHashes = Object.fromEntries(
    hostInputs.flatMap((file) =>
      Object.prototype.hasOwnProperty.call(evaluationHashes, file)
        ? ([[file, evaluationHashes[file]!]] as const)
        : [],
    ),
  );
  const hostInputRealpaths = Object.fromEntries(
    hostInputs.flatMap((file) =>
      Object.prototype.hasOwnProperty.call(evaluationRealpaths, file)
        ? ([[file, evaluationRealpaths[file]!]] as const)
        : [],
    ),
  );
  return {
    deferredHostInputs: [...deferred].sort(),
    hostInputHashes,
    hostInputRealpaths,
    hostInputs,
  };
}

/**
 * Read one project configuration while its complete discovery surface remains
 * unchanged. The preliminary read discovers the input set; the accepted read is
 * bracketed by equal fingerprints for that same set. A repeatedly changing
 * project is still returned so compilation can make progress, but without any
 * cache proof for the ambiguous snapshot.
 */
function readProjectHostInputSnapshot(options: {
  cwd?: string;
  file?: string;
  includePluginDiscovery: boolean;
  projectRoot?: string;
  tsconfig?: string;
}): ProjectHostInputSnapshot {
  const { includePluginDiscovery, ...projectOptions } = options;
  let project = readProjectConfig(projectOptions);
  let hostInputs = collectProjectHostInputs(project, includePluginDiscovery);
  const observedInputs = new Set(hostInputs);
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = hashHostInputPaths(hostInputs);
    const beforeRealpaths = realpathHostInputPaths(hostInputs);
    const beforeSignatures = hostInputMetadataSignatures(hostInputs);
    const candidateProject = readProjectConfig(projectOptions);
    const candidateInputs = collectProjectHostInputs(
      candidateProject,
      includePluginDiscovery,
    );
    for (const input of candidateInputs) observedInputs.add(input);
    const after = hashHostInputPaths(candidateInputs);
    const afterRealpaths = realpathHostInputPaths(candidateInputs);
    const afterSignatures = hostInputMetadataSignatures(candidateInputs);
    if (
      equalHostInputLists(hostInputs, candidateInputs) &&
      equalHostInputHashes(before, after) &&
      equalHostInputHashes(beforeRealpaths, afterRealpaths) &&
      beforeSignatures !== undefined &&
      afterSignatures !== undefined &&
      equalHostInputHashes(beforeSignatures, afterSignatures)
    ) {
      return {
        hostInputHashes: after,
        hostInputRealpaths: afterRealpaths,
        hostInputs: candidateInputs,
        project: candidateProject,
      };
    }
    project = candidateProject;
    hostInputs = candidateInputs;
  }
  return {
    hostInputHashes: {},
    hostInputRealpaths: {},
    hostInputs: [...observedInputs].sort(),
    project,
  };
}

function equalHostInputLists(
  first: readonly string[],
  second: readonly string[],
): boolean {
  return (
    first.length === second.length &&
    first.every(
      (file, index) => path.resolve(file) === path.resolve(second[index]!),
    )
  );
}

function equalHostInputHashes(
  first: Readonly<Record<string, string | null>>,
  second: Readonly<Record<string, string | null>>,
): boolean {
  const files = Object.keys(first);
  return (
    files.length === Object.keys(second).length &&
    files.every(
      (file) =>
        Object.prototype.hasOwnProperty.call(second, file) &&
        first[file] === second[file],
    )
  );
}

/** Retain proof only for inputs whose initial and final observations agree. */
function revalidateHostInputHashes(
  initial: Readonly<Record<string, string | null>>,
  inputs: readonly string[],
): Record<string, string | null> {
  const current = hashHostInputPaths(inputs);
  const output: Record<string, string | null> = {};
  for (const input of inputs) {
    const absolute = path.resolve(input);
    if (
      Object.prototype.hasOwnProperty.call(initial, absolute) &&
      initial[absolute] === current[absolute]
    ) {
      output[absolute] = current[absolute]!;
    }
  }
  return output;
}

/** Keep physical-identity proof only while the same path resolves identically. */
function revalidateHostInputRealpaths(
  initial: Readonly<Record<string, string | null>>,
  inputs: readonly string[],
): Record<string, string | null> {
  const current = realpathHostInputPaths(inputs);
  return Object.fromEntries(
    inputs.flatMap((input) => {
      const absolute = path.resolve(input);
      return Object.prototype.hasOwnProperty.call(initial, absolute) &&
        initial[absolute] === current[absolute]
        ? ([[absolute, current[absolute]!]] as const)
        : [];
    }),
  );
}

/**
 * Metadata identity that survives content-preserving reads but exposes A-B-A
 * replacement. Missing paths are tied to the nearest existing ancestor whose
 * directory metadata changes when the missing branch appears or disappears.
 */
function hostInputMetadataSignature(file: string): string | undefined {
  const requested = path.resolve(file);
  let current = requested;
  for (;;) {
    try {
      const link = fs.lstatSync(current, { bigint: true });
      let target = link;
      if (link.isSymbolicLink()) {
        try {
          target = fs.statSync(current, { bigint: true });
        } catch {
          // A broken link's own metadata cannot expose its target appearing
          // and disappearing during evaluation. Decline cache proof instead.
          return undefined;
        }
      }
      return [
        path.relative(current, requested),
        link.dev,
        link.ino,
        link.mode,
        link.size,
        link.mtimeNs,
        link.ctimeNs,
        target.dev,
        target.ino,
        target.mode,
        target.size,
        target.mtimeNs,
        target.ctimeNs,
      ].join(":");
    } catch (error) {
      if (!isMissingPathError(error)) return undefined;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

function hostInputMetadataSignatures(
  files: readonly string[],
): Record<string, string> | undefined {
  const output: Record<string, string> = {};
  for (const file of files) {
    const signature = hostInputMetadataSignature(file);
    if (signature === undefined) return undefined;
    output[path.resolve(file)] = signature;
  }
  return output;
}

function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

// The direct evaluator preloads ttsx's supported Node hook, whose
// extensionless rescue order includes TypeScript and ESM/CJS spellings in
// addition to Node's ordinary CommonJS probes.
const MODULE_PROBE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".node",
] as const;

/** Record every file whose later appearance can change one module resolution. */
function collectModuleResolutionCandidates(
  specifier: string,
  parentFile: string,
  resolvedFile: string | undefined,
): string[] {
  const inputs = new Set<string>();
  const recordedBases = new Set<string>();
  const candidates = (base: string): string[] => [
    base,
    ...MODULE_PROBE_EXTENSIONS.map((extension) => base + extension),
    path.join(base, "package.json"),
    ...MODULE_PROBE_EXTENSIONS.map((extension) =>
      path.join(base, `index${extension}`),
    ),
  ];
  const recordManifestTargets = (
    value: unknown,
    directory: string,
    allowBare: boolean = false,
  ): void => {
    if (typeof value === "string") {
      if (
        value !== "" &&
        (allowBare || value.startsWith("./") || value.startsWith("../"))
      ) {
        recordBase(path.resolve(directory, value));
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        recordManifestTargets(item, directory, allowBare);
      }
      return;
    }
    if (PluginPackageResolution.isRecord(value)) {
      for (const item of Object.values(value)) {
        recordManifestTargets(item, directory, allowBare);
      }
    }
  };
  const recordBase = (base: string): void => {
    const resolvedBase = path.resolve(base);
    if (recordedBases.has(resolvedBase)) return;
    recordedBases.add(resolvedBase);
    for (const candidate of candidates(resolvedBase)) {
      inputs.add(path.resolve(candidate));
    }
    try {
      const manifest = readJsonFile(path.join(resolvedBase, "package.json"));
      if (PluginPackageResolution.isRecord(manifest)) {
        recordManifestTargets(manifest.exports, resolvedBase);
        recordManifestTargets(manifest.module, resolvedBase, true);
        recordManifestTargets(manifest.main, resolvedBase, true);
      }
    } catch {
      // A malformed selected manifest is reported by normal resolution/load.
    }
  };
  const localBases = (): string[] => {
    if (specifier.startsWith("file:")) return [fileURLToPath(specifier)];
    const directory = path.dirname(parentFile);
    const raw = path.resolve(directory, specifier);
    const suffixStart = specifier.search(/[?#]/);
    if (suffixStart === -1) return [raw];
    const pathname = specifier.slice(0, suffixStart);
    return pathname === ""
      ? [raw]
      : [...new Set([raw, path.resolve(directory, pathname)])];
  };

  if (
    specifier.startsWith(".") ||
    path.isAbsolute(specifier) ||
    specifier.startsWith("file:")
  ) {
    try {
      for (const base of localBases()) {
        // An existing exact file wins before extension and directory probes.
        // Its own recorded identity is therefore sufficient; siblings cannot
        // supersede it while it exists.
        if (
          selectedByExactFile(base, resolvedFile) ||
          (resolvedFile === undefined &&
            PluginPackageResolution.existingFile(base))
        ) {
          inputs.add(path.resolve(base));
        } else {
          recordBase(base);
        }
      }
    } catch {
      // Invalid URL spellings are diagnosed by the real resolver.
    }
    return [...inputs];
  }
  // A `#` specifier is looked up in the importer's own package `imports`, whose
  // manifest is recorded with the importer. When that maps it to a bare
  // package, the package's candidates up to the root that selected it are
  // inputs.
  if (specifier.startsWith("#")) {
    visitImportMappedCandidates(
      parentFile,
      resolvedFile,
      MODULE_PROBE_EXTENSIONS,
      undefined,
      (file) => inputs.add(path.resolve(file)),
    );
    return [...inputs];
  }
  const parts = specifier.split("/");
  const packageParts = parts[0]?.startsWith("@")
    ? parts.slice(0, 2)
    : parts.slice(0, 1);
  if (packageParts.some((part) => part === undefined || part === "")) {
    return [...inputs];
  }
  const packageName = packageParts.join("/");
  const subpath = parts.slice(packageParts.length);
  const searchPaths = createRequire(parentFile).resolve.paths(specifier) ?? [];
  for (const searchPath of searchPaths) {
    const packageDirectory = path.join(searchPath, packageName);
    recordBase(packageDirectory);
    if (subpath.length !== 0) {
      recordBase(path.join(packageDirectory, ...subpath));
    }
    if (
      moduleResolutionBaseSelects(
        packageDirectory,
        resolvedFile,
        MODULE_PROBE_EXTENSIONS,
      )
    )
      break;
  }
  return [...inputs];
}

function selectedByExactFile(
  candidate: string,
  selected: string | undefined,
): boolean {
  if (selected === undefined) return false;
  try {
    return (
      fs.realpathSync.native(candidate) === fs.realpathSync.native(selected)
    );
  } catch {
    return path.resolve(candidate) === path.resolve(selected);
  }
}

function orderNativePlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): ITtscLoadedNativePlugin[] {
  return [
    ...plugins.filter((plugin) => plugin.stage === "check"),
    ...plugins.filter((plugin) => plugin.stage === "transform"),
  ];
}

function loadPluginEntry(
  entry: ITtscProjectPluginConfig,
  base: Omit<ITtscPluginFactoryContext, "dirname" | "filename">,
  request: string,
  effectiveEnv: NodeJS.ProcessEnv,
  descriptorCache: DescriptorCacheOptions,
): {
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
  observationsComplete: boolean;
  plugin: ITtscPlugin;
} {
  const specifier = entry.transform;
  if (typeof specifier !== "string" || specifier.length === 0) {
    throw new Error(`ttsc: plugin entry is missing a string "transform" field`);
  }

  // `dirname`/`filename` are per-entry: each plugin entry resolves to its own
  // descriptor module, so they are derived here from the resolved `request`
  // rather than carried on the shared base context. They give factories a
  // load-mode-independent stand-in for `__dirname`/`__filename`, which are
  // normally absent from an ESM descriptor's own module scope.
  const context: ITtscPluginFactoryContext = {
    ...base,
    dirname: path.dirname(request),
    filename: request,
  };
  const loaded = loadPluginDescriptor(
    request,
    context,
    effectiveEnv,
    descriptorCache,
  );
  const plugin = PluginDescriptorAdmission.descriptor(
    loaded.descriptor,
    specifier,
  );
  rejectJsTransformFunctions(specifier, plugin);
  return {
    hostInputHashes: loaded.hostInputHashes,
    hostInputRealpaths: loaded.hostInputRealpaths,
    hostInputs: loaded.inputs,
    observationsComplete: loaded.observationsComplete,
    plugin,
  };
}

/**
 * Require a plugin descriptor entry, falling back to `ttsx` when Node cannot
 * load a `.ts` source entry directly.
 *
 * A descriptor entry that is `.ts` source — especially a package root that
 * re-exports a runtime alongside the descriptor — fails Node's loader on its
 * first extensionless import or un-stripped type, and its imports can fan out
 * into a whole transitive graph of source packages. Rather than reimplement
 * that graph build, run the entry through `ttsx`, which already builds each
 * `.ts` dependency on demand. The run is forced plugins-off across the whole
 * graph (`--no-plugins` for the entry, `TTSC_PLUGIN_DESCRIPTOR_LOAD` for every
 * dependency), so the descriptor's own — possibly self-hosting — transform
 * never runs and cannot deadlock. A package that loads directly (a compiled
 * descriptor, or Bun's native `.ts`) never reaches the fallback.
 */
function loadPluginDescriptor(
  request: string,
  context: ITtscPluginFactoryContext,
  effectiveEnv: NodeJS.ProcessEnv,
  descriptorCache: DescriptorCacheOptions,
): IsolatedPluginDescriptor {
  try {
    return loadCommonJsDescriptor(
      request,
      context,
      effectiveEnv,
      descriptorCache,
    );
  } catch (error) {
    if (
      !TS_SOURCE_PATTERN.test(request) ||
      !(error instanceof CommonJsDescriptorLoadError) ||
      !error.retryWithTtsx
    ) {
      throw error;
    }
    const loaded = loadDescriptorViaTtsx(
      request,
      context,
      effectiveEnv,
      descriptorCache.identities,
    );
    if (loaded === undefined) {
      throw error;
    }
    return loaded;
  }
}

/** What an isolated descriptor evaluation's cache entry is keyed under. */
interface DescriptorCacheOptions {
  /** The plugin cache directory the caller selected, if any. */
  cacheDir: string | undefined;

  /** Record store that proves the evaluating runtimes from metadata (#1723). */
  identities: PluginContentIdentities.Store | undefined;

  /** This ttsc build's version. */
  version: string;
}

interface IsolatedPluginDescriptor {
  descriptor: unknown;
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  inputs: string[];
  observationsComplete: boolean;
}

class CommonJsDescriptorLoadError extends Error {
  public constructor(
    message: string,
    public readonly retryWithTtsx: boolean,
  ) {
    super(message);
    this.name = "CommonJsDescriptorLoadError";
  }
}

/**
 * Evaluate one CommonJS descriptor in a fresh runtime module-cache generation.
 *
 * Reloading an external descriptor dependency inside this process has no safe
 * cache operation: retaining it serves stale exports, while deleting it splits
 * any application singleton that required the same module first. Isolation
 * gives every descriptor load current bytes without mutating the host's cache.
 * The child invokes the factory before walking its graph, so lazy `require()`
 * calls are included, and a failed first load cannot strand poisoned children.
 *
 * The answer of a descriptor that declares the files it reads is kept across
 * launches while every input the evaluation proved still holds
 * (`PluginDescriptorEvaluationCache`): an unchanged project pays a proof of its
 * descriptor inputs instead of a runtime start and a graph load.
 */
function loadCommonJsDescriptor(
  request: string,
  context: ITtscPluginFactoryContext,
  effectiveEnv: NodeJS.ProcessEnv,
  descriptorCache: DescriptorCacheOptions,
): IsolatedPluginDescriptor {
  const runtime = pluginDescriptorRuntimeBinary(effectiveEnv);
  const ttsx = effectiveEnv.TTSC_TTSX_BINARY ?? process.env.TTSC_TTSX_BINARY;
  const runtimeCapabilities = javascriptRuntimeCapabilities(
    runtime,
    effectiveEnv,
    context.projectRoot,
    descriptorCache.identities,
  );
  const node =
    !runtimeCapabilities.bun &&
    runtimeCapabilities.registerHooks &&
    runtimeCapabilities.executable !== undefined
      ? runtimeCapabilities.executable
      : resolveNodeBinary(
          effectiveEnv,
          context.projectRoot,
          descriptorCache.identities,
        );
  const cacheAuthority = {
    additionalRuntime: node,
    cacheDir: descriptorCache.cacheDir,
    identities: descriptorCache.identities,
    context,
    // Everything the child receives besides the per-evaluation output paths.
    env: {
      ...effectiveEnv,
      ...(node === undefined ? {} : { TTSC_NODE_BINARY: node }),
      TTSC_TTSX_BINARY: ttsx,
    },
    projectRoot: context.projectRoot,
    request,
    runtime,
    version: descriptorCache.version,
  };
  let cacheFile: string | null = null;
  try {
    // A wrapper can consult inputs before the descriptor recorder starts.
    // Only a probe that actually ran the selected executable proves the
    // runtime authority this key can represent.
    if (
      path.isAbsolute(runtime) &&
      runtimeCapabilities.executable !== undefined &&
      fs.realpathSync.native(runtime) ===
        fs.realpathSync.native(runtimeCapabilities.executable)
    )
      cacheFile = PluginDescriptorEvaluationCache.locate(cacheAuthority);
  } catch {
    // Unproved runtime identity still permits an uncached actual evaluation.
  }
  const cached =
    cacheFile === null ? null : PluginDescriptorEvaluationCache.read(cacheFile);
  if (
    cached !== null &&
    PluginDescriptorEvaluationCache.locate(cacheAuthority) === cacheFile
  )
    return cached;
  const dir = createEvaluationTempDir();
  const out = path.join(dir, "descriptor.json");
  const inputsOut = path.join(dir, "descriptor-inputs.ndjson");
  const diagnostics = path.join(dir, "descriptor.stderr");
  const bunConfig = path.join(dir, "bunfig.toml");
  // The runtime hooks recognize only this evaluator-owned output sibling.
  const shim = `${out}.cjs`;
  const runtimeHookPreload = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "launcher",
    "internal",
    "runtimeHookPreload.js",
  );
  try {
    // Node's CommonJS -e evaluator installs __filename/__dirname and other
    // CommonJS bindings on globalThis. Those globals leak into ESM descriptors
    // even when their checked output and loader format are correctly ESM.
    // A real CommonJS entry keeps the evaluator's bindings module-local.
    fs.writeFileSync(shim, COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE);
    if (runtimeCapabilities.bun) {
      // A descriptor receives exactly the environment supplied by its ttsc
      // invocation. Bun otherwise auto-loads project `.env*`, local/global
      // bunfig preloads and loaders, and may install a missing package from the
      // network. Those implicit authorities are neither part of Node's loader
      // contract nor reproducible host inputs, so isolate this evaluator from
      // them while retaining Bun's native TypeScript/module semantics.
      fs.writeFileSync(bunConfig, "", "utf8");
    }
    const diagnosticsFd = fs.openSync(diagnostics, "w");
    let result: ReturnType<typeof childProcess.spawnSync>;
    try {
      result = spawnSyncResilient(
        runtime,
        [
          ...(runtimeCapabilities.bun
            ? [
                "--no-env-file",
                "--no-install",
                `--config=${bunConfig}`,
                `--tsconfig-override=${context.tsconfig}`,
              ]
            : []),
          ...(runtimeCapabilities.registerHooks
            ? ["--require", runtimeHookPreload]
            : []),
          // NODE_OPTIONS may select a string-input type. This evaluator is a
          // .cjs file, so clear only that input-mode setting in Node's argv.
          ...(runtimeCapabilities.bun ? [] : ["--input-type", ""]),
          shim,
        ],
        {
          cwd: context.projectRoot,
          env: {
            ...effectiveEnv,
            // The direct evaluator may be Bun, but ttsx and native config
            // loaders require a real Node runtime with synchronous hooks.
            ...(node === undefined ? {} : { TTSC_NODE_BINARY: node }),
            TTSC_TTSX_BINARY: ttsx,
            TTSC_PLUGIN_CONTEXT: JSON.stringify(context),
            TTSC_PLUGIN_DESCRIPTOR_LOAD: "1",
            TTSC_PLUGIN_DESCRIPTOR_OUT: out,
            // User --import preloads run after the hooks install and before
            // the entry. Record them too; only the exact generated bootstrap
            // and its synchronous implementation imports are excluded.
            TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE: "1",
            TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT: inputsOut,
            TTSC_PLUGIN_ENTRY: request,
          },
          // Hold direct-evaluator diagnostics until its retry decision is
          // known. A successful ttsx fallback must not inherit the expected
          // loader stack from the discarded first attempt.
          stdio: ["ignore", diagnosticsFd, diagnosticsFd],
          windowsHide: true,
        },
        { stderr: diagnostics, stdout: diagnostics },
      );
    } finally {
      fs.closeSync(diagnosticsFd);
    }
    const failure = commonJsDescriptorProcessFailure(result, request);
    if (failure !== undefined) {
      const reason = pluginDescriptorFailureReason(out);
      const retryWithTtsx = commonJsDescriptorRetryWithTtsx(out);
      if (!retryWithTtsx) replayEvaluationDiagnostics(diagnostics);
      throw new CommonJsDescriptorLoadError(
        reason === "" ? failure.message : `${failure.message}\n${reason}`,
        retryWithTtsx,
      );
    }
    replayEvaluationDiagnostics(diagnostics);
    if (!fs.existsSync(out)) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" evaluation in an isolated process produced no descriptor output.`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(out, "utf8"));
    } catch (error) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" produced invalid isolated output: ${errorMessage(error)}`,
      );
    }
    if (
      !PluginPackageResolution.isRecord(parsed) ||
      !Array.isArray(parsed.inputs)
    ) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" produced an invalid isolated result`,
      );
    }
    const parsedHashes = PluginPackageResolution.isRecord(parsed.inputHashes)
      ? Object.fromEntries(
          Object.entries(parsed.inputHashes).flatMap(([file, hash]) =>
            typeof hash === "string" || hash === null
              ? [[path.resolve(file), hash]]
              : [],
          ),
        )
      : {};
    const parsedRealpaths = PluginPackageResolution.isRecord(
      parsed.inputRealpaths,
    )
      ? Object.fromEntries(
          Object.entries(parsed.inputRealpaths).flatMap(([file, realpath]) =>
            (typeof realpath === "string" && path.isAbsolute(realpath)) ||
            realpath === null
              ? [
                  [
                    path.resolve(file),
                    realpath === null ? null : path.resolve(realpath),
                  ],
                ]
              : [],
          ),
        )
      : {};
    const stableParsedRealpaths = mergeObservedHostInputRealpaths(
      parsedRealpaths,
      realpathHostInputPaths(Object.keys(parsedRealpaths)),
    );
    for (const input of parsed.inputs) {
      const absolute = path.resolve(String(input));
      if (
        !Object.prototype.hasOwnProperty.call(stableParsedRealpaths, absolute)
      ) {
        delete parsedHashes[absolute];
      }
    }
    const runtimeInputs = readTtsxDescriptorInputs(
      inputsOut,
      request,
      parsed.observation,
    );
    const evaluation: IsolatedPluginDescriptor = {
      descriptor: parsed.descriptor,
      observationsComplete: runtimeInputs.complete,
      hostInputHashes: omitUnstableHostInputHashes(
        mergeObservedHostInputHashes(
          parsedHashes,
          runtimeInputs.hostInputHashes,
        ),
        runtimeInputs.unstableInputs,
      ),
      hostInputRealpaths: mergeObservedHostInputRealpaths(
        stableParsedRealpaths,
        runtimeInputs.hostInputRealpaths,
      ),
      inputs: [
        ...new Set([
          ...parsed.inputs.map((input) => String(input)),
          ...runtimeInputs.inputs,
        ]),
      ].sort(),
    };
    // A hit replays no diagnostics, so only an evaluation with an empty
    // captured diagnostics file is kept.
    if (
      cacheFile !== null &&
      fs.statSync(diagnostics).size === 0 &&
      PluginDescriptorEvaluationCache.locate(cacheAuthority) === cacheFile
    ) {
      PluginDescriptorEvaluationCache.write(
        cacheFile,
        evaluation,
        !descriptorCache.cacheDir && !effectiveEnv.TTSC_CACHE_DIR
          ? path.dirname(path.dirname(cacheFile))
          : undefined,
      );
    }
    return evaluation;
  } finally {
    removeEvaluationTempDir(dir);
  }
}

/** Validate plugin-declared universal host inputs. */
function validatePluginHostInputs(
  plugin: ITtscPlugin,
  index: number,
): string[] {
  const label = plugin.name ?? `#${index + 1}`;
  if (plugin.hostInputs === undefined) return [];
  if (!Array.isArray(plugin.hostInputs)) {
    throw new Error(
      `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputs"; expected an array of absolute paths`,
    );
  }
  return plugin.hostInputs.map((file) => {
    if (typeof file !== "string" || !path.isAbsolute(file)) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputs" entry ${JSON.stringify(file)}; expected an absolute path`,
      );
    }
    return path.resolve(file);
  });
}

/** Validate descriptor-supplied evaluation fingerprints for host inputs. */
function validatePluginHostInputHashes(
  plugin: ITtscPlugin,
  index: number,
  hostInputs: readonly string[],
): Record<string, string | null> {
  const label = plugin.name ?? `#${index + 1}`;
  if (plugin.hostInputHashes === undefined) return {};
  if (
    !PluginPackageResolution.isRecord(plugin.hostInputHashes) ||
    Array.isArray(plugin.hostInputHashes)
  ) {
    throw new Error(
      `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputHashes"; expected an object keyed by absolute hostInputs paths`,
    );
  }
  const allowed = new Set(hostInputs.map((file) => path.resolve(file)));
  const output: Record<string, string | null> = {};
  for (const [file, hash] of Object.entries(plugin.hostInputHashes)) {
    if (!path.isAbsolute(file)) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputHashes" key ${JSON.stringify(file)}; expected an absolute path`,
      );
    }
    const absolute = path.resolve(file);
    if (!allowed.has(absolute)) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} fingerprints ${JSON.stringify(file)} without listing it in "hostInputs"`,
      );
    }
    if (
      hash !== null &&
      (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash))
    ) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} has invalid fingerprint for ${JSON.stringify(file)}; expected a lowercase SHA-256 digest or null`,
      );
    }
    output[absolute] = hash;
  }
  return output;
}

/** Validate descriptor-supplied physical identities for host inputs. */
function validatePluginHostInputRealpaths(
  plugin: ITtscPlugin,
  index: number,
  hostInputs: readonly string[],
): Record<string, string | null> {
  const label = plugin.name ?? `#${index + 1}`;
  if (plugin.hostInputRealpaths === undefined) return {};
  if (
    !PluginPackageResolution.isRecord(plugin.hostInputRealpaths) ||
    Array.isArray(plugin.hostInputRealpaths)
  ) {
    throw new Error(
      `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputRealpaths"; expected an object keyed by absolute hostInputs paths`,
    );
  }
  const allowed = new Set(hostInputs.map((file) => path.resolve(file)));
  const output: Record<string, string | null> = {};
  for (const [file, realpath] of Object.entries(plugin.hostInputRealpaths)) {
    if (!path.isAbsolute(file)) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} has invalid "hostInputRealpaths" key ${JSON.stringify(file)}; expected an absolute path`,
      );
    }
    const absolute = path.resolve(file);
    if (!allowed.has(absolute)) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} identifies ${JSON.stringify(file)} without listing it in "hostInputs"`,
      );
    }
    if (
      realpath !== null &&
      (typeof realpath !== "string" || !path.isAbsolute(realpath))
    ) {
      throw new Error(
        `ttsc: plugin ${JSON.stringify(label)} has invalid physical identity for ${JSON.stringify(file)}; expected an absolute realpath or null`,
      );
    }
    output[absolute] =
      realpath === null ? null : path.resolve(realpath as string);
  }
  return output;
}

/** Merge snapshots and omit every path observed in contradictory states. */
function mergeObservedHostInputHashes(
  ...sources: Readonly<Record<string, string | null>>[]
): Record<string, string | null> {
  const conflicts = new Set<string>();
  const output: Record<string, string | null> = {};
  for (const source of sources) {
    for (const [file, hash] of Object.entries(source)) {
      const absolute = path.resolve(file);
      if (conflicts.has(absolute)) continue;
      if (
        Object.prototype.hasOwnProperty.call(output, absolute) &&
        output[absolute] !== hash
      ) {
        delete output[absolute];
        conflicts.add(absolute);
        continue;
      }
      output[absolute] = hash;
    }
  }
  return output;
}

const mergeObservedHostInputRealpaths = mergeObservedHostInputHashes;

/** The observations of exactly `inputs`, keyed by resolved path. */
function pickHostInputEntries(
  observations: Readonly<Record<string, string | null>>,
  inputs: readonly string[],
): Record<string, string | null> {
  return Object.fromEntries(
    inputs.flatMap((input) => {
      const absolute = path.resolve(input);
      return Object.prototype.hasOwnProperty.call(observations, absolute)
        ? ([[absolute, observations[absolute]!]] as const)
        : [];
    }),
  );
}

/** Prevent a later plugin claim from reviving an unstable loader input. */
function mergePluginHostInputHashes(
  first: Readonly<Record<string, string | null>>,
  second: Readonly<Record<string, string | null>>,
  loaderInputs: readonly string[],
  pluginInputs: readonly string[],
): Record<string, string | null> {
  const output = { ...first };
  const guarded = new Set(loaderInputs.map((file) => path.resolve(file)));
  for (const input of pluginInputs) {
    const absolute = path.resolve(input);
    if (!Object.prototype.hasOwnProperty.call(second, absolute)) {
      delete output[absolute];
    }
  }
  for (const [file, hash] of Object.entries(second)) {
    const absolute = path.resolve(file);
    if (
      guarded.has(absolute) &&
      !Object.prototype.hasOwnProperty.call(first, absolute)
    ) {
      continue;
    }
    if (
      Object.prototype.hasOwnProperty.call(output, absolute) &&
      output[absolute] !== hash
    ) {
      delete output[absolute];
      continue;
    }
    output[absolute] = hash;
  }
  return output;
}

function omitUnstableHostInputHashes(
  hashes: Record<string, string | null>,
  unstableInputs: readonly string[],
): Record<string, string | null> {
  for (const input of unstableInputs) delete hashes[path.resolve(input)];
  return hashes;
}

/** Read the isolated loader's explicit retry classification. */
function commonJsDescriptorRetryWithTtsx(file: string): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return (
      PluginPackageResolution.isRecord(parsed) &&
      parsed.__ttscRetryWithTtsx === true
    );
  } catch {
    return false;
  }
}

function commonJsDescriptorProcessFailure(
  result: {
    error?: Error;
    signal: NodeJS.Signals | null;
    status: number | null;
  },
  request: string,
): Error | undefined {
  if (result.error !== undefined) {
    return new Error(
      `ttsc: failed to launch an isolated process for plugin descriptor "${request}": ${result.error.message}`,
    );
  }
  if (result.signal !== null) {
    return new Error(
      `ttsc: plugin descriptor "${request}" isolated evaluation was killed by signal ${result.signal}.`,
    );
  }
  if (result.status !== 0) {
    return new Error(
      `ttsc: plugin descriptor "${request}" isolated evaluation failed with exit code ${String(result.status)}`,
    );
  }
  return undefined;
}

const TS_SOURCE_PATTERN = /\.(?:[cm]?ts|tsx)$/i;

/**
 * Evaluate a `.ts` plugin descriptor entry in a child `ttsx` process and return
 * the descriptor it produces. A generated shim imports the entry, invokes its
 * factory with `context`, and writes the descriptor as JSON; `ttsx` runs the
 * shim with plugins disabled across the whole graph. Returns `undefined` when
 * `ttsx` is unavailable, so the caller can rethrow the original load error.
 */
function loadDescriptorViaTtsx(
  request: string,
  context: ITtscPluginFactoryContext,
  effectiveEnv: NodeJS.ProcessEnv,
  identities: PluginContentIdentities.Store | undefined,
): IsolatedPluginDescriptor | undefined {
  // Binary discovery prefers the instance environment, then the ambient
  // process.env (where `withPluginLoaderEnv` injects ttsc's own node/ttsx paths
  // just before this runs), then the running interpreter.
  const node = resolveNodeBinary(effectiveEnv, context.projectRoot, identities);
  const ttsx = effectiveEnv.TTSC_TTSX_BINARY ?? process.env.TTSC_TTSX_BINARY;
  if (node === undefined || ttsx === undefined || ttsx.length === 0) {
    return undefined;
  }
  const dir = createEvaluationTempDir();
  const out = path.join(dir, "descriptor.json");
  const inputsOut = path.join(dir, "descriptor-inputs.ndjson");
  const shim = path.join(dir, "load-descriptor.mts");
  // ttsx type-checks and builds the shim's own project, so it needs a tsconfig
  // to anchor on; a minimal one is enough (the shim is `@ts-nocheck`).
  try {
    fs.writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          skipLibCheck: true,
          target: "es2022",
        },
      }),
    );
    fs.writeFileSync(shim, PLUGIN_DESCRIPTOR_SHIM_SOURCE);
    const trace = E2ETrace.begin(
      node,
      [ttsx, "--no-plugins", shim],
      { cwd: context.projectRoot },
      "plugin-descriptor",
    );
    const result = spawnOwnedDescriptor(node, [ttsx, "--no-plugins", shim], {
      cwd: context.projectRoot,
      encoding: "utf8",
      env: {
        ...effectiveEnv,
        // Carry ttsc's own node/ttsx locators explicitly so the child (which
        // may recurse into further descriptor loads) finds them even when the
        // instance-env snapshot predates `withPluginLoaderEnv`.
        TTSC_NODE_BINARY: node,
        TTSC_TTSX_BINARY: ttsx,
        TTSC_PLUGIN_CONTEXT: JSON.stringify({
          binary: context.binary,
          cwd: context.cwd,
          dirname: context.dirname,
          filename: context.filename,
          plugin: context.plugin,
          pluginConfigDir: context.pluginConfigDir,
          projectRoot: context.projectRoot,
          tsconfig: context.tsconfig,
        }),
        TTSC_PLUGIN_DESCRIPTOR_LOAD: "1",
        TTSC_PLUGIN_DESCRIPTOR_OUT: out,
        // The generated shim arms its own descriptor observation only after
        // its bootstrap imports have completed, even under an armed caller.
        TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE: "0",
        TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT: inputsOut,
        TTSC_PLUGIN_ENTRY: request,
      },
      // Both child streams are human output, and they go straight to this
      // process's stderr as they are written. The descriptor itself travels
      // through a file, so nothing here needs collecting, and streaming the
      // human output needs no output ceiling.
      stdio: ["ignore", 2, 2],
      windowsHide: true,
    });
    E2ETrace.result(trace, result);
    const processFailure = pluginDescriptorProcessFailure(result, request);
    if (processFailure) {
      // The descriptor's stack already reached the user's stderr as it ran.
      // What it could not put there is a reason a caller can act on, so that
      // arrives through the result file instead.
      const reason = pluginDescriptorFailureReason(out);
      throw reason === ""
        ? processFailure
        : new Error(`${processFailure.message}
${reason}`);
    }
    if (!fs.existsSync(out)) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" evaluation through ttsx produced no descriptor output.`,
      );
    }
    const text = fs.readFileSync(out, "utf8");
    try {
      const parsed: unknown = JSON.parse(text);
      if (!PluginPackageResolution.isRecord(parsed)) {
        throw new Error("isolated output must contain a descriptor envelope");
      }
      const inputSnapshot = readTtsxDescriptorInputs(
        inputsOut,
        request,
        parsed.observation,
      );
      return {
        descriptor: parsed.descriptor,
        observationsComplete: inputSnapshot.complete,
        hostInputHashes: omitUnstableHostInputHashes(
          inputSnapshot.hostInputHashes,
          inputSnapshot.unstableInputs,
        ),
        hostInputRealpaths: inputSnapshot.hostInputRealpaths,
        inputs: inputSnapshot.inputs,
      };
    } catch (error) {
      throw new Error(
        `ttsc: plugin descriptor "${request}" produced invalid JSON: ${errorMessage(error)}`,
      );
    }
  } finally {
    removeEvaluationTempDir(dir);
  }
}

interface TtsxDescriptorResolutionRecord {
  hash?: string | null;
  parent?: string;
  realpath?: string | null;
  resolved?: string;
  signature?: string;
  specifier?: string;
  unstable?: boolean;
}

/**
 * Expand the ttsx runtime's selected module edges into the same exact and
 * missing resolution inputs used by the direct isolated evaluator.
 *
 * The final owned snapshot transfers status independently of the optional
 * NDJSON channel. Records on disk can supplement it, but cannot turn an absent
 * or failed completion proof into a reusable evaluation. Malformed channel data
 * likewise refuses completeness without losing the descriptor.
 */
function readTtsxDescriptorInputs(
  file: string,
  request: string,
  observation: unknown,
): {
  complete: boolean;
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  inputs: string[];
  unstableInputs: string[];
} {
  const inputs = new Set<string>([path.resolve(request)]);
  const hashes = new Map<string, string | null>();
  const realpaths = new Map<string, string | null>();
  const signatures = new Map<string, string>();
  const unstableInputs = new Set<string>();
  let complete = false;
  let text = "";
  if (
    PluginPackageResolution.isRecord(observation) &&
    Array.isArray(observation.lines) &&
    observation.lines.every((line: unknown) => typeof line === "string")
  ) {
    complete = observation.complete === true;
    text = observation.lines.join("");
  }
  try {
    text += fs.readFileSync(file, "utf8");
  } catch {
    // The directly serialized observation copy remains authoritative when
    // no side-channel file was produced. A missing completion copy is never
    // repaired by whichever partial lines happen to remain on disk.
  }
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let record: TtsxDescriptorResolutionRecord;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!PluginPackageResolution.isRecord(parsed) || Array.isArray(parsed)) {
        complete = false;
        continue;
      }
      record = parsed;
    } catch {
      complete = false;
      continue;
    }
    if (typeof record.resolved === "string") {
      const resolved = path.resolve(record.resolved);
      inputs.add(resolved);
      if (record.unstable === true) {
        hashes.delete(resolved);
        realpaths.delete(resolved);
        signatures.delete(resolved);
        unstableInputs.add(resolved);
        continue;
      }
      if (
        typeof record.signature !== "string" ||
        (signatures.has(resolved) &&
          signatures.get(resolved) !== record.signature)
      ) {
        E2ETrace.capabilityResolution(
          "plugin-descriptor-input-signature-moved",
          {
            resolved,
            first: signatures.get(resolved),
            later:
              typeof record.signature === "string" ? record.signature : null,
          },
        );
        hashes.delete(resolved);
        realpaths.delete(resolved);
        signatures.delete(resolved);
        unstableInputs.add(resolved);
        continue;
      }
      signatures.set(resolved, record.signature);
      if (
        (typeof record.realpath === "string" &&
          path.isAbsolute(record.realpath)) ||
        record.realpath === null
      ) {
        const observed =
          record.realpath === null ? null : path.resolve(record.realpath);
        if (realpaths.has(resolved) && realpaths.get(resolved) !== observed) {
          hashes.delete(resolved);
          realpaths.delete(resolved);
          signatures.delete(resolved);
          unstableInputs.add(resolved);
          continue;
        }
        realpaths.set(resolved, observed);
      }
      if (typeof record.hash === "string" || record.hash === null) {
        if (unstableInputs.has(resolved)) {
          // Keep a previously observed contradiction unstable.
        } else if (
          hashes.has(resolved) &&
          hashes.get(resolved) !== record.hash
        ) {
          hashes.delete(resolved);
          realpaths.delete(resolved);
          signatures.delete(resolved);
          unstableInputs.add(resolved);
        } else {
          hashes.set(resolved, record.hash);
        }
      }
    }
    if (
      typeof record.specifier === "string" &&
      typeof record.parent === "string"
    ) {
      for (const candidate of collectModuleResolutionCandidates(
        record.specifier,
        record.parent,
        record.resolved,
      )) {
        inputs.add(path.resolve(candidate));
      }
    }
  }
  for (const [resolved, observed] of realpaths) {
    if (
      realpathHostInput(resolved) === observed &&
      signatures.get(resolved) === hostInputMetadataSignature(resolved)
    ) {
      continue;
    }
    hashes.delete(resolved);
    realpaths.delete(resolved);
    signatures.delete(resolved);
    unstableInputs.add(resolved);
  }
  return {
    complete,
    hostInputHashes: Object.fromEntries(hashes),
    hostInputRealpaths: Object.fromEntries(realpaths),
    inputs: [...inputs].sort(),
    unstableInputs: [...unstableInputs],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withPluginLoaderEnv<T>(
  run: () => T,
  identities: PluginContentIdentities.Store | undefined,
): T {
  const previousNode = process.env.TTSC_NODE_BINARY;
  const previousTtsx = process.env.TTSC_TTSX_BINARY;
  const node = resolveNodeBinary({}, process.cwd(), identities);
  if (process.env.TTSC_NODE_BINARY === undefined && node !== undefined) {
    process.env.TTSC_NODE_BINARY = node;
  }
  process.env.TTSC_TTSX_BINARY ??= path.join(
    __dirname,
    "..",
    "..",
    "..",
    "launcher",
    "ttsx.js",
  );
  try {
    return run();
  } finally {
    restoreEnv("TTSC_NODE_BINARY", previousNode);
    restoreEnv("TTSC_TTSX_BINARY", previousTtsx);
  }
}

/**
 * Select the executable for isolated descriptor evaluation.
 *
 * Under Bun, `process.execPath` names Bun itself. Bun implements enough of the
 * Node module surface to evaluate descriptors natively, but not Node's
 * synchronous `module.registerHooks` preload. The caller therefore recognizes
 * this default and omits the Node-only preload while retaining the fresh
 * process boundary. An explicitly configured Node executable remains
 * authoritative and receives the preload as usual.
 */
function pluginDescriptorRuntimeBinary(env: NodeJS.ProcessEnv): string {
  if (
    env.TTSC_NODE_BINARY === undefined &&
    typeof (process.versions as Record<string, string | undefined>).bun ===
      "string"
  ) {
    return process.execPath;
  }
  return (
    env.TTSC_NODE_BINARY ?? process.env.TTSC_NODE_BINARY ?? process.execPath
  );
}

/** Replay a child's human output without imposing a fixed output ceiling. */
function replayEvaluationDiagnostics(file: string): void {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, "r");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    for (;;) {
      const length = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (length === 0) break;
      fs.writeSync(2, buffer, 0, length);
    }
  } catch {
    // Diagnostic replay must never replace the descriptor result.
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function restoreEnv(
  key: "TTSC_NODE_BINARY" | "TTSC_TTSX_BINARY",
  value: string | undefined,
): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function resolvePluginSource(source: string, projectRoot: string): string {
  return PluginPackageResolution.resolveRealPath(
    path.isAbsolute(source) ? source : path.resolve(projectRoot, source),
  );
}

/**
 * The directories the plugin builds of one load key their binaries on, which a
 * watch session observes: the module root of every plugin built as an
 * executable, since the build copies and keys the whole module
 * (`computeCacheKey`), the source of every plugin linked into a host, and every
 * contributor's source, which a host build keys as it is. They are the
 * directories the load then reports as `pluginSources`, resolved before any
 * build runs, and ttsc's own sources are left out of both. An executable
 * plugin's module also names, through its `go.mod`, every directory outside it
 * that it replaces a module with, which the build compiles in place
 * (`pluginModuleReplaceDirectories`).
 */
function pluginBuildDirectories(
  records: readonly {
    contributors?: readonly { source: string }[];
    kind: "executable" | "linked";
    moduleRoot: string;
    packageDir: string;
  }[],
  env: NodeJS.ProcessEnv,
  replacements?: Map<string, readonly string[]>,
  readers?: Map<string, SourcePluginWorkspace.GoModReader>,
): string[] {
  const directories = new Set<string>();
  for (const record of records) {
    directories.add(
      path.resolve(
        record.kind === "linked" ? record.packageDir : record.moduleRoot,
      ),
    );
    if (record.kind === "executable") {
      for (const directory of pluginReplacementWatchDirectories(
        record.moduleRoot,
        env,
        replacements,
        readers,
      ))
        directories.add(directory);
    }
    for (const contributor of record.contributors ?? [])
      directories.add(path.resolve(contributor.source));
  }
  return [...directories].filter(reportsPluginSource).sort();
}

/**
 * Discover known external replacement interests after the module is observed.
 * The load shares this best-effort watch projection, not package validity or a
 * cross-load manifest cache. Go metadata/build admission still owns errors.
 */
function pluginReplacementWatchDirectories(
  moduleRoot: string,
  env: NodeJS.ProcessEnv,
  observed?: Map<string, readonly string[]>,
  readers?: Map<string, SourcePluginWorkspace.GoModReader>,
): readonly string[] {
  const previous = observed?.get(moduleRoot);
  if (previous !== undefined) return previous;
  let directories: readonly string[];
  try {
    directories = pluginModuleReplaceDirectories(
      moduleRoot,
      env,
      undefined,
      undefined,
      readers,
    ).map((replacement) => replacement.directory);
  } catch {
    // An unreadable manifest/tool is not valid metadata. The already observed
    // module retains its repair path; actual proposal/build refusal propagates.
    directories = [];
  }
  observed?.set(moduleRoot, directories);
  return directories;
}

/**
 * Whether a directory a plugin build keys on is reported, as a watch input and
 * among `pluginSources`. ttsc's own sources change only with ttsc, whose
 * version its consumer already runs; reporting them would have every consumer
 * read and watch the whole installed package as if it were a plugin's.
 */
function reportsPluginSource(directory: string): boolean {
  return !isPathWithin(directory, ttscPackageRoot());
}

function mergeContributors(
  first: readonly ITtscPluginContributor[] | undefined,
  second: readonly ITtscPluginContributor[] | undefined,
): readonly ITtscPluginContributor[] | undefined {
  const out = [...(first ?? []), ...(second ?? [])];
  return out.length === 0 ? undefined : out;
}

function ttscPackageRoot(): string {
  return path.resolve(__dirname, "..", "..", "..", "..");
}

/**
 * Create an evaluator directory whose cleanup path cannot follow a retargeted
 * parent alias.
 */
function createEvaluationTempDir(): string {
  return createCanonicalTempDirectory("ttsc-plugin-descriptor-");
}

/**
 * Remove an evaluation temp directory without letting cleanup replace a result.
 *
 * This runs from a `finally`, so a throw here would surface instead of the
 * evaluation's own outcome — and on Windows a grandchild that inherited a
 * handle, or a scanner holding the file, can make removal fail. Leaving bytes
 * in the system temp directory is by far the lesser outcome.
 */
function removeEvaluationTempDir(directory: string): void {
  try {
    fs.rmSync(directory, { force: true, recursive: true });
  } catch {
    // Best effort.
  }
}

/**
 * Delegate an owned resolver's descriptor process without changing ordinary
 * callers.
 */
function spawnOwnedDescriptor(
  command: string,
  args: readonly string[],
  options: childProcess.SpawnSyncOptionsWithStringEncoding,
): childProcess.SpawnSyncReturns<string> {
  return (
    OwnedSynchronousProcess.launch<string>(command, args, options) ??
    childProcess.spawnSync(command, args, options)
  );
}
