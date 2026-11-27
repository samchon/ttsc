import fs from "node:fs";
import path from "node:path";

import { BuildExecution } from "../../compiler/internal/build/BuildExecution";
import { PassthroughFlags } from "../../compiler/internal/build/PassthroughFlags";
import { runBuild } from "../../compiler/internal/build/runBuild";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../../compiler/internal/readEffectiveCompilerOptions";
import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { PRIVATE_CONFIG_OVERLAY_ENV } from "../../compiler/internal/sharedHost/PRIVATE_CONFIG_OVERLAY_ENV";
import { SidecarEnvironment } from "../../compiler/internal/sharedHost/SidecarEnvironment";
import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import { createFilesystemPathIdentityContext } from "../../internal/pathIdentity/createFilesystemPathIdentityContext";
import { systemTempOutsideProject } from "../../internal/systemTempOutsideProject";
import { hasProjectPluginEntries } from "../../plugin/internal/load/hasProjectPluginEntries";
import { SourceBuildCacheLayout } from "../../plugin/internal/source/SourceBuildCacheLayout";
import { isPathWithin } from "../../plugin/internal/source/isPathWithin";
import { resolveSourceBuildCachePaths } from "../../plugin/internal/source/resolveSourceBuildCachePaths";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { buildSingleRootInMemory } from "./buildSingleRootInMemory";
import { DependencyBuildGeneration } from "./runtime/DependencyBuildGeneration";
import { runtimeCompilerArgs } from "./runtimeCompilerArgs";
import { runtimeEmitProfile } from "./runtimeEmitProfile";
import { singleRootProjectConfig } from "./singleRootProjectConfig";

/**
 * Compile one TypeScript root that its owning project's file set does not
 * contain, with every compiler option of that project.
 *
 * `ttsc` selects a _file set_: a project whose `include` is `src` must emit
 * only `src` into `outDir`, and a `clear.ts`, a `build/release.ts`, or a
 * `lint.config.ts` beside the tsconfig has no business in `lib`. `ttsx` needs
 * that project's compiler options for a file it runs, not its file list. Those
 * two requirements are not in conflict, but the whole-project build cannot
 * satisfy the second, so such a root is compiled here through a project that
 * inherits every option and declares only the root. Two lanes need it: the
 * launcher's entry when the project build did not emit it, and a TypeScript
 * file the running program reaches that no build compiled.
 *
 * TypeScript 7.1 can hold the overlay beside the real config in memory.
 * `buildSingleRootInMemory` takes that route first. The command-line fallback
 * needs a config file to combine an exact file list with project options. For a
 * checked root it uses a cache below the owning config directory whose
 * intervening directories add no dependency installations. When that layout is
 * unavailable, the project compiler can read the wrapper through a VFS view
 * beside the original config on its plugin-free snapshot route. Other compilers
 * use a private mirror of the original dependency search. The emit-only lane
 * uses its private output directory. Inherited `${configDir}` compiler paths
 * retain their owner, and the temporary file is created exclusively and removed
 * after the build.
 *
 * `rootDir` is the root of the source's volume. The layout of this emit is
 * private, so `rootDir` decides nothing here but whether a file of the program
 * fits under it, and every narrower choice fails some program: the inherited
 * `rootDir` (`src`) does not contain the root, and a root that imports a
 * sibling package's source reaches outside any ancestor it shares with the
 * project. A file outside `rootDir` is TS6059 in a checked build and, in an
 * emit-only one, an output written beside the user's `.ts`. The caller finds
 * the output through `EmitOwnershipIndex` against the returned `rootDir`, so
 * the width costs nothing in precision. A `--rootDir` forwarded on the command
 * line still wins, as it does in every build, and the returned `rootDir` is
 * then that one.
 *
 * `composite` is switched off. It exists for `tsc -b`, whose project graph
 * needs every file listed, and inherited here it would reject each import of
 * the root with TS6307, since only the root is listed. Declarations go with it:
 * nothing at run time reads them, and an inherited `declarationMap` would
 * otherwise fail with TS5069 once `composite` no longer implies `declaration`.
 * An emit-only build also switches `noEmitOnError` off, since it fails only on
 * an empty output and an inherited `noEmitOnError` would turn any diagnostic
 * into one.
 *
 * @returns The project, effective `rootDir` and compiler-owned source
 *   provenance for actual written outputs. Missing provenance is not
 *   synthesized from maps.
 * @throws When the build fails. A checked build fails on any diagnostic; an
 *   emit-only build fails only when it produced no JavaScript at all.
 * @evidence contracts/common.md#principled-implementation The in-memory API route is tried first and owns its own admission. The transient extends overlay keeps configDir-sensitive anchors and starts its type search below the owning directory, through the plugin-free native VFS, or through a private mirror of the original ancestor dependencies. Effective rootDir is returned for output ownership rather than inferred from emitted filenames.
 * @evidence contracts/common.md#clear-and-simple-design This boundary selects the in-memory route when it is available and otherwise owns single-root overlay construction and cleanup, delegates project parsing/building, and isolates writable-directory diagnostics in a private helper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Private emit layout, disabled declaration/composite products and checked versus installed-package diagnostics are runtime contract distinctions, not source patches or tests-only compiler modes.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the in-memory route and when it is unavailable, overlay placement, wide rootDir, diagnostics and cleanup, while separately documented input members preserve their ownership facts.
 * @evidence contracts/portability.md#os-neutral-implementation Shared filesystem identity selects the source volume from resolved native identity when available and retained spelling otherwise. Normal overlay placement compares a physical cache path against the physically resolved config directory. Overlay JSON converts only native separators, preserving literal POSIX backslashes. Exclusive creation refuses occupied names, and explicit compiler paths avoid shell interpolation.
 * @evidence contracts/performance.md#efficient-algorithms An admitted in-memory build uses one API session. The command-line route parses the original chain and restates the path options before parsing its overlay. The mirror checks original and candidate ancestry for dependency directories, then allocates one directory and at most one dependency link per original ancestor. Identity, serialization, effective-options preparation and compilation contribute path/input/output byte costs.
 * @evidence contracts/performance.md#reuse-equivalent-work One effective-options reader for this overlay and exact forwarded tokens is shared by runtime lowering, emit classification and rootDir selection, avoiding duplicate response-file compiler queries. Callers own sharing of completed build generations.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Exclusive open establishes ownership of one transient tsconfig and descriptor. The descriptor is closed before parsing. Failure and final cleanup attempt to retire the acquired overlay or its owning private mirror and links, including on partial mirror creation. Cleanup errors can leave those artifacts; the caller owns emit storage and delegated build lifetimes.
 */
export function buildSingleRootProject(props: {
  /** The root, in the physical spelling the runtime loads it by. */
  source: string;

  /** The owning `tsconfig.json`, whose options the root inherits. */
  tsconfig: string;

  /** Directory the build runs in. */
  projectRoot: string;

  /** Directory-safe token, unique per concurrent build of one tsconfig. */
  key: string;

  /** Where the JavaScript goes. The directory must be private to this build. */
  emitDir: string;

  /**
   * Whether diagnostics stop the build. A root of the user's program is
   * checked; a root inside an installed package is emit-only, matching the
   * policy for every other file of that package.
   */
  checked: boolean;

  /** Names the root in a failure: `entry` for the launcher's own entry. */
  role: "entry" | "root";

  /** Build options forwarded to `runBuild`. */
  options?: TtscCommonOptions & { cacheDir?: string };
}): {
  /** Parsed overlay project whose compiler options governed this build. */
  project: ReturnType<typeof readProjectConfig>;

  /** Effective native layout root, including any forwarded rootDir override. */
  rootDir: string;

  /** Actual written output to compile-time source ledger; absent means unknown. */
  emittedSources?: TtscBuildResult["emittedSources"];

  /** Actual output-specific proof refusal context, independent of diagnostics. */
  emittedSourceProofFailures?: TtscBuildResult["emittedSourceProofFailures"];
} {
  const options = props.options ?? {};
  // `source` already carries the one spelling the runtime decided on. tsgo
  // compares it against `rootDir` textually — `GetCommonSourceDirectory` takes
  // `rootDir` verbatim and `ContainsPath` is lexical — so a mismatch here is
  // not a near miss: the file counts as outside `rootDir`, and tsgo emits it to
  // its own source path with the extension changed instead of under `outDir`,
  // writing a `.js` and its map beside the user's `.ts` where nothing cleans
  // them up.
  const volumeRoot = path.parse(
    createFilesystemPathIdentityContext({
      throwOnRealpathError: false,
    }).resolve(props.source).path,
  ).root;
  const inMemory = buildSingleRootInMemory({ ...props, options, volumeRoot });
  if (inMemory !== undefined) return inMemory;
  const templateOptions: Record<string, unknown> = {};
  const original = readProjectConfig(
    {
      cwd: props.projectRoot,
      projectRoot: options.projectRoot,
      tsconfig: props.tsconfig,
    },
    templateOptions,
  );
  const configDir = path.dirname(original.path);
  const localModules = path.join(configDir, "node_modules");
  const privateDirectory = path.dirname(props.emitDir);
  let fallbackDirectory: string | undefined;
  let virtualConfig = false;
  const acquire = (directory: string) => {
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(
      directory,
      `.ttsx-${props.role}.${props.key}.tsconfig.json`,
    );
    return { file, descriptor: fs.openSync(file, "wx") };
  };
  let placement: ReturnType<typeof acquire> | undefined;
  let attemptedDirectory = privateDirectory;
  try {
    if (props.checked) {
      attemptedDirectory =
        fs.lstatSync(localModules, { throwIfNoEntry: false }) === undefined
          ? resolveSourceBuildCachePaths(configDir, undefined, {}).root
          : SourceBuildCacheLayout.defaultWorkspaceCachePath(
              path.join(localModules, ".cache", "ttsc"),
            );
    }
    if (
      !props.checked ||
      preservesConfigTypeSearch(attemptedDirectory, configDir)
    )
      placement = acquire(attemptedDirectory);
  } catch (error) {
    if (!props.checked || !SourceBuildCacheLayout.refusesDefaultPath(error))
      throw unwritableConfigDirectory(error, props, attemptedDirectory);
  }
  if (placement === undefined) {
    try {
      fs.mkdirSync(privateDirectory, { recursive: true });
      const tsgo = resolveTsgo({
        cwd: original.root,
        binary: options.binary,
        env: SidecarEnvironment.merge(process.env, options.env),
      });
      virtualConfig =
        BuildExecution.isProjectCompiler(original.root, tsgo, options.env) &&
        !PassthroughFlags.forwardsTerminalTsgoFlag(options) &&
        !hasProjectPluginEntries(
          original,
          options.plugins,
          options.pluginConfigDir,
        );
      const owners = virtualConfig ? undefined : configAncestors(configDir);
      fallbackDirectory = allocatePrivateConfigDirectory(
        privateDirectory,
        original.root,
        configDir,
        owners,
      );
      placement = acquire(
        owners === undefined
          ? fallbackDirectory
          : mirrorTypeSearchPath(owners, fallbackDirectory),
      );
    } catch (fallbackError) {
      removePrivateConfigDirectory(fallbackDirectory);
      throw unwritableConfigDirectory(fallbackError, props, privateDirectory);
    }
  }
  const tsconfig = placement.file;
  let configDescriptor: number | undefined = placement.descriptor;
  try {
    try {
      const config = singleRootProjectConfig({
        tsconfig: original.path,
        source: props.source,
        volumeRoot,
        checked: props.checked,
      });
      fs.writeFileSync(
        configDescriptor,
        JSON.stringify(
          {
            ...config,
            compilerOptions: { ...templateOptions, ...config.compilerOptions },
          },
          null,
          2,
        ),
        "utf8",
      );
      fs.closeSync(configDescriptor);
      configDescriptor = undefined;
    } catch (error) {
      throw unwritableConfigDirectory(error, props, path.dirname(tsconfig));
    }
    const project = readProjectConfig({
      cwd: props.projectRoot,
      projectRoot: original.root,
      tsconfig,
    });
    fs.mkdirSync(props.emitDir, { recursive: true });
    const effectiveOptions = readEffectiveCompilerOptions(
      project,
      options.passthrough,
      options.binary,
      SidecarEnvironment.merge(process.env, options.env),
    );
    const result = runBuild({
      binary: options.binary,
      checkers: options.checkers,
      cwd: props.projectRoot,
      emit: true,
      env: virtualConfig
        ? SidecarEnvironment.merge(options.env, {
            [PRIVATE_CONFIG_OVERLAY_ENV]: JSON.stringify([
              project.path,
              original.path,
            ]),
          })
        : options.env,
      cacheDir: options.cacheDir,
      outDir: props.emitDir,
      // Every output this build writes stays in ttsx's private directory: a
      // declared `declarationDir`, `tsBuildInfoFile`, or `outFile`, and any
      // output location forwarded on the command line, would otherwise land in
      // the user's tree.
      isolateOutputsTo: props.emitDir,
      passthrough: runtimeCompilerArgs(
        project,
        options.passthrough,
        options.binary,
        effectiveOptions,
      ),
      // A source map on the transient emit lets the serve path inline it under
      // the source URL; a project that configures its own keeps it.
      forceRuntimeSourceMap: runtimeEmitProfile(
        project,
        options.passthrough,
        options.binary,
        effectiveOptions,
      ).forceRuntimeSourceMap,
      forceEmitProvenance: true,
      // Native plugins discover their config files from the tsconfig's
      // directory, which for a private tsconfig is ttsx's cache; anchor them
      // at the real one, as a bundler adapter's temporary overlay does.
      pluginConfigDir: options.pluginConfigDir ?? configDir,
      plugins: options.plugins,
      quiet: true,
      resolvedProject: project,
      singleThreaded: options.singleThreaded,
      skipDiagnosticsCheck: !props.checked,
      tsconfig,
    });
    // An emit-only build reports its diagnostics through the exit status even
    // though it wrote the JavaScript, so only an empty output fails it — the
    // same rule the dependency lane applies to the package's other files.
    const failed = props.checked
      ? result.status !== 0
      : !DependencyBuildGeneration.emittedAnything(props.emitDir);
    if (failed) {
      throw new Error(
        [
          props.checked
            ? `ttsx: ${props.role} check failed for ${props.source}`
            : `ttsx: ${props.role} build produced no output for ${props.source}`,
          result.stderr ||
            result.stdout ||
            result.diagnostics
              .map((diagnostic) => {
                const code =
                  typeof diagnostic.code === "number"
                    ? `TS${diagnostic.code}`
                    : diagnostic.code;
                const position =
                  diagnostic.file === null
                    ? ""
                    : `${diagnostic.file}${diagnostic.line === undefined ? "" : `(${diagnostic.line},${diagnostic.character ?? 1})`}: `;
                return `${position}${diagnostic.category} ${code}: ${diagnostic.messageText}`;
              })
              .join("\n"),
        ]
          .filter((line) => line.trim().length !== 0)
          .join("\n"),
      );
    }
    // The root the compiler actually laid the outputs against: the one written
    // above unless the command line forwarded another.
    const effective = effectiveOptions?.("rootDir");
    return {
      emittedSources: result.emittedSources,
      emittedSourceProofFailures: result.emittedSourceProofFailures,
      project,
      rootDir:
        typeof effective === "string"
          ? path.resolve(project.root, effective)
          : volumeRoot,
    };
  } finally {
    if (configDescriptor !== undefined) {
      try {
        fs.closeSync(configDescriptor);
      } catch {
        // Preserve the write or close failure that reached this cleanup.
      }
    }
    if (fallbackDirectory !== undefined)
      removePrivateConfigDirectory(fallbackDirectory);
    else {
      try {
        fs.unlinkSync(tsconfig);
      } catch {
        // Preserve the result when cleanup of the acquired overlay fails.
      }
    }
  }
}

/** Keep the original dependency search when placing a wrapper on disk. */
function preservesConfigTypeSearch(
  directory: string,
  configDir: string,
): boolean {
  const owner = fs.realpathSync.native(configDir);
  if (!isPathWithin(directory, owner)) return false;
  for (
    let candidate = directory;
    path.relative(owner, candidate) !== "";
    candidate = path.dirname(candidate)
  ) {
    if (dependencyDirectory(candidate) !== undefined) return false;
  }
  return true;
}

/**
 * Give a compiler reading from disk the owning config's node_modules search
 * order. The private config inherits the original options. Native type
 * discovery follows the mirrored dependency directories for automatic discovery
 * of `@types` and explicitly named packages.
 */
function mirrorTypeSearchPath(
  owners: readonly string[],
  privateRoot: string,
): string {
  let mirror = privateRoot;
  for (const ancestor of owners) {
    mirror = path.join(mirror, "p");
    fs.mkdirSync(mirror);
    const target = dependencyDirectory(ancestor);
    if (target !== undefined)
      fs.symlinkSync(
        target,
        path.join(mirror, "node_modules"),
        process.platform === "win32" ? "junction" : "dir",
      );
  }
  return mirror;
}

/** Choose a private parent whose ancestors introduce no new dependencies. */
function allocatePrivateConfigDirectory(
  runDirectory: string,
  projectRoot: string,
  configDir: string,
  owners: readonly string[] | undefined,
): string {
  const original = new Set(owners);
  const accepts = (directory: string): boolean =>
    owners === undefined ||
    configAncestors(directory).every(
      (ancestor) =>
        original.has(ancestor) || dependencyDirectory(ancestor) === undefined,
    );
  const prefix = ".ttsx-config-";
  const run = fs.realpathSync.native(runDirectory);
  let refusal: unknown;
  const allocate = (directory: string): string | undefined => {
    if (!accepts(directory)) return undefined;
    try {
      return createCanonicalTempDirectory(prefix, directory);
    } catch (error) {
      if (!SourceBuildCacheLayout.refusesDefaultPath(error)) throw error;
      refusal ??= error;
      return undefined;
    }
  };
  const local = allocate(run);
  if (local !== undefined) return local;
  for (const { directory } of systemTempOutsideProject.candidates(projectRoot, [
    configDir,
    process.cwd(),
  ])) {
    if (directory === run) continue;
    const fallback = allocate(directory);
    if (fallback !== undefined) return fallback;
  }
  throw (
    refusal ??
    new Error(
      `ttsx: no private config directory preserves the type search of ${configDir}`,
    )
  );
}

/** The native dependency search starts at the config and walks to its root. */
function configAncestors(configDir: string): string[] {
  const ancestors: string[] = [];
  for (let directory = configDir; ; ) {
    ancestors.push(directory);
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return ancestors.reverse();
}

/** Resolve a present dependency directory without creating one. */
function dependencyDirectory(ancestor: string): string | undefined {
  try {
    const target = fs.realpathSync.native(path.join(ancestor, "node_modules"));
    return fs.statSync(target).isDirectory() ? target : undefined;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
    return undefined;
  }
}

/** Retire the owned mirror and its directory links after compilation. */
function removePrivateConfigDirectory(directory: string | undefined): void {
  if (directory === undefined) return;
  try {
    fs.rmSync(directory, { recursive: true });
  } catch {
    // Preserve the compiler result or acquisition failure.
  }
}

/**
 * The error for a synthesized tsconfig the filesystem refused, naming the
 * directory and what to do instead of surfacing a bare `EPERM`. Any other
 * failure is returned unchanged.
 *
 * The command-line build requires a private file for its selected root.
 */
function unwritableConfigDirectory(
  error: unknown,
  props: { source: string; tsconfig: string },
  directory: string,
): unknown {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code !== "EACCES" && code !== "EPERM" && code !== "EROFS") return error;
  return new Error(
    [
      `ttsx: cannot compile ${props.source} with the options of ${props.tsconfig}: ${directory} is not writable (${code}).`,
      "The file is outside that project's file set. ttsx requires writable private storage to pass the selected root to this compiler.",
      `Make the directory writable, or add the file to the project's "include" or "files".`,
      "With TypeScript 7.1 or later, a build without native plugins, a custom compiler or a response file compiles it in memory instead.",
    ].join("\n"),
  );
}
