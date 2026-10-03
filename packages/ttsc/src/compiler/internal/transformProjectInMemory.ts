import path from "node:path";

import { resolveNodeBinary } from "../../internal/resolveNodeBinary";
import { collectProjectHostInputs } from "../../plugin/internal/load/collectProjectHostInputs";
import { hashHostInputPaths } from "../../plugin/internal/load/hashHostInputPaths";
import { loadProjectPlugins } from "../../plugin/internal/load/loadProjectPlugins";
import { realpathHostInputPaths } from "../../plugin/internal/load/realpathHostInputPaths";
import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { ITtscCompilerTransformation } from "../../structures/ITtscCompilerTransformation";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import { appendBuildOutput } from "./build/appendBuildOutput";
import { normalizeBuildOutput } from "./build/normalizeBuildOutput";
import { buildNativeCompiler } from "./buildNativeCompiler";
import { outputText } from "./outputText";
import { packageRootDir } from "./packageRootDir";
import { parseNativeTransformOutput } from "./parseNativeTransformOutput";
import { createNativeProjectContextArgs } from "./project/createNativeProjectContextArgs";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";
import { runNativeCheckWithObservations } from "./runNativeCheckWithObservations";
import { SidecarEnvironment } from "./sharedHost/SidecarEnvironment";
import { assertSharedHostCompatibility } from "./sharedHost/assertSharedHostCompatibility";
import { clearInheritedSemanticConfigPath } from "./sharedHost/clearInheritedSemanticConfigPath";
import { clearInheritedTsgoArgs } from "./sharedHost/clearInheritedTsgoArgs";
import { inheritedSidecarEnv } from "./sharedHost/inheritedSidecarEnv";
import { linkedTransformPlugins } from "./sharedHost/linkedTransformPlugins";
import { publishLinkedTransformPlugins } from "./sharedHost/publishLinkedTransformPlugins";
import { resolvePluginConfigDir } from "./sharedHost/resolvePluginConfigDir";
import { selectSharedHostPlugin } from "./sharedHost/selectSharedHostPlugin";
import { spawnNative } from "./spawnNative";

/**
 * Transform a project and capture TypeScript source output in memory.
 *
 * When no plugins are configured the native path spawns the native ttsc compiler
 * host (`cmd/ttsc api-transform`) which returns a JSON map of transformed
 * TypeScript sources. When plugins are present:
 *
 * 1. Check-stage plugins run first and stop on a nonzero accumulated status.
 * 2. If there are no transform-stage plugins the host is used as the transformer.
 * 3. If transform plugins exist they are dispatched through the shared-host binary
 *    with linked plugins passed via `TTSC_LINKED_PLUGINS_JSON`.
 *
 * Explicit unavailable-observation reports survive every lane so consumers can
 * use a fresh successful result while withholding reuse. They cannot excuse a
 * content or physical witness that changed or conflicted across stages.
 * Opted-in checks supply their same-generation observations through a private
 * sidecar on failure as well as success. A later transform cannot restore a
 * check's rejected proof or replace it with an unavailable-input exemption.
 * Other check hosts retain their existing descriptor and declared-input
 * observation contract rather than inheriting the driver's protocol.
 *
 * @returns A `{ result, typescript }` pair where `typescript` maps output paths
 *   to their transformed TypeScript source text, and `pluginSources` the state
 *   of every Go source directory the plugins supplied to their binaries.
 *
 * @evidence contracts/common.md#principled-implementation Discovery and check/transform stages use their owning native binaries; evaluation-time witnesses are revalidated, explicit observation limits survive every lane, and changed or conflicting proven inputs lose their unavailable exemption rather than gaining admission.
 * @evidence contracts/common.md#clear-and-simple-design One router composes built-in and plugin-backed transforms; envelope parsers, environment construction, proof merging and negative-only observation limits have separate shared helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing input proof cannot be repaired by a postcompile baseline; conventional deferred config reads accept only the actual native consumer's proof, while malformed required TypeScript output is a protocol error.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe transform lanes and stage ordering; separated result members distinguish output, advisory graph/dependency data, evaluation witnesses and unstable source markers under documentation guidance.
 * @evidence contracts/performance.md#efficient-algorithms Stage filtering, declared-input Sets and proof maps scale with plugin/input counts; merged paths are sorted with path-text comparison costs. Each stage can rehash/re-realpath declared inputs, serialize plugin/config records and parse complete output; discovery, native capability probes, source builds and child execution remain delegated costs of this call. No byte/work ceiling or measured dominant-cost ranking is asserted.
 * @evidence contracts/performance.md#reuse-equivalent-work Source-plugin artifacts are shared by their owning loader; this transform intentionally produces a current generation and gives downstream consumers the graph, source states and host witnesses required to qualify reuse.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources This router retains discovery records, per-stage proof maps and accumulated diagnostics/output until synchronous stage completion, then transfers the returned envelope. Native capture/observation owners attempt their own cleanup; suppressed cleanup failures and descendant release remain unconfirmed where those owners do not join them. Artifact-cache retention belongs to the builder, and no stage timeout or input/output byte ceiling is supplied here.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Native paths remain filesystem coordinates, child argv are arrays, and environment helpers preserve Windows key equivalence and explicit Node/tsgo/config anchors without shell parsing or native method patching.
 */
export function transformProjectInMemory(options: ITtscCompilerContext): {
  /** Optional plugin-reported per-file dependencies used as advisory inputs. */
  dependencies?: Record<string, string[]>;

  /** Files for which the producer declares dependency reporting complete. */
  dependenciesComplete?: string[];

  /** Compiler reference graph with its independently recorded input proof. */
  graph?: ITtscCompilerTransformation.IReferenceGraph;

  /** Evaluation-time raw-content or unavailable-state host witnesses. */
  hostInputHashes?: Record<string, string | null>;

  /** Evaluation-time native targets under exact host-input spellings. */
  hostInputRealpaths?: Record<string, string | null>;

  /** Explicitly unavailable observations; changed proven inputs are not excused. */
  hostInputProofFailures?: Record<string, "observation-unavailable">;

  /** Universal host paths whose proof downstream reuse must validate. */
  hostInputs?: string[];

  /** Source states of Go plugins that produced this generation. */
  pluginSources?: Record<string, string>;

  /** False withdraws complete observation authority; absence asserts nothing. */
  observationsComplete?: false;

  /** Compiler diagnostics and native process outcome. */
  result: TtscBuildResult;

  /** Optional per-output maps that refer only to returned TypeScript texts. */
  sourceMaps?: Record<string, ITtscCompilerTransformation.ISourceMap>;

  /** Required transformed TypeScript text under compiler output keys. */
  typescript: Record<string, string>;

  /** Sources the producer identifies as unsuitable for stable reuse. */
  volatile?: string[];
} {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const loaded = loadProjectPlugins({
    binary: resolveBinary(options) ?? "",
    cacheDir:
      options.cacheDir ??
      SidecarEnvironment.read(options.env, "TTSC_CACHE_DIR"),
    cwd,
    entries: options.plugins,
    env: inheritedSidecarEnv(options.env, options.binary),
    pluginConfigDir: options.pluginConfigDir,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  if (loaded.nativePlugins.length !== 0) {
    // Every step below runs binaries built from these sources, so the output
    // is a function of their state, which the envelope carries for a consumer
    // to prove.
    return {
      ...transformProjectWithPlugins(options, loaded),
      ...(Object.keys(loaded.pluginSources).length === 0
        ? {}
        : { pluginSources: loaded.pluginSources }),
    };
  }
  return transformProjectWithNativeHost(options, loaded.project, loaded);
}

/**
 * Transform via the built-in native compiler host (`cmd/ttsc api-transform`).
 * Used when no user plugins are configured, or as the fallback transformer when
 * check-stage plugins pass and no transform-stage plugins are declared.
 */
function transformProjectWithNativeHost(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
  baseline?: {
    hostInputHashes: Readonly<Record<string, string | null>>;
    hostInputRealpaths: Readonly<Record<string, string | null>>;
    hostInputs: readonly string[];
    observationsComplete?: false;
    hostInputProofFailures?: Record<string, "observation-unavailable">;
  },
): {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  hostInputHashes?: Record<string, string | null>;
  hostInputRealpaths?: Record<string, string | null>;
  hostInputProofFailures?: Record<string, "observation-unavailable">;
  hostInputs?: string[];
  observationsComplete?: false;
  result: TtscBuildResult;
  sourceMaps?: Record<string, ITtscCompilerTransformation.ISourceMap>;
  typescript: Record<string, string>;
  volatile?: string[];
} {
  // Capture the project inputs before the native host observes them. Pairing a
  // post-build hash with an earlier result can bless a torn generation when a
  // config changes during the child process.
  // Plugin discovery already ran in loadProjectPlugins. The native host only
  // consumes the resolved config chain here, so dependency package manifests
  // must not become per-project universal inputs a second time.
  const projectHostInputs = collectProjectHostInputs(project, false);
  const projectHostInputHashes = hashHostInputPaths(projectHostInputs);
  const projectHostInputRealpaths = realpathHostInputPaths(projectHostInputs);
  const observedHostInputs = mergeHostInputs(
    baseline?.hostInputs,
    projectHostInputs,
  );
  const observedHostInputHashes = mergeCompatibleHostInputHashes(
    baseline?.hostInputHashes ?? {},
    projectHostInputHashes,
    baseline?.hostInputs ?? [],
    projectHostInputs,
  );
  const observedHostInputRealpaths = mergeCompatibleHostInputHashes(
    baseline?.hostInputRealpaths ?? {},
    projectHostInputRealpaths,
    baseline?.hostInputs ?? [],
    projectHostInputs,
  );
  const binary = buildNativeCompiler({
    cacheBaseDir: project.root,
    cacheDir:
      options.cacheDir ??
      SidecarEnvironment.read(options.env, "TTSC_CACHE_DIR"),
    packageRoot: packageRootDir(),
  });
  const res = spawnNative(
    binary,
    ["api-transform", "--cwd", project.root, "--tsconfig", project.path],
    {
      cwd: project.root,
      env: inheritedSidecarEnv(options.env),
    },
  );
  if (res.error) {
    throw new Error(
      `ttsc: failed to spawn native compiler host ${binary}: ${res.error.message}`,
    );
  }

  const output = parseNativeTransformOutput(
    outputText(res.stdout),
    outputText(res.stderr),
  );
  const finalObservedHostInputHashes = revalidateHostInputHashes(
    observedHostInputHashes,
    observedHostInputs,
  );
  const finalOutputHostInputHashes = revalidateHostInputHashes(
    output.hostInputHashes ?? {},
    output.hostInputs ?? [],
  );
  const finalObservedHostInputRealpaths = revalidateHostInputRealpaths(
    observedHostInputRealpaths,
    observedHostInputs,
  );
  const finalOutputHostInputRealpaths = revalidateHostInputRealpaths(
    output.hostInputRealpaths ?? {},
    output.hostInputs ?? [],
  );
  const hostInputHashes = mergeCompatibleHostInputHashes(
    finalObservedHostInputHashes,
    finalOutputHostInputHashes,
    observedHostInputs,
    output.hostInputs,
  );
  const hostInputRealpaths = mergeCompatibleHostInputHashes(
    finalObservedHostInputRealpaths,
    finalOutputHostInputRealpaths,
    observedHostInputs,
    output.hostInputs,
  );
  return {
    ...envelopeSideChannels(output),
    ...observationLimitations(
      [
        baseline,
        {
          hostInputHashes: projectHostInputHashes,
          hostInputRealpaths: projectHostInputRealpaths,
        },
        output,
      ],
      hostInputHashes,
      hostInputRealpaths,
    ),
    hostInputHashes,
    hostInputRealpaths,
    hostInputs: mergeHostInputs(observedHostInputs, output.hostInputs),
    result: {
      diagnostics: output.diagnostics,
      status: res.status ?? 1,
      stdout: "",
      stderr: outputText(res.stderr),
    },
    typescript: output.typescript,
  };
}

function transformProjectWithPlugins(
  options: ITtscCompilerContext,
  loaded: ReturnType<typeof loadProjectPlugins>,
): {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  hostInputHashes?: Record<string, string | null>;
  hostInputRealpaths?: Record<string, string | null>;
  hostInputProofFailures?: Record<string, "observation-unavailable">;
  hostInputs?: string[];
  observationsComplete?: false;
  result: TtscBuildResult;
  sourceMaps?: Record<string, ITtscCompilerTransformation.ISourceMap>;
  typescript: Record<string, string>;
  volatile?: string[];
} {
  const { project } = loaded;
  const checks = loaded.nativePlugins.filter(
    (plugin) => plugin.stage === "check",
  );
  const transformers = loaded.nativePlugins.filter(
    (plugin) => plugin.stage === "transform",
  );
  const tsgoBinary =
    loaded.nativePlugins.length === 0
      ? ""
      : resolveTsgo({ ...options, cwd: project.root }).binary;
  const checked = runNativeChecks(
    options,
    project,
    tsgoBinary,
    loaded.nativePlugins,
    checks,
  );
  const checkedHostInputs = mergeHostInputs(
    loaded.hostInputs,
    checked.hostInputs,
  );
  const checkedHostInputHashes = mergeCompatibleHostInputHashes(
    revalidateHostInputHashes(loaded.hostInputHashes, loaded.hostInputs),
    revalidateHostInputHashes(
      checked.hostInputHashes ?? {},
      checked.hostInputs ?? [],
    ),
    loaded.hostInputs,
    checked.hostInputs,
    loaded.deferredHostInputs,
  );
  const checkedHostInputRealpaths = mergeCompatibleHostInputHashes(
    revalidateHostInputRealpaths(loaded.hostInputRealpaths, loaded.hostInputs),
    revalidateHostInputRealpaths(
      checked.hostInputRealpaths ?? {},
      checked.hostInputs ?? [],
    ),
    loaded.hostInputs,
    checked.hostInputs,
    loaded.deferredHostInputs,
  );
  // A forwarded config may await its first consuming native stage, but a
  // check's missing or conflicting proof cannot be replaced by a later stage.
  const checkDeclaredInputs = new Set(
    (checked.hostInputs ?? []).map((input) => path.resolve(input)),
  );
  const deferredTransformInputs = loaded.deferredHostInputs.filter(
    (input) => !checkDeclaredInputs.has(path.resolve(input)),
  );
  const unprovenCheckInputs = [...checkDeclaredInputs].filter(
    (input) =>
      !Object.hasOwn(checkedHostInputHashes, input) ||
      !Object.hasOwn(checkedHostInputRealpaths, input),
  );
  if (checked.status !== 0) {
    return {
      ...observationLimitations(
        [loaded, checked],
        checkedHostInputHashes,
        checkedHostInputRealpaths,
        unprovenCheckInputs,
      ),
      hostInputHashes: checkedHostInputHashes,
      hostInputRealpaths: checkedHostInputRealpaths,
      hostInputs: checkedHostInputs,
      result: checked,
      typescript: {},
    };
  }
  if (transformers.length === 0) {
    const transformed = transformProjectWithNativeHost(options, project);
    const finalLoadedHostInputHashes = revalidateHostInputHashes(
      checkedHostInputHashes,
      checkedHostInputs,
    );
    const finalLoadedHostInputRealpaths = revalidateHostInputRealpaths(
      checkedHostInputRealpaths,
      checkedHostInputs,
    );
    const hostInputHashes = mergeCompatibleHostInputHashes(
      finalLoadedHostInputHashes,
      transformed.hostInputHashes,
      checkedHostInputs,
      transformed.hostInputs,
    );
    const hostInputRealpaths = mergeCompatibleHostInputHashes(
      finalLoadedHostInputRealpaths,
      transformed.hostInputRealpaths,
      checkedHostInputs,
      transformed.hostInputs,
    );
    return {
      ...envelopeSideChannels(transformed),
      ...observationLimitations(
        [loaded, checked, transformed],
        hostInputHashes,
        hostInputRealpaths,
        unprovenCheckInputs,
      ),
      hostInputHashes,
      hostInputRealpaths,
      hostInputs: mergeHostInputs(checkedHostInputs, transformed.hostInputs),
      result: appendBuildOutput(checked, transformed.result),
      typescript: transformed.typescript,
    };
  }
  assertSharedHostCompatibility(transformers, "source-to-source");

  const plugin = selectSharedHostPlugin(transformers);
  const res = spawnNative(
    plugin.binary,
    createNativeTransformArgs(
      project,
      transformers,
      resolvePluginConfigDir(options),
    ),
    {
      cwd: project.root,
      env: nativePluginEnv(
        options,
        project.root,
        tsgoBinary,
        loaded.nativePlugins,
        plugin,
      ),
    },
  );
  if (res.error) {
    throw new Error(
      `ttsc.transform: failed to spawn ${plugin.binary}: ${res.error.message}`,
    );
  }
  const output = parseNativeTransformOutput(
    outputText(res.stdout),
    outputText(res.stderr),
  );
  const result = {
    diagnostics: output.diagnostics,
    status: res.status ?? 1,
    stdout: "",
    stderr: outputText(res.stderr),
  };
  const finalLoadedHostInputHashes = revalidateHostInputHashes(
    checkedHostInputHashes,
    checkedHostInputs,
  );
  const finalOutputHostInputHashes = revalidateHostInputHashes(
    output.hostInputHashes ?? {},
    output.hostInputs ?? [],
  );
  const finalLoadedHostInputRealpaths = revalidateHostInputRealpaths(
    checkedHostInputRealpaths,
    checkedHostInputs,
  );
  const finalOutputHostInputRealpaths = revalidateHostInputRealpaths(
    output.hostInputRealpaths ?? {},
    output.hostInputs ?? [],
  );
  const hostInputHashes = mergeCompatibleHostInputHashes(
    finalLoadedHostInputHashes,
    finalOutputHostInputHashes,
    checkedHostInputs,
    output.hostInputs,
    deferredTransformInputs,
  );
  const hostInputRealpaths = mergeCompatibleHostInputHashes(
    finalLoadedHostInputRealpaths,
    finalOutputHostInputRealpaths,
    checkedHostInputs,
    output.hostInputs,
    deferredTransformInputs,
  );
  return {
    ...envelopeSideChannels(output),
    ...observationLimitations(
      [loaded, checked, output],
      hostInputHashes,
      hostInputRealpaths,
      unprovenCheckInputs,
    ),
    hostInputHashes,
    hostInputRealpaths,
    hostInputs: mergeHostInputs(checkedHostInputs, output.hostInputs),
    result: appendBuildOutput(checked, result),
    typescript: output.typescript,
  };
}

/** Keep evaluation proof only when the same input still has the same state. */
function revalidateHostInputHashes(
  initial: Readonly<Record<string, string | null>>,
  inputs: readonly string[],
): Record<string, string | null> {
  const current = hashHostInputPaths(inputs);
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

/** Keep evaluation proof only while each lexical path selects the same target. */
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
 * Retain explicit observation limits without excusing a changed proven input. A
 * known content or physical witness that was dropped by revalidation or
 * incompatible-stage merging withdraws that path's unavailable exemption. The
 * independent global false marker still forbids complete reuse. Earlier check
 * declarations whose proof was lost also withhold a later stage's exemption.
 */
function observationLimitations(
  groups: readonly (
    | {
        observationsComplete?: false;
        hostInputProofFailures?: Readonly<
          Record<string, "observation-unavailable">
        >;
        hostInputHashes?: Readonly<Record<string, string | null>>;
        hostInputRealpaths?: Readonly<Record<string, string | null>>;
      }
    | undefined
  )[],
  retainedHashes: Readonly<Record<string, string | null>>,
  retainedRealpaths: Readonly<Record<string, string | null>>,
  rejectedInputs: readonly string[] = [],
): {
  observationsComplete?: false;
  hostInputProofFailures?: Record<string, "observation-unavailable">;
} {
  const failures: Record<string, "observation-unavailable"> =
    Object.create(null);
  for (const group of groups) {
    Object.assign(failures, group?.hostInputProofFailures);
  }
  for (const file of Object.keys(failures)) {
    if (
      groups.some(
        (group) =>
          (Object.hasOwn(group?.hostInputHashes ?? {}, file) &&
            group!.hostInputHashes![file] !== retainedHashes[file]) ||
          (Object.hasOwn(group?.hostInputRealpaths ?? {}, file) &&
            group!.hostInputRealpaths![file] !== retainedRealpaths[file]),
      )
    )
      delete failures[file];
  }
  // Earlier checks retain declarations after any witness conflict or loss.
  // A later stage cannot relabel that rejected proof as API unavailability.
  for (const input of rejectedInputs) delete failures[input];
  return {
    ...(groups.some((group) => group?.observationsComplete === false)
      ? { observationsComplete: false as const }
      : {}),
    ...(Object.keys(failures).length === 0
      ? {}
      : { hostInputProofFailures: failures }),
  };
}

/**
 * Collect the optional advisory envelope fields (`dependencies`,
 * `dependenciesComplete`, `graph`, `sourceMaps`, `volatile`) into a spreadable
 * object, omitting absent fields so downstream result shapes stay free of
 * `undefined` keys.
 */
function envelopeSideChannels(output: {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  sourceMaps?: Record<string, ITtscCompilerTransformation.ISourceMap>;
  volatile?: string[];
}): {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  sourceMaps?: Record<string, ITtscCompilerTransformation.ISourceMap>;
  volatile?: string[];
} {
  return {
    ...(output.dependencies === undefined
      ? {}
      : { dependencies: output.dependencies }),
    ...(output.dependenciesComplete === undefined
      ? {}
      : { dependenciesComplete: output.dependenciesComplete }),
    ...(output.graph === undefined ? {} : { graph: output.graph }),
    ...(output.sourceMaps === undefined
      ? {}
      : { sourceMaps: output.sourceMaps }),
    ...(output.volatile === undefined ? {} : { volatile: output.volatile }),
  };
}

/** Merge JavaScript- and native-host universal inputs by absolute path. */
function mergeHostInputs(
  ...groups: readonly (readonly string[] | undefined)[]
): string[] {
  return [
    ...new Set(
      groups.flatMap((group) =>
        (group ?? []).map((file) => path.resolve(file)),
      ),
    ),
  ].sort();
}

/** Keep only native/descriptor fingerprints that agree on shared paths. */
function mergeCompatibleHostInputHashes(
  first: Readonly<Record<string, string | null>>,
  second: Readonly<Record<string, string | null>> | undefined,
  firstInputs: readonly string[],
  secondInputs: readonly string[] | undefined,
  deferredFirstInputs: readonly string[] = [],
): Record<string, string | null> {
  const firstDeclared = new Set(
    firstInputs.map((input) => path.resolve(input)),
  );
  const secondDeclared = new Set(
    (secondInputs ?? []).map((input) => path.resolve(input)),
  );
  const deferredFirst = new Set(
    deferredFirstInputs.map((input) => path.resolve(input)),
  );
  const output = Object.fromEntries(
    Object.entries(first).flatMap(([file, hash]) => {
      const absolute = path.resolve(file);
      return firstDeclared.has(absolute) ? [[absolute, hash] as const] : [];
    }),
  );
  const unproven = new Set<string>();
  for (const input of firstInputs) {
    const absolute = path.resolve(input);
    if (!Object.prototype.hasOwnProperty.call(first, absolute)) {
      delete output[absolute];
      // A conventional `configFile` is only forwarded by the JavaScript
      // loader. Let the native consumer supply its own compile-time proof; if
      // it does not, no second entry can repopulate this path and the adapter
      // still rejects the generation as unproven.
      if (!deferredFirst.has(absolute)) unproven.add(absolute);
    }
  }
  for (const input of secondInputs ?? []) {
    const absolute = path.resolve(input);
    if (!Object.prototype.hasOwnProperty.call(second ?? {}, absolute)) {
      delete output[absolute];
      unproven.add(absolute);
    }
  }
  for (const [file, hash] of Object.entries(second ?? {})) {
    const absolute = path.resolve(file);
    if (!secondDeclared.has(absolute)) continue;
    if (unproven.has(absolute)) continue;
    if (
      Object.prototype.hasOwnProperty.call(output, absolute) &&
      output[absolute] !== hash
    ) {
      // Two evaluation stages observed different states. Dropping proof makes
      // persistent adapters replace the generation without turning advisory
      // cache metadata into a user-facing compile failure.
      delete output[absolute];
      unproven.add(absolute);
      continue;
    }
    output[absolute] = hash;
  }
  return output;
}

/**
 * Run every check-stage plugin in sequence, short-circuiting on the first
 * failure. Returns the aggregated `TtscBuildResult` (status 0 when all pass).
 */
function runNativeChecks(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
  tsgoBinary: string,
  nativePlugins: readonly ITtscLoadedNativePlugin[],
  checks: readonly ITtscLoadedNativePlugin[],
): TtscBuildResult {
  let result: TtscBuildResult = {
    diagnostics: [],
    status: 0,
    stdout: "",
    stderr: "",
  };
  for (const plugin of checks) {
    const checked = runNativeCheckWithObservations(plugin, (extraArgs) => {
      const res = spawnNative(
        plugin.binary,
        [
          ...createNativeCheckArgs(
            project,
            nativePlugins,
            plugin,
            resolvePluginConfigDir(options),
          ),
          ...extraArgs,
        ],
        {
          cwd: project.root,
          env: nativePluginEnv(
            options,
            project.root,
            tsgoBinary,
            nativePlugins,
            plugin,
          ),
        },
      );
      if (res.error) {
        throw new Error(
          `ttsc.transform.check: failed to spawn ${plugin.binary}: ${res.error.message}`,
        );
      }
      return normalizeBuildOutput(
        {
          status: res.status ?? 1,
          processCompletedNormally: res.status !== null && res.signal === null,
          stdout: outputText(res.stdout),
          stderr: outputText(res.stderr),
        },
        project.root,
      );
    });
    result = appendBuildOutput(result, checked);
    if (result.status !== 0) {
      return result;
    }
  }
  return result;
}

/** Build the CLI argument list for the `transform` subcommand. */
function createNativeTransformArgs(
  project: ITtscParsedProjectConfig,
  plugins: readonly ITtscLoadedNativePlugin[],
  pluginConfigOrigin?: string,
): string[] {
  const args = [
    "transform",
    "--tsconfig=" + project.path,
    "--plugins-json=" + serializeNativePlugins(plugins),
    "--cwd=" + project.root,
  ];
  if (
    selectSharedHostPlugin(plugins).capabilities?.projectContextArgs === true
  ) {
    args.push(...createNativeProjectContextArgs(project, pluginConfigOrigin));
  }
  return args;
}

/** Build the CLI argument list for the `check` subcommand. */
function createNativeCheckArgs(
  project: ITtscParsedProjectConfig,
  plugins: readonly ITtscLoadedNativePlugin[],
  plugin: ITtscLoadedNativePlugin,
  pluginConfigOrigin?: string,
): string[] {
  const args = [
    "check",
    "--tsconfig=" + project.path,
    "--plugins-json=" + serializeNativePlugins(plugins),
    "--cwd=" + project.root,
  ];
  if (plugin.capabilities?.projectContextArgs === true) {
    args.push(...createNativeProjectContextArgs(project, pluginConfigOrigin));
  }
  return args;
}

/**
 * Serialize the plugin list to a JSON string for `--plugins-json=`. Only the
 * fields the native binary needs are included to keep the arg short.
 */
function serializeNativePlugins(
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

/**
 * Build the environment for a native plugin spawn. Injects `TTSC_NODE_BINARY`,
 * `TTSC_TSGO_BINARY`, and `TTSC_TTSX_BINARY` so the sidecar can re-invoke
 * Node.js or tsgo without searching PATH, plus `TTSC_PLUGIN_CONFIG_DIR` when
 * the caller declared a plugin config anchor (an embedder compiling through a
 * generated wrapper tsconfig) so config-file discovery walks the real project
 * instead of the wrapper's temp-dir ancestry. For transform plugins, also
 * passes `TTSC_LINKED_PLUGINS_JSON` when linked sources are present.
 */
function nativePluginEnv(
  options: ITtscCompilerContext,
  projectRoot: string,
  tsgoBinary: string,
  nativePlugins?: readonly ITtscLoadedNativePlugin[],
  plugin?: ITtscLoadedNativePlugin,
): NodeJS.ProcessEnv {
  const pluginConfigDir = resolvePluginConfigDir(options);
  const env = SidecarEnvironment.merge(
    process.env,
    {
      ...(pluginConfigDir === undefined
        ? {}
        : { TTSC_PLUGIN_CONFIG_DIR: pluginConfigDir }),
      TTSC_TTSX_BINARY:
        process.env.TTSC_TTSX_BINARY ??
        path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
    },
    options.env,
    { TTSC_TSGO_BINARY: tsgoBinary },
  );
  const node = resolveNodeBinary(env, projectRoot);
  SidecarEnvironment.write(env, "TTSC_NODE_BINARY", node);
  // The anchor is per-invocation state owned by this host: when this run
  // declared none (and the caller's env does not name one), drop any value
  // inherited from an ancestor ttsc process so a nested build never
  // mis-anchors its plugins at the outer project.
  SidecarEnvironment.write(
    env,
    "TTSC_PLUGIN_CONFIG_DIR",
    SidecarEnvironment.read(options.env, "TTSC_PLUGIN_CONFIG_DIR") ??
      pluginConfigDir,
  );
  // This lane forwards no tsgo argv of its own, so anything inherited belongs
  // to an outer ttsc run and must not reach these sidecars.
  clearInheritedTsgoArgs(env, options.env);
  clearInheritedSemanticConfigPath(env, options.env);
  publishLinkedTransformPlugins(
    env,
    options.env,
    plugin?.stage === "transform"
      ? linkedTransformPlugins(nativePlugins ?? [])
      : [],
  );
  return env;
}
