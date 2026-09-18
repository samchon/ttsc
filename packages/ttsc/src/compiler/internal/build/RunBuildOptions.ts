import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildOptions } from "../../../structures/internal/TtscBuildOptions";

/**
 * Options of one {@link runBuild} call: the public build options plus the knobs
 * only ttsc's own lanes set (ttsx's private runtime builds, single-file emit,
 * watch).
 */
export type RunBuildOptions = TtscBuildOptions & {
  /**
   * Emit even when the project has type errors: no separate type-check pass
   * runs and `--noEmitOnError` is not added. The caller judges success by what
   * was written, not by the status. The ttsx dependency lane sets it, because
   * the entry project's check is the type gate and a source-shipping
   * dependency's own config must not fail the run.
   */
  skipDiagnosticsCheck?: boolean;
  /**
   * Pass `--listEmittedFiles` so the result carries the emitted paths even when
   * the user did not ask for them. Callers that must locate one emitted file
   * (ttsx, single-file emit) set it.
   */
  forceListEmittedFiles?: boolean;
  /** Keep every compiler-owned side product inside this private directory. */
  isolateOutputsTo?: string;
  /**
   * Hand tsgo the `rootDir` it would otherwise infer, for a build whose
   * `outDir` this process injected rather than the project declaring it.
   *
   * Tsgo answers an inferred common source directory with TS5011 the moment an
   * `outDir` is in play, so injecting one turns a project that declares no
   * output at all — the `noEmit` check-only shape `tsgo`, `ttsc`, and `ttsc
   * --emit` all accept — into one that must configure the layout of output the
   * user never asked for and never sees (issue #1172).
   *
   * The pinned value is the one tsgo itself infers: with a config file in play
   * its common source directory is that file's directory, never the computed
   * common directory of the input files (`outputpaths.GetCommonSourceDirectory`
   * consults the file list only for a config-less program). Pinning it
   * therefore silences the demand without moving a single output, and it is the
   * same source root `prepareExecution.ts::resolveRuntimeSourceRoot`,
   * `installRuntimeHooks.ts::resolveDependencySourceRoot`, and
   * `WatchTopology.ts::inferPerSourceCompilerOutputs` already model on the
   * JavaScript side.
   *
   * Ignored when the project declares its own `rootDir`: that project already
   * satisfies tsgo, and overriding it would relocate the emit out from under
   * every consumer that mirrors the declared root.
   *
   * Never set for a user-supplied `--outDir`. That outDir is the user's own
   * request, and TS5011 is then tsgo's genuine answer to it.
   */
  pinInferredRootDir?: boolean;
  /**
   * Receives selected native-plugin source roots after the project resolves.
   * The watch launcher uses these roots to invalidate a sidecar when its Go
   * implementation changes between rebuilds.
   */
  onWatchInputs?: (inputs: readonly string[]) => void;
  /**
   * Receives the reconciled project-rule filesystem dependency snapshot. Called
   * only by watch launchers; ordinary builds do not probe the optional sidecar
   * command.
   */
  onProjectInputs?: (inputs: ITtscProjectInputSnapshot) => void;
  /**
   * Emit an external source map from the direct tsgo build lane even when the
   * project configures none. Set by the ttsx runtime builds so a served emit
   * carries a map to inline under the source URL (issue #353). Applied only to
   * the plain tsgo emit — never forwarded to a native plugin host, whose own
   * emit honours the project's `sourceMap` setting.
   */
  forceRuntimeSourceMap?: boolean;
  /** Retain an already selected project's lexical identity across API lanes. */
  resolvedProject?: ITtscParsedProjectConfig;
};
