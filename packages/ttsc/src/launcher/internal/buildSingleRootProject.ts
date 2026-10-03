import fs from "node:fs";
import path from "node:path";

import { runBuild } from "../../compiler/internal/build/runBuild";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../../compiler/internal/readEffectiveCompilerOptions";
import { createFilesystemPathIdentityContext } from "../../internal/pathIdentity/createFilesystemPathIdentityContext";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { DependencyBuildGeneration } from "./runtime/DependencyBuildGeneration";
import { runtimeCompilerArgs } from "./runtimeCompilerArgs";
import { runtimeEmitProfile } from "./runtimeEmitProfile";

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
 * Where the synthesized tsconfig lives depends on what the build reads from its
 * location. `extends` with an absolute path resolves from anywhere, and every
 * relative option resolves against the config that declares it, but
 * `${configDir}` is substituted with the directory of the config tsgo was
 * given, and the default `typeRoots` and each `types` entry are looked up from
 * there. A checked build needs all of them exactly as the user's config sees
 * them, so its tsconfig is written beside the real one, and a directory that
 * refuses the write is reported by name. TypeScript-Go's command line cannot
 * combine a project with a file list, and ttsc ships no host that replaces a
 * project's roots in memory, so no other placement is faithful. An emit-only
 * build ignores diagnostics, and none of those lookups changes what it emits,
 * with one exception: `${configDir}` inside `paths` or `baseUrl` decides which
 * module an import resolves to, and so whether a re-exported name is elided as
 * a type. Unless its config chain uses `${configDir}`, an emit-only build's
 * tsconfig is written beside `emitDir` instead, because such a build runs while
 * the program is running, for an installed package whose directory may be
 * read-only or for a plugin descriptor whose inputs are fingerprinted by their
 * directory's metadata, and a file created and removed in the user's tree would
 * disturb both. The overlay is created exclusively: an occupied name is
 * refused without writing or removing that entry. After acquisition, closing
 * its descriptor and removing the overlay are attempted on success or failure;
 * native cleanup failures may leave the overlay behind.
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
 *
 * @throws When the build fails. A checked build fails on any diagnostic; an
 *   emit-only build fails only when it produced no JavaScript at all.
 *
 * @evidence contracts/common.md#principled-implementation A transient extends overlay changes only roots and runtime output constraints, while preserving configDir-sensitive anchors; effective rootDir is returned for output ownership rather than inferred from emitted filenames.
 * @evidence contracts/common.md#clear-and-simple-design This boundary owns single-root overlay construction and cleanup, delegates project parsing/building, and isolates writable-directory diagnostics in a private helper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Private emit layout, disabled declaration/composite products and checked versus installed-package diagnostics are runtime contract distinctions, not source patches or tests-only compiler modes.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain overlay placement, wide rootDir, diagnostics and cleanup, while separately documented input members preserve their ownership facts.
 * @evidence contracts/portability.md#os-neutral-implementation Shared filesystem identity selects the source volume from resolved native identity when available and retained spelling otherwise; overlay JSON converts only native separators, preserving literal POSIX backslashes. Public exclusive creation refuses an occupied overlay name without overwriting it; explicit compiler paths avoid shell interpolation and blanket case folding.
 * @evidence contracts/performance.md#efficient-algorithms Emit-only placement parses the config chain and scans its text for configDir anchors; checked placement skips that scan. Native identity resolution, overlay serialization/write, effective-options preparation and delegated compilation contribute path/input/output byte costs; this boundary performs no source-directory mirror or second whole-project compilation.
 * @evidence contracts/performance.md#reuse-equivalent-work One effective-options reader for this overlay and exact forwarded tokens is shared by runtime lowering, emit classification and rootDir selection, avoiding duplicate response-file compiler queries. Callers own sharing of completed build generations.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Exclusive open establishes ownership of one transient tsconfig and descriptor. The descriptor is closed before parsing; finally attempts any remaining close and removal after write, close, parse or build failure, without removing a failed-acquisition entry. Native cleanup failures may retain the overlay; caller owns emit storage and delegated build lifetimes.
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
  const beside =
    props.checked ||
    readProjectConfig({ tsconfig: props.tsconfig }).configPaths.some((file) =>
      fs.readFileSync(file, "utf8").includes("${configDir}"),
    );
  const tsconfig = path.join(
    beside ? path.dirname(props.tsconfig) : path.dirname(props.emitDir),
    `.ttsx-${props.role}.${props.key}.tsconfig.json`,
  );
  fs.mkdirSync(path.dirname(tsconfig), { recursive: true });
  let configDescriptor: number | undefined;
  let ownsConfig = false;
  try {
    try {
      configDescriptor = fs.openSync(tsconfig, "wx");
      ownsConfig = true;
      fs.writeFileSync(
        configDescriptor,
        JSON.stringify(
          {
            extends: props.tsconfig.replaceAll(path.sep, "/"),
            compilerOptions: {
              composite: false,
              declaration: false,
              declarationMap: false,
              ...(props.checked ? {} : { noEmitOnError: false }),
              rootDir: volumeRoot.replaceAll(path.sep, "/"),
            },
            // `files` alone does not displace an inherited `include`, and an
            // inherited `exclude` could drop the root back out of the program,
            // so both are overridden explicitly.
            files: [props.source.replaceAll(path.sep, "/")],
            include: [],
            exclude: [],
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
      // A tsconfig outside the project would otherwise make its own private
      // directory the project root.
      projectRoot:
        options.projectRoot ?? (beside ? undefined : props.projectRoot),
      tsconfig,
    });
    fs.mkdirSync(props.emitDir, { recursive: true });
    const effectiveOptions = readEffectiveCompilerOptions(
      project,
      options.passthrough,
      options.binary,
    );
    const result = runBuild({
      binary: options.binary,
      checkers: options.checkers,
      cwd: props.projectRoot,
      emit: true,
      env: options.env,
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
      pluginConfigDir:
        options.pluginConfigDir ??
        (beside ? undefined : path.dirname(props.tsconfig)),
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
          result.stderr || result.stdout,
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
    if (ownsConfig) {
      try {
        fs.rmSync(tsconfig, { force: true });
      } catch {
        // Best effort: native cleanup failure can leave this overlay behind.
      }
    }
  }
}

/**
 * The error for a synthesized tsconfig the filesystem refused, naming the
 * directory and what to do instead of surfacing a bare `EPERM`. Any other
 * failure is returned unchanged.
 *
 * TypeScript-Go's command line cannot combine a project with a file list, so a
 * build that must read the anchors of a tsconfig from its own directory needs a
 * tsconfig in that directory. A read-only checkout, mount, or volume refuses
 * it.
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
      "The file is outside that project's file set, and ttsx compiles it through a temporary tsconfig placed beside the project's own for the length of the build.",
      `Make the directory writable, or add the file to the project's "include" or "files".`,
    ].join("\n"),
  );
}
