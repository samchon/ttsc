import fs from "node:fs";
import path from "node:path";

import { runBuild } from "../../compiler/internal/build/runBuild";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../../compiler/internal/readEffectiveCompilerOptions";
import { createFilesystemPathIdentityContext } from "../../internal/pathIdentity/createFilesystemPathIdentityContext";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { DependencyBuildGeneration } from "./runtime/DependencyBuildGeneration";
import { runtimeCompilerArgs } from "./runtimeCompilerArgs";

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
 * file the running program reaches that no build compiled (samchon/ttsc#1382).
 *
 * The synthesized tsconfig is written beside the real one on purpose. `extends`
 * with an absolute path would resolve from anywhere, but `${configDir}` and
 * `paths` are anchored to the directory of the config that consumes them, so
 * any other location silently retargets them. It is removed as soon as the
 * build returns.
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
 *
 * @returns The project the build compiled and the `rootDir` it was pinned to.
 * @throws When the build fails. A checked build fails on any diagnostic; an
 *   emit-only build fails only when it produced no JavaScript at all.
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
  const tsconfig = path.join(
    path.dirname(props.tsconfig),
    `.ttsx-${props.role}.${props.key}.tsconfig.json`,
  );
  fs.writeFileSync(
    tsconfig,
    JSON.stringify(
      {
        extends: props.tsconfig.replace(/\\/g, "/"),
        compilerOptions: {
          composite: false,
          declaration: false,
          declarationMap: false,
          rootDir: volumeRoot.replace(/\\/g, "/"),
        },
        // `files` alone does not displace an inherited `include`, and an
        // inherited `exclude` could drop the root back out of the program, so
        // both are overridden explicitly.
        files: [props.source.replace(/\\/g, "/")],
        include: [],
        exclude: [],
      },
      null,
      2,
    ),
    "utf8",
  );
  try {
    const project = readProjectConfig({
      cwd: props.projectRoot,
      projectRoot: options.projectRoot,
      tsconfig,
    });
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
      passthrough: runtimeCompilerArgs(
        project,
        options.passthrough,
        options.binary,
      ),
      // A source map on the transient emit lets the serve path inline it under
      // the source URL; a project that configures its own keeps it.
      forceRuntimeSourceMap:
        project.compilerOptions.sourceMap !== true &&
        project.compilerOptions.inlineSourceMap !== true,
      pluginConfigDir: options.pluginConfigDir,
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
    const effective = readEffectiveCompilerOptions(
      project,
      options.passthrough,
      options.binary,
    )?.("rootDir");
    return {
      project,
      rootDir:
        typeof effective === "string"
          ? path.resolve(project.root, effective)
          : volumeRoot,
    };
  } finally {
    try {
      fs.rmSync(tsconfig, { force: true });
    } catch {
      // Best effort: a leftover synthesized tsconfig must not mask a build
      // failure, and its name can never be mistaken for a real project config.
    }
  }
}
