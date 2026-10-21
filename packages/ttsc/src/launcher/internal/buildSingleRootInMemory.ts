import fs from "node:fs";
import path from "node:path";

import { BuildExecution } from "../../compiler/internal/build/BuildExecution";
import { PassthroughFlags } from "../../compiler/internal/build/PassthroughFlags";
import type { RunBuildOptions } from "../../compiler/internal/build/RunBuildOptions";
import { TsgoArguments } from "../../compiler/internal/build/TsgoArguments";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../../compiler/internal/readEffectiveCompilerOptions";
import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { SidecarEnvironment } from "../../compiler/internal/sharedHost/SidecarEnvironment";
import { readCompilerOptionValues } from "../../flags/readCompilerOptionValues";
import { hasProjectPluginEntries } from "../../plugin/internal/load/hasProjectPluginEntries";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { TypeScriptSyncApi } from "./TypeScriptSyncApi";
import { compilerArgsAsConfigOptions } from "./compilerArgsAsConfigOptions";
import { DependencyBuildGeneration } from "./runtime/DependencyBuildGeneration";
import { runtimeCompilerArgs } from "./runtimeCompilerArgs";
import { runtimeEmitProfile } from "./runtimeEmitProfile";
import { singleRootProjectConfig } from "./singleRootProjectConfig";

/**
 * Compile one root outside its project's file set through the consuming
 * TypeScript's own API, with the single-root tsconfig held in memory, or report
 * that this build cannot take that route.
 *
 * `buildSingleRootProject` compiles such a root through a tsconfig that extends
 * the project and lists only the root. On the command line that tsconfig has to
 * exist on disk, beside the project's own when a checked build needs its
 * directory-relative lookups. TypeScript 7.1's `typescript/sync` API opens a
 * project from a snapshot whose filesystem layer holds the tsconfig instead,
 * and its emit returns the files rather than writing them. So here the tsconfig
 * always sits, in memory, beside the project's own: `${configDir}`, the default
 * `typeRoots` and every `types` entry resolve exactly as the user's config sees
 * them, and nothing is created in the user's tree.
 *
 * The compiler options are the command-line build's. The arguments that build
 * would pass after `-p` (`TsgoArguments.createTsgoBuildArgs` over the same run
 * options) are written into the in-memory tsconfig's `compilerOptions` by
 * `compilerArgsAsConfigOptions`, which keeps their precedence over the project.
 * The session compiler's own command-line parser must accept them first, so an
 * invalid argument still gets the command line's diagnostic. Outputs are
 * written into `emitDir` only; one the options would place elsewhere is not
 * written at all, as the command-line build's isolation keeps it inside. Each
 * JavaScript output's source is the one the compiler emitted it from.
 *
 * The route is unavailable, and the caller keeps the command-line build, when
 * the project's TypeScript publishes no such API (7.0), when a custom compiler
 * binary or compiler environment is selected, when the build would run native
 * plugins (they run inside ttsc's own host, which reads its tsconfig from
 * disk), or when its arguments cannot be carried by a tsconfig: a response
 * file, a terminal flag, or another command-line-only argument.
 *
 * The returned `project` is the owning project's parse. The in-memory tsconfig
 * changes only the file set, the output layout and declaration emission, so its
 * module options are the project's.
 *
 * @returns The build, or `undefined` when this route is unavailable.
 * @throws When the build fails, with the messages of the command-line build: a
 *   checked build fails on any diagnostic, an emit-only build only when it
 *   produced no JavaScript.
 * @evidence contracts/common.md#principled-implementation The command-line build's own argument composition supplies the options, translated into the extending config's compilerOptions where they keep command-line precedence, and validated by the consumer compiler's parseCommandLine. Diagnostics are gathered in the native report order (GetDiagnosticsOfAnyProgram: config and syntactic, then options and global, then semantic and the global diagnostics checking found, each later group only when no diagnostic beyond the config ones precedes), and the emit is the consumer compiler's own. Premise: a layer-filesystem config is parsed like one on disk at the same path, verified against typescript@7.1.0-beta and the 7.1 nightly the E2E lane installs.
 * @evidence contracts/common.md#clear-and-simple-design Admission, option translation, the API session and output writing are each one step of this function, with translation and the API surface in their own modules; the caller keeps the command-line route for every refusal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Every unsupported build class returns undefined to the existing command-line route instead of an approximation; no consumer or fixture is special-cased and the compiler is used through its published API.
 * @evidence contracts/common.md#meaningful-documentation The prose explains the in-memory placement, option equivalence, output isolation, provenance, every refusal class and the meaning of the returned project.
 * @evidence contracts/portability.md#os-neutral-implementation Output names from the API are resolved with node:path before writing, and sources are recorded by their native real path, the spelling the command-line provenance records.
 * @evidence contracts/performance.md#efficient-algorithms The compiler package is resolved and its API loaded first, so a 7.0 project costs one package resolution and a failed export lookup before the command-line build. An admitted build then makes one project parse, one execution resolution without plugin loading, one API session with one snapshot, one diagnostic pass when checked and one emit; an emit-only build gathers diagnostics only to explain a failure.
 * @evidence contracts/performance.md#reuse-equivalent-work The project parse serves plugin admission, the runtime options and the execution context; the session's parse of the arguments precedes the single snapshot.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The API session is closed in finally on success and failure: close destroys its pipes and signals the child to terminate without waiting for its exit, and the API kills a child still alive when the process exits. Emitted text is held until written; the caller owns emitDir.
 */
export function buildSingleRootInMemory(props: {
  /** The root, in the physical spelling the runtime loads it by. */
  source: string;

  /** The owning `tsconfig.json`, whose options the root inherits. */
  tsconfig: string;

  /** Directory the build runs in. */
  projectRoot: string;

  /** Directory-safe token naming the in-memory tsconfig. */
  key: string;

  /** Where the JavaScript goes. The directory must be private to this build. */
  emitDir: string;

  /** Whether diagnostics stop the build. */
  checked: boolean;

  /** Names the root in a failure. */
  role: "entry" | "root";

  /** Root of the source's volume, the in-memory tsconfig's `rootDir`. */
  volumeRoot: string;

  /** Build options of the caller. */
  options: TtscCommonOptions & { cacheDir?: string };
}):
  | {
      project: ReturnType<typeof readProjectConfig>;
      rootDir: string;
      emittedSources: Record<string, readonly string[]>;
      emittedSourceProofFailures?: Record<string, string>;
    }
  | undefined {
  const options = props.options;
  if (
    readCompilerOptionValues(options.passthrough).responseFiles.length !== 0 ||
    options.binary !== undefined ||
    SidecarEnvironment.read(process.env, "TTSC_TSGO_BINARY") ||
    (options.env !== undefined && Object.keys(options.env).length !== 0)
  )
    return undefined;
  // Checked first: a 7.0 project, the common case, then costs one package
  // resolution before the command-line build.
  let compiler: ReturnType<typeof resolveTsgo>;
  try {
    compiler = resolveTsgo({ cwd: path.dirname(props.tsconfig) });
  } catch {
    // The command-line build reports a missing compiler in its own words.
    return undefined;
  }
  const api = TypeScriptSyncApi.load(compiler.packageJson);
  if (api === undefined) return undefined;
  const project = readProjectConfig({
    cwd: props.projectRoot,
    projectRoot: options.projectRoot,
    tsconfig: props.tsconfig,
  });
  if (
    hasProjectPluginEntries(project, options.plugins, options.pluginConfigDir)
  )
    return undefined;
  const effectiveOptions = readEffectiveCompilerOptions(
    project,
    options.passthrough,
    undefined,
    process.env,
  );
  const runOptions: RunBuildOptions = {
    checkers: options.checkers,
    cwd: props.projectRoot,
    emit: true,
    outDir: props.emitDir,
    isolateOutputsTo: props.emitDir,
    passthrough: runtimeCompilerArgs(
      project,
      options.passthrough,
      undefined,
      effectiveOptions,
    ),
    forceRuntimeSourceMap: runtimeEmitProfile(
      project,
      options.passthrough,
      undefined,
      effectiveOptions,
    ).forceRuntimeSourceMap,
    plugins: options.plugins,
    pluginConfigDir: options.pluginConfigDir,
    projectRoot: options.projectRoot,
    quiet: true,
    resolvedProject: project,
    singleThreaded: options.singleThreaded,
    skipDiagnosticsCheck: !props.checked,
    tsconfig: props.tsconfig,
  };
  const execution = BuildExecution.resolveExecutionContext(runOptions);
  if (
    execution.compilerSelection.inspectionError !== undefined ||
    execution.pluginSetupFailure !== undefined ||
    execution.nativePlugins.length !== 0 ||
    execution.tsgo.packageJson !== compiler.packageJson
  )
    return undefined;
  const buildOptions = BuildExecution.applyProjectNoEmit(runOptions, execution);
  if (PassthroughFlags.forwardsTerminalTsgoFlag(buildOptions)) return undefined;
  const args = TsgoArguments.createTsgoBuildArgs(execution, buildOptions, {
    listEmittedFiles: false,
    noEmitOnError: props.checked,
  });
  if (args[0] !== "-p" || args[1] !== execution.tsconfig) return undefined;
  const assigned = compilerArgsAsConfigOptions(args.slice(2), execution.cwd);
  if (assigned === undefined) return undefined;

  const config = singleRootProjectConfig({
    tsconfig: props.tsconfig,
    source: props.source,
    volumeRoot: props.volumeRoot,
    checked: props.checked,
  });
  const configFile = path.join(
    path.dirname(props.tsconfig),
    `.ttsx-${props.role}.${props.key}.tsconfig.json`,
  );
  const session = new api.API({
    cwd: execution.cwd,
    tsserverPath: execution.tsgo.binary,
  });
  try {
    if (session.parseCommandLine(args.slice(2)).errors.length !== 0)
      return undefined;
    const snapshot = session.createSnapshot({
      openProjects: [configFile],
      fileSystem: {
        kind: "layer",
        files: {
          [configFile]: JSON.stringify({
            ...config,
            compilerOptions: { ...config.compilerOptions, ...assigned },
          }),
        },
      },
    });
    const opened = snapshot.getConfiguredProject(configFile);
    const program =
      opened === undefined ? undefined : snapshot.getProgram(opened.id);
    if (program === undefined)
      throw new Error(
        `ttsx: TypeScript did not open the ${props.role} project for ${props.source}`,
      );
    const failure = (
      summary: string,
      diagnostics: Parameters<TypeScriptSyncApi.Module["formatDiagnostics"]>[0],
    ): Error =>
      new Error(
        [summary, api.formatDiagnostics(diagnostics, session)]
          .filter((line) => line.trim().length !== 0)
          .join("\n"),
      );
    const checkFailure = `ttsx: ${props.role} check failed for ${props.source}`;
    if (props.checked) {
      const diagnostics = TypeScriptSyncApi.reportedDiagnostics(program);
      if (diagnostics.length !== 0) throw failure(checkFailure, diagnostics);
    }
    const emitted = program.emitToString();
    if (props.checked && (emitted.diagnostics?.length ?? 0) !== 0)
      throw failure(checkFailure, emitted.diagnostics!);
    const emitDir = path.resolve(props.emitDir);
    const emittedSources: Record<string, readonly string[]> =
      Object.create(null);
    const emittedSourceProofFailures: Record<string, string> =
      Object.create(null);
    fs.mkdirSync(emitDir, { recursive: true });
    for (const [fileName, file] of emitted.outputFiles) {
      const output = path.resolve(fileName);
      const relative = path.relative(emitDir, output);
      if (
        relative === "" ||
        relative.startsWith("..") ||
        path.isAbsolute(relative)
      )
        continue;
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, file.text);
      if (!/\.(?:js|jsx|mjs|cjs)$/i.test(output)) continue;
      const owner = physicalSource(file.sourceFileName);
      if (owner !== undefined) emittedSources[output] = [owner];
      else {
        emittedSources[output] = [];
        emittedSourceProofFailures[output] =
          file.sourceFileName === undefined
            ? "TypeScript reported no source for this output."
            : `The source TypeScript emitted this output from no longer resolves: ${JSON.stringify(file.sourceFileName)}.`;
      }
    }
    if (!props.checked && !DependencyBuildGeneration.emittedAnything(emitDir))
      throw failure(
        `ttsx: ${props.role} build produced no output for ${props.source}`,
        TypeScriptSyncApi.reportedDiagnostics(program),
      );
    return {
      project,
      rootDir:
        typeof assigned.rootDir === "string"
          ? assigned.rootDir
          : props.volumeRoot,
      emittedSources,
      emittedSourceProofFailures:
        Object.keys(emittedSourceProofFailures).length === 0
          ? undefined
          : emittedSourceProofFailures,
    };
  } finally {
    session.close();
  }
}

/** The native real path of an emitted output's source, if it still exists. */
function physicalSource(fileName: string | undefined): string | undefined {
  if (fileName === undefined) return undefined;
  try {
    return fs.realpathSync.native(path.resolve(fileName));
  } catch {
    return undefined;
  }
}
