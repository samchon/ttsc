import path from "node:path";

import { resolveNodeBinary } from "../../internal/resolveNodeBinary";
import {
  collectProjectHostInputs,
  hashHostInputPaths,
  loadProjectPlugins,
  realpathHostInputPaths,
} from "../../plugin/internal/loadProjectPlugins";
import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscCompilerTransformation } from "../../structures/ITtscCompilerTransformation";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import { buildNativeCompiler } from "./buildNativeCompiler";
import { packageRootDir } from "./paths";
import { createNativeProjectContextArgs } from "./project/createNativeProjectContextArgs";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";
import { appendBuildOutput, normalizeBuildOutput } from "./runBuild";
import {
  assertSharedHostCompatibility,
  clearInheritedSemanticConfigPath,
  clearInheritedTsgoArgs,
  inheritedSidecarEnv,
  linkedTransformPlugins,
  resolvePluginConfigDir,
  selectSharedHostPlugin,
} from "./sharedHostHelpers";
import { outputText, spawnNative } from "./spawnNative";

/**
 * Transform a project and capture TypeScript source output in memory.
 *
 * When no plugins are configured the fast path spawns the native ttsc compiler
 * host (`cmd/ttsc api-transform`) which returns a JSON map of transformed
 * TypeScript sources. When plugins are present:
 *
 * 1. Check-stage plugins run first and abort on failure.
 * 2. If there are no transform-stage plugins the host is used as the transformer.
 * 3. If transform plugins exist they are dispatched through the shared-host binary
 *    with linked plugins passed via `TTSC_LINKED_PLUGINS_JSON`.
 *
 * @returns A `{ result, typescript }` pair where `typescript` maps output paths
 *   to their transformed TypeScript source text.
 */
export function transformProjectInMemory(options: ITtscCompilerContext): {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  hostInputHashes?: Record<string, string | null>;
  hostInputRealpaths?: Record<string, string | null>;
  hostInputs?: string[];
  result: TtscBuildResult;
  typescript: Record<string, string>;
  volatile?: string[];
} {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const loaded = loadProjectPlugins({
    binary: resolveBinary(options) ?? "",
    cacheDir: options.cacheDir ?? options.env?.TTSC_CACHE_DIR,
    cwd,
    entries: options.plugins,
    env: inheritedSidecarEnv(options.env),
    pluginConfigDir: options.pluginConfigDir,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  if (loaded.nativePlugins.length !== 0) {
    return transformProjectWithPlugins(options, loaded);
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
  },
): {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  hostInputHashes?: Record<string, string | null>;
  hostInputRealpaths?: Record<string, string | null>;
  hostInputs?: string[];
  result: TtscBuildResult;
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
    cacheDir: options.cacheDir ?? options.env?.TTSC_CACHE_DIR,
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
  return {
    ...envelopeSideChannels(output),
    hostInputHashes: mergeCompatibleHostInputHashes(
      finalObservedHostInputHashes,
      finalOutputHostInputHashes,
      observedHostInputs,
      output.hostInputs,
    ),
    hostInputRealpaths: mergeCompatibleHostInputHashes(
      finalObservedHostInputRealpaths,
      finalOutputHostInputRealpaths,
      observedHostInputs,
      output.hostInputs,
    ),
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
  hostInputs?: string[];
  result: TtscBuildResult;
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
  if (checked.status !== 0) {
    return {
      hostInputHashes: revalidateHostInputHashes(
        loaded.hostInputHashes,
        loaded.hostInputs,
      ),
      hostInputRealpaths: revalidateHostInputRealpaths(
        loaded.hostInputRealpaths,
        loaded.hostInputs,
      ),
      hostInputs: loaded.hostInputs,
      result: checked,
      typescript: {},
    };
  }
  if (transformers.length === 0) {
    const transformed = transformProjectWithNativeHost(options, project);
    const finalLoadedHostInputHashes = revalidateHostInputHashes(
      loaded.hostInputHashes,
      loaded.hostInputs,
    );
    const finalLoadedHostInputRealpaths = revalidateHostInputRealpaths(
      loaded.hostInputRealpaths,
      loaded.hostInputs,
    );
    return {
      ...envelopeSideChannels(transformed),
      hostInputHashes: mergeCompatibleHostInputHashes(
        finalLoadedHostInputHashes,
        transformed.hostInputHashes,
        loaded.hostInputs,
        transformed.hostInputs,
      ),
      hostInputRealpaths: mergeCompatibleHostInputHashes(
        finalLoadedHostInputRealpaths,
        transformed.hostInputRealpaths,
        loaded.hostInputs,
        transformed.hostInputs,
      ),
      hostInputs: mergeHostInputs(loaded.hostInputs, transformed.hostInputs),
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
    loaded.hostInputHashes,
    loaded.hostInputs,
  );
  const finalOutputHostInputHashes = revalidateHostInputHashes(
    output.hostInputHashes ?? {},
    output.hostInputs ?? [],
  );
  const finalLoadedHostInputRealpaths = revalidateHostInputRealpaths(
    loaded.hostInputRealpaths,
    loaded.hostInputs,
  );
  const finalOutputHostInputRealpaths = revalidateHostInputRealpaths(
    output.hostInputRealpaths ?? {},
    output.hostInputs ?? [],
  );
  return {
    ...envelopeSideChannels(output),
    hostInputHashes: mergeCompatibleHostInputHashes(
      finalLoadedHostInputHashes,
      finalOutputHostInputHashes,
      loaded.hostInputs,
      output.hostInputs,
    ),
    hostInputRealpaths: mergeCompatibleHostInputHashes(
      finalLoadedHostInputRealpaths,
      finalOutputHostInputRealpaths,
      loaded.hostInputs,
      output.hostInputs,
    ),
    hostInputs: mergeHostInputs(loaded.hostInputs, output.hostInputs),
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
 * Collect the optional advisory envelope fields (`dependencies`,
 * `dependenciesComplete`, `graph`, `volatile`) into a spreadable object,
 * omitting absent fields so downstream result shapes stay free of `undefined`
 * keys.
 */
function envelopeSideChannels(output: {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  volatile?: string[];
}): {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
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
): Record<string, string | null> {
  const firstDeclared = new Set(
    firstInputs.map((input) => path.resolve(input)),
  );
  const secondDeclared = new Set(
    (secondInputs ?? []).map((input) => path.resolve(input)),
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
      unproven.add(absolute);
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
    const res = spawnNative(
      plugin.binary,
      createNativeCheckArgs(
        project,
        nativePlugins,
        plugin,
        resolvePluginConfigDir(options),
      ),
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
    result = appendBuildOutput(
      result,
      normalizeBuildOutput(
        {
          status: res.status ?? 1,
          stdout: outputText(res.stdout),
          stderr: outputText(res.stderr),
        },
        project.root,
      ),
    );
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
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(pluginConfigDir === undefined
      ? {}
      : { TTSC_PLUGIN_CONFIG_DIR: pluginConfigDir }),
    TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? tsgoBinary,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ??
      path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
    ...options.env,
  };
  const node = resolveNodeBinary(env, projectRoot);
  if (node === undefined) delete env.TTSC_NODE_BINARY;
  else env.TTSC_NODE_BINARY = node;
  // The anchor is per-invocation state owned by this host: when this run
  // declared none (and the caller's env does not name one), drop any value
  // inherited from an ancestor ttsc process so a nested build never
  // mis-anchors its plugins at the outer project.
  if (
    pluginConfigDir === undefined &&
    options.env?.TTSC_PLUGIN_CONFIG_DIR === undefined
  ) {
    delete env.TTSC_PLUGIN_CONFIG_DIR;
  }
  // This lane forwards no tsgo argv of its own, so anything inherited belongs
  // to an outer ttsc run and must not reach these sidecars.
  clearInheritedTsgoArgs(env, options.env);
  clearInheritedSemanticConfigPath(env, options.env);
  if (plugin?.stage === "transform") {
    const linked = linkedTransformPlugins(nativePlugins ?? []);
    if (linked.length !== 0) {
      env.TTSC_LINKED_PLUGINS_JSON = serializeNativePlugins(linked);
    }
  }
  return env;
}

/**
 * Parse the JSON envelope written by the native transform host to stdout.
 *
 * The `typescript` field must be a `Record<string, string>`. Any other shape is
 * treated as a protocol error and throws with the stderr/stdout context. JSON
 * parse errors are also wrapped with the same context message.
 *
 * The optional `dependencies`, `dependenciesComplete`, `graph`, and `volatile`
 * fields (see `ITtscCompilerTransformation`) are forwarded when well-formed;
 * entries that do not match the expected shape are dropped rather than failing
 * the transform — the fields are advisory invalidation metadata, not output.
 *
 * Dropping a malformed `dependenciesComplete` member is the safe direction on
 * purpose: an unlisted file keeps the sound host-owned bound, so a garbled
 * declaration costs over-invalidation, never a stale output.
 */
function parseNativeTransformOutput(
  stdout: string,
  stderr: string,
): {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  diagnostics: ITtscCompilerDiagnostic[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  hostInputHashes?: Record<string, string | null>;
  hostInputRealpaths?: Record<string, string | null>;
  hostInputs?: string[];
  typescript: Record<string, string>;
  volatile?: string[];
} {
  try {
    const parsed = JSON.parse(stdout) as {
      dependencies?: Record<string, string[]>;
      dependenciesComplete?: string[];
      diagnostics?: ITtscCompilerDiagnostic[];
      graph?: ITtscCompilerTransformation.IReferenceGraph;
      hostInputHashes?: Record<string, string | null>;
      hostInputRealpaths?: Record<string, string | null>;
      hostInputs?: string[];
      typescript?: Record<string, string>;
      volatile?: string[];
    };
    if (!isTextRecord(parsed.typescript)) {
      throw new Error(
        "ttsc: native transform host did not return a TypeScript source map",
      );
    }
    const dependencies = parseDependencyLists(parsed.dependencies);
    const dependenciesComplete = parseFileList(parsed.dependenciesComplete);
    const graph = parseReferenceGraph(parsed.graph);
    const hostInputHashes = parseHostInputHashes(parsed.hostInputHashes);
    const hostInputRealpaths = parseHostInputRealpaths(
      parsed.hostInputRealpaths,
    );
    const hostInputs = parseFileList(parsed.hostInputs);
    const volatile = parseFileList(parsed.volatile);
    return {
      ...(dependencies === undefined ? {} : { dependencies }),
      ...(dependenciesComplete === undefined ? {} : { dependenciesComplete }),
      ...(graph === undefined ? {} : { graph }),
      ...(hostInputHashes === undefined ? {} : { hostInputHashes }),
      ...(hostInputRealpaths === undefined ? {} : { hostInputRealpaths }),
      ...(hostInputs === undefined ? {} : { hostInputs }),
      ...(volatile === undefined ? {} : { volatile }),
      diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [],
      typescript: parsed.typescript,
    };
  } catch (error) {
    if (error instanceof Error && !(error instanceof SyntaxError)) {
      throw error;
    }
    throw new Error(
      (stderr || stdout).trim() ||
        "ttsc: native transform host returned no output",
    );
  }
}

/** Parse native evaluation-time SHA-256/null host-input fingerprints. */
function parseHostInputHashes(
  value: unknown,
): Record<string, string | null> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string | null> = {};
  for (const [file, hash] of Object.entries(value)) {
    if (
      !path.isAbsolute(file) ||
      (hash !== null &&
        (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)))
    ) {
      continue;
    }
    output[path.resolve(file)] = hash;
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/** Parse native evaluation-time realpath/null host-input identities. */
function parseHostInputRealpaths(
  value: unknown,
): Record<string, string | null> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string | null> = {};
  for (const [file, realpath] of Object.entries(value)) {
    if (
      !path.isAbsolute(file) ||
      (realpath !== null &&
        (typeof realpath !== "string" || !path.isAbsolute(realpath)))
    ) {
      continue;
    }
    output[path.resolve(file)] =
      realpath === null ? null : path.resolve(realpath as string);
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/**
 * Normalize the optional `dependencies` envelope field into a record of string
 * arrays, or `undefined` when absent or carrying nothing usable.
 */
function parseDependencyLists(
  value: unknown,
): Record<string, string[]> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string[]> = {};
  for (const [key, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    const files = entries.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (files.length !== 0) {
      output[key] = files;
    }
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/**
 * Normalize graph adjacency while retaining every well-formed node key.
 *
 * A leaf is intentionally encoded as an empty target array. Its key still
 * declares graph membership and lets persistent hosts bind the compiler-time
 * input proof for that source. A node needs a non-empty source key and an array
 * value; invalid array members are filtered without erasing a valid node.
 */
function parseGraphEdges(value: unknown): Record<string, string[]> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string[]> = {};
  for (const [key, entries] of Object.entries(value)) {
    if (key.length === 0 || !Array.isArray(entries)) {
      continue;
    }
    output[key] = entries.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/**
 * Normalize the optional `graph` envelope section with the same tolerance as
 * `dependencies`: non-object sections are dropped, empty source keys and edge
 * entries that are not arrays are dropped, and non-string list members are
 * filtered. Empty arrays remain as graph nodes because leaf membership binds
 * compiler input proof. A section carrying nothing usable collapses to
 * `undefined`.
 *
 * Optional resolver-input members are left off when empty. A consumer that
 * narrows on their declared optional types therefore sees the same shape from
 * the decoded envelope and the wire.
 */
function parseReferenceGraph(
  value: unknown,
): ITtscCompilerTransformation.IReferenceGraph | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const section = value as {
    candidates?: unknown;
    configs?: unknown;
    edges?: unknown;
    globals?: unknown;
    inputHashes?: unknown;
    inputObservations?: unknown;
    inputProofFailures?: unknown;
    inputRealpaths?: unknown;
    resolutionInputs?: unknown;
  };
  const candidates = parseDependencyLists(section.candidates) ?? {};
  const edges = parseGraphEdges(section.edges) ?? {};
  const globals = parseFileList(section.globals) ?? [];
  const configs = parseFileList(section.configs) ?? [];
  const resolutionInputs = parseFileList(section.resolutionInputs) ?? [];
  const inputHashes = parseGraphInputHashes(section.inputHashes);
  const parsedInputObservations = parseGraphInputObservations(
    section.inputObservations,
  );
  const reportedInputProofFailures = parseGraphInputProofFailures(
    section.inputProofFailures,
  );
  const inputProofFailures = {
    ...reportedInputProofFailures,
    ...parsedInputObservations.failures,
  };
  const inputRealpaths = parseGraphInputRealpaths(section.inputRealpaths);
  if (
    Object.keys(candidates).length === 0 &&
    Object.keys(edges).length === 0 &&
    globals.length === 0 &&
    configs.length === 0 &&
    resolutionInputs.length === 0
  ) {
    return undefined;
  }
  return {
    ...(Object.keys(candidates).length === 0 ? {} : { candidates }),
    configs,
    edges,
    globals,
    ...(resolutionInputs.length === 0 ? {} : { resolutionInputs }),
    ...(inputHashes === undefined ? {} : { inputHashes }),
    ...(parsedInputObservations.observations === undefined
      ? {}
      : { inputObservations: parsedInputObservations.observations }),
    ...(Object.keys(inputProofFailures).length === 0
      ? {}
      : { inputProofFailures }),
    ...(inputRealpaths === undefined ? {} : { inputRealpaths }),
  };
}

/**
 * Parse graph-keyed predicate observations and retain malformed entries as
 * failures.
 */
function parseGraphInputObservations(value: unknown): {
  failures?: Record<string, string>;
  observations?: Record<string, ITtscCompilerTransformation.IInputObservation>;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const failures: Record<string, string> = {};
  const observations: Record<
    string,
    ITtscCompilerTransformation.IInputObservation
  > = {};
  for (const [file, entry] of Object.entries(value)) {
    if (file.length === 0) continue;
    const parsed = parseGraphInputObservation(entry);
    if (parsed === "malformed" || parsed === "conflicting") {
      failures[file] = `${parsed}-observation`;
    } else {
      observations[file] = parsed;
    }
  }
  return {
    ...(Object.keys(failures).length === 0 ? {} : { failures }),
    ...(Object.keys(observations).length === 0 ? {} : { observations }),
  };
}

/** Parse one predicate observation without guessing around a malformed member. */
function parseGraphInputObservation(
  value: unknown,
): ITtscCompilerTransformation.IInputObservation | "conflicting" | "malformed" {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "malformed";
  }
  const entry = value as Record<string, unknown>;
  const observation: ITtscCompilerTransformation.IInputObservation = {};
  if (Object.prototype.hasOwnProperty.call(entry, "accessibleEntries")) {
    const accessible = entry.accessibleEntries;
    if (
      typeof accessible !== "object" ||
      accessible === null ||
      Array.isArray(accessible)
    ) {
      return "malformed";
    }
    const lists = accessible as Record<string, unknown>;
    if (
      !Array.isArray(lists.directories) ||
      !lists.directories.every(
        (name): name is string => typeof name === "string",
      ) ||
      !Array.isArray(lists.files) ||
      !lists.files.every((name): name is string => typeof name === "string")
    ) {
      return "malformed";
    }
    observation.accessibleEntries = {
      directories: [...lists.directories],
      files: [...lists.files],
    };
  }
  if (Object.prototype.hasOwnProperty.call(entry, "fileExists")) {
    if (typeof entry.fileExists !== "boolean") return "malformed";
    observation.fileExists = entry.fileExists;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "directoryExists")) {
    if (typeof entry.directoryExists !== "boolean") return "malformed";
    observation.directoryExists = entry.directoryExists;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "stat")) {
    if (!["directory", "file", "missing"].includes(entry.stat as string)) {
      return "malformed";
    }
    observation.stat = entry.stat as "directory" | "file" | "missing";
  }
  if (Object.prototype.hasOwnProperty.call(entry, "readFile")) {
    const read = entry.readFile;
    if (typeof read !== "object" || read === null || Array.isArray(read)) {
      return "malformed";
    }
    const result = read as Record<string, unknown>;
    if (result.ok === false && result.hash === undefined) {
      observation.readFile = { ok: false };
    } else if (
      result.ok === true &&
      typeof result.hash === "string" &&
      /^[0-9a-f]{64}$/.test(result.hash)
    ) {
      observation.readFile = { hash: result.hash, ok: true };
    } else {
      return "malformed";
    }
  }
  if (Object.prototype.hasOwnProperty.call(entry, "realpath")) {
    const realpath = entry.realpath;
    if (
      typeof realpath !== "object" ||
      realpath === null ||
      Array.isArray(realpath)
    ) {
      return "malformed";
    }
    const result = realpath as Record<string, unknown>;
    if (result.ok === false && result.path === undefined) {
      observation.realpath = { ok: false };
    } else if (
      result.ok === true &&
      typeof result.path === "string" &&
      path.isAbsolute(result.path)
    ) {
      observation.realpath = { ok: true, path: path.resolve(result.path) };
    } else {
      return "malformed";
    }
  }
  if (Object.keys(observation).length === 0) return "malformed";
  return graphInputObservationCompatible(observation)
    ? observation
    : "conflicting";
}

/** Whether one predicate set can describe a single stable filesystem state. */
function graphInputObservationCompatible(
  observation: ITtscCompilerTransformation.IInputObservation,
): boolean {
  const { accessibleEntries, directoryExists, fileExists, readFile, stat } =
    observation;
  const hasAccessibleEntries =
    accessibleEntries !== undefined &&
    (accessibleEntries.directories.length !== 0 ||
      accessibleEntries.files.length !== 0);
  if (
    hasAccessibleEntries &&
    (fileExists === true ||
      directoryExists === false ||
      (stat !== undefined && stat !== "directory") ||
      readFile?.ok === true)
  ) {
    return false;
  }
  if (fileExists === true && directoryExists === true) return false;
  if (
    stat === "directory" &&
    (fileExists === true || directoryExists === false)
  ) {
    return false;
  }
  if (stat === "file" && (fileExists === false || directoryExists === true)) {
    return false;
  }
  if (stat === "missing" && (fileExists === true || directoryExists === true)) {
    return false;
  }
  if (
    readFile?.ok === true &&
    (fileExists === false ||
      directoryExists === true ||
      (stat !== undefined && stat !== "file"))
  ) {
    return false;
  }
  return true;
}

/** Parse graph-keyed machine-readable compiler proof-failure reasons. */
function parseGraphInputProofFailures(
  value: unknown,
): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string> = {};
  for (const [file, reason] of Object.entries(value)) {
    if (
      file.length === 0 ||
      typeof reason !== "string" ||
      !/^[a-z0-9-]{1,64}$/.test(reason)
    ) {
      continue;
    }
    output[file] = reason;
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/** Parse graph-keyed compiler-time content/null observations. */
function parseGraphInputHashes(
  value: unknown,
): Record<string, string | null> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string | null> = {};
  for (const [file, hash] of Object.entries(value)) {
    if (
      file.length === 0 ||
      (hash !== null &&
        (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)))
    ) {
      continue;
    }
    output[file] = hash;
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/** Parse graph-keyed compiler-time physical/null identities. */
function parseGraphInputRealpaths(
  value: unknown,
): Record<string, string | null> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string | null> = {};
  for (const [file, realpath] of Object.entries(value)) {
    if (
      file.length === 0 ||
      (realpath !== null &&
        (typeof realpath !== "string" || !path.isAbsolute(realpath)))
    ) {
      continue;
    }
    output[file] = realpath === null ? null : path.resolve(realpath);
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/**
 * Normalize an optional string-list envelope field (`dependenciesComplete`,
 * `hostInputs`, `volatile`, and the `globals`/`configs` graph sections), or
 * `undefined` when absent or carrying nothing usable.
 */
function parseFileList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const files = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length !== 0,
  );
  return files.length === 0 ? undefined : files;
}

/** Type guard: true when `value` is a non-null, non-array object of strings. */
function isTextRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}
