import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import type { TtscBuildOptions } from "../../../structures/internal/TtscBuildOptions";

/**
 * Options of one {@link runBuild} call: the public build options plus the knobs
 * only ttsc's own lanes set (ttsx's private runtime builds, single-file emit,
 * watch).
 *
 * @evidence contracts/common.md#principled-implementation Public build selection is intersected with internal lane controls, preserving optional defaults while distinguishing diagnostic gating, compiler-output isolation and watch callbacks.
 * @evidence contracts/common.md#clear-and-simple-design Lane-specific decisions are explicit options on the shared build boundary rather than hidden global switches or duplicated compiler APIs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Internal controls express supported runtime/watch requirements; source-map and inferred-root exceptions are documented lane policies, not test-specific escape flags.
 * @evidence contracts/common.md#meaningful-documentation Native member paragraphs explain ownership, optional-state effects and the rootDir premise, with blank lines separating documented properties.
 * @evidence contracts/portability.md#os-neutral-implementation The type carries native private-output/project selection and filesystem input callbacks without embedding slash, drive or case assumptions; process/path adapters interpret those values.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type RunBuildOptions = TtscBuildOptions & {
  /**
   * Skip the independent direct-compiler type-check gate and the added
   * `--noEmitOnError` guard. Configured plugin checks and native hosts still
   * apply their own diagnostic policy. It does not erase returned status or
   * make failed plugin checks successful. The ttsx dependency lane may judge
   * usable emitted output under its own policy and sets it because the
   * entry project's check is the type gate and a source-shipping dependency's
   * own config must not fail the run.
   */
  skipDiagnosticsCheck?: boolean;

  /**
   * Request `--listEmittedFiles` when the user did not ask for paths. Later
   * forwarded assignments can still override this internal default, and actual
   * producer output determines what is returned. Callers locating one emitted file
   * (ttsx, single-file emit) set it.
   */
  forceListEmittedFiles?: boolean;

  /**
   * Request the selected emitting producer's output-to-source provenance.
   * Native hosts must declare support; the external compiler adapter admits
   * only its documented layout and stable-observation subset. Missing, unknown
   * or ambiguous ownership stays explicit for a routing consumer to reject.
   *
   * This request must not change compiler selection, semantic options,
   * diagnostic policy or which files are emitted. It applies to the emitting
   * phase, not earlier checks or terminal/format operations without emission.
   */
  forceEmitProvenance?: boolean;

  /**
   * Apply final compiler destination overrides for this private directory.
   * This does not sandbox arbitrary plugin, cache or external process writes.
   */
  isolateOutputsTo?: string;

  /**
   * Hand tsgo the `rootDir` it would otherwise infer, for a build whose
   * `outDir` this process injected rather than the project declaring it.
   *
   * Tsgo answers an inferred common source directory with TS5011 the moment an
   * `outDir` is in play, so injecting one turns a project that declares no
   * output at all — the `noEmit` check-only shape `tsgo`, `ttsc`, and `ttsc
   * --emit` all accept — into one that must configure the layout of output the
   * user never asked for and never sees.
   *
   * Without declared rootDir, the pinned compiler's configured-program default
   * common source directory is the config file's directory; config-less
   * programs instead consult source filenames. This request supplies the
   * selected execution project root as the inferred-layout policy. It does not
   * independently prove that arbitrary explicit project-root/config placement
   * or physical aliases have identical layout. Callers own that premise.
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
   * when this internal callback is supplied, normally by watch launchers;
   * ordinary calls without the callback do not probe the optional sidecar command.
   */
  onProjectInputs?: (inputs: ITtscProjectInputSnapshot) => void;

  /**
   * Request an external source map in an emitting direct tsgo lane even when
   * the project configures none. Later forwarded sourceMap assignments can
   * override this default. Ttsx runtime builds use it to request a map for
   * inlining under the source URL. Applied only to
   * the plain tsgo emit — never forwarded to a native plugin host, whose own
   * emit honours the project's `sourceMap` setting.
   */
  forceRuntimeSourceMap?: boolean;

  /** Retain an already selected project's lexical identity across API lanes. */
  resolvedProject?: ITtscParsedProjectConfig;
};
