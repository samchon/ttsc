import fs from "node:fs";
import path from "node:path";

import { runBuild } from "../../compiler/internal/build/runBuild";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../../compiler/internal/readEffectiveCompilerOptions";
import { createFilesystemPathIdentityContext } from "../../internal/pathIdentity/createFilesystemPathIdentityContext";
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
 * satisfy the second, so such a root is compiled here with the project's own
 * config and only its file list replaced. Two lanes need it: the launcher's
 * entry when the project build did not emit it, and a TypeScript file the
 * running program reaches that no build compiled (samchon/ttsc#1382).
 *
 * The config is parsed where it lives, so `${configDir}` is its own directory
 * and the default `typeRoots` and each `types` entry are looked up from there,
 * exactly as for the project. The file list is replaced in memory
 * ({@link RunBuildOptions.rootFiles}), and nothing is written beside the config:
 * an installed package's directory may be read-only, and a plugin descriptor's
 * inputs are fingerprinted by their directory's metadata.
 *
 * The overrides below are forwarded ahead of the caller's flags, so a flag the
 * user forwarded still wins over them, as it wins over the config.
 *
 * `rootDir` is the root of the source's volume. The layout of this emit is
 * private, so `rootDir` decides nothing here but whether a file of the program
 * fits under it, and every narrower choice fails some program: the project's
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
 * needs every file listed, and it would reject each import of the root with
 * TS6307, since only the root is listed. Declarations go with it: nothing at
 * run time reads them, and a `declarationMap` would otherwise fail with TS5069
 * once `composite` no longer implies `declaration`. An emit-only build also
 * switches `noEmitOnError` off, since it fails only on an empty output and a
 * configured `noEmitOnError` would turn any diagnostic into one.
 *
 * @returns The project the build compiled and the `rootDir` it was pinned to.
 * @throws When the build fails. A checked build fails on any diagnostic; an
 *   emit-only build fails only when it produced no JavaScript at all.
 */
export function buildSingleRootProject(props: {
  /** The root, in the physical spelling the runtime loads it by. */
  source: string;
  /** The owning `tsconfig.json`, whose options the root compiles with. */
  tsconfig: string;
  /** Directory the build runs in. */
  projectRoot: string;
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
}): { project: ReturnType<typeof readProjectConfig>; rootDir: string } {
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
  const project = readProjectConfig({
    cwd: props.projectRoot,
    projectRoot: options.projectRoot,
    tsconfig: props.tsconfig,
  });
  const passthrough = [
    "--composite",
    "false",
    "--declaration",
    "false",
    "--declarationMap",
    "false",
    ...(props.checked ? [] : ["--noEmitOnError", "false"]),
    "--rootDir",
    volumeRoot.replace(/\\/g, "/"),
    ...(options.passthrough ?? []),
  ];
  fs.mkdirSync(props.emitDir, { recursive: true });
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
    // the user's tree (samchon/ttsc#1404).
    isolateOutputsTo: props.emitDir,
    passthrough: runtimeCompilerArgs(project, passthrough, options.binary),
    // A source map on the transient emit lets the serve path inline it under
    // the source URL; a project that configures its own keeps it.
    forceRuntimeSourceMap: runtimeEmitProfile(
      project,
      passthrough,
      options.binary,
    ).forceRuntimeSourceMap,
    pluginConfigDir: options.pluginConfigDir,
    plugins: options.plugins,
    quiet: true,
    resolvedProject: project,
    rootFiles: [props.source],
    singleThreaded: options.singleThreaded,
    skipDiagnosticsCheck: !props.checked,
    tsconfig: project.path,
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
  // The root the compiler actually laid the outputs against: the volume root
  // forwarded above unless the caller forwarded another after it.
  const effective = readEffectiveCompilerOptions(
    project,
    passthrough,
    options.binary,
  )?.("rootDir");
  return {
    project,
    rootDir:
      typeof effective === "string"
        ? path.resolve(project.root, effective)
        : volumeRoot,
  };
}
