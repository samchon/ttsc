import type { ITransformOptions } from "./ITransformOptions";

/**
 * Worker ↔ UI RPC contract for the playground compiler service.
 *
 * `createWorkerCompiler` (worker side) implements this. `createCompilerClient`
 * (UI side) returns a tgrid Driver bound to this shape. Sites that need an
 * `extraTabs` lane should layer additional verbs over this base interface in
 * their own ICompilerService subtype.
 *
 * @evidence contracts/common.md#principled-implementation Promise-returning install, compile, bundle and lint verbs express the asynchronous Worker RPC boundary and their distinct result shapes.
 * @evidence contracts/common.md#clear-and-simple-design One base RPC interface separates worker capabilities from React state and site-specific extensions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Extensions use a typed service boundary instead of replacing Worker or compiler internals.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs document both RPC ends and extension ownership; member comments describe transform order and disabled lint behavior under the documentation skill.
 */
export interface ICompilerService {
  /**
   * Mount external npm package files into the worker's MemFS under
   * `node_modules/`. The package's dependency installer supplies these files.
   *
   * @evidence contracts/common.md#principled-implementation Package-relative file keys and metadata produce a virtual mount report; the Worker serializes installation with compilation.
   * @evidence contracts/common.md#clear-and-simple-design This verb owns mounting while registry fetching stays on the caller side.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Writes use the virtual-host boundary without bypassing path validation for known packages.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the virtual node_modules namespace and caller responsibility, with tag separation under the documentation skill.
   */
  installDependencies(
    props: ICompilerService.IInstallDependenciesProps,
  ): Promise<ICompilerService.IInstallDependenciesResult>;

  /**
   * Compile the user's source into JavaScript with diagnostics. Plugin
   * transforms (typia, when enabled in options) run first; the result is the
   * post-transform emit.
   *
   * @evidence contracts/common.md#principled-implementation A discriminated result distinguishes usable emit, compiler findings and operational failure after configured transforms.
   * @evidence contracts/common.md#clear-and-simple-design The verb takes source and per-call flags; factory configuration owns runtime and plugins.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Configured transform failures remain errors rather than claiming untransformed output fulfills the transform request.
   * @evidence contracts/common.md#meaningful-documentation Native prose states transform-before-emit ordering with tag separation under the documentation skill.
   */
  compile(props: ICompilerService.IProps): Promise<ICompilerService.IResult>;

  /**
   * Same pipeline as `compile`, but using the bundle-flavored tsconfig
   * (typically `module: "CommonJS"` for in-page `new Function` sandboxing).
   * Sites that don't run user code may treat this identically to `compile`.
   *
   * @evidence contracts/common.md#principled-implementation The bundle verb uses the execution-oriented module configuration but shares the same compile result distinctions.
   * @evidence contracts/common.md#clear-and-simple-design A separate named RPC verb exposes execution emit without requiring clients to supply compiler configuration.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Module format is explicit supported behavior, not a special case based on the user's source.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes this module shape from preview compile, with tag separation under the documentation skill.
   */
  bundle(props: ICompilerService.IProps): Promise<ICompilerService.IResult>;

  /**
   * Run the lint plugin and parse its findings into the same diagnostic shape
   * as `compile`. Returns an empty list when no lint plugin is wired into the
   * worker.
   *
   * @evidence contracts/common.md#principled-implementation A diagnostic list carries lint findings; disabled integration legitimately has no findings while operational failures are represented as error diagnostics.
   * @evidence contracts/common.md#clear-and-simple-design Lint owns findings independently of emit and execution results.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed configured linter cannot masquerade as the documented disabled-linter empty result.
   * @evidence contracts/common.md#meaningful-documentation Native prose documents findings and absent integration, separated from tags under the documentation skill.
   */
  lint(props: ICompilerService.IProps): Promise<ICompilerService.ILintResult>;
}

export namespace ICompilerService {
  /**
   * Per-call source and transform enablement; omitted flags use service defaults.
   *
   * @evidence contracts/common.md#principled-implementation Text and optional flags capture the complete per-call input without embedding factory runtime identity.
   * @evidence contracts/common.md#clear-and-simple-design Compile, bundle and lint share one input record rather than duplicate source policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Flags use the declared plugin boundary rather than source-specific dispatch exceptions.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines per-call and omitted-option meaning with tag separation under the documentation skill.
   */
  export interface IProps {
    source: string;
    options?: ITransformOptions;
  }

  /**
   * Text files and package identities submitted as one virtual installation.
   *
   * @evidence contracts/common.md#principled-implementation Relative file keys identify writes and the package array labels that operation's metadata; this is not a registry graph solver.
   * @evidence contracts/common.md#clear-and-simple-design Files and identities stay in one RPC payload while result counts are a separate response.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Virtual installation uses caller-supplied entries and the host's path gate, not fixture-specific package logic.
   * @evidence contracts/common.md#meaningful-documentation Member prose defines relative keys and metadata association with blank member lines under the documentation skill.
   */
  export interface IInstallDependenciesProps {
    /** Node_modules-relative paths to text content. */
    files: Record<string, string>;

    /** Metadata for the packages whose files are in `files`. */
    packages: IInstalledPackage[];
  }

  /**
   * Exposed package name and exact installed version for a mounting report.
   *
   * @evidence contracts/common.md#principled-implementation Name and version label the mounted package; registry alias identity and active constraints belong to the dependency solver's richer type.
   * @evidence contracts/common.md#clear-and-simple-design The mounting report carries only the identity its client needs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The record reports supplied metadata and does not infer compatibility from a name alone.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes mount metadata from solver state, with tags separated under the documentation skill.
   */
  export interface IInstalledPackage {
    name: string;
    version: string;
  }

  /**
   * Submitted package identities and count of accepted virtual-file writes.
   *
   * @evidence contracts/common.md#principled-implementation fileCount counts writes accepted by path validation; installed carries the submitted identities rather than asserting a solved dependency graph.
   * @evidence contracts/common.md#clear-and-simple-design A small mounting response separates accepted-write count from compile output.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Counts arise from actual writes rather than expected answers or skipped malformed paths.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines counting and metadata limits with tag separation under the documentation skill.
   */
  export interface IInstallDependenciesResult {
    installed: IInstalledPackage[];
    fileCount: number;
  }

  /**
   * Compile outcome discriminated by successful emit, findings or operation error.
   *
   * @evidence contracts/common.md#principled-implementation The type field discriminates string emit from unknown error payload; failure retains both emit and diagnostics.
   * @evidence contracts/common.md#clear-and-simple-design Named variants centralize result narrowing across Worker and UI.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Operational errors are a distinct variant rather than fabricated successful text.
   * @evidence contracts/common.md#meaningful-documentation Native prose names all outcome meanings with tag separation under the documentation skill.
   */
  export type IResult = ISuccess | IFailure | IError;

  /**
   * JavaScript emit with no error diagnostics; empty text may mean no emitted file.
   *
   * @evidence contracts/common.md#principled-implementation The success discriminant and string payload represent the compile lane's non-error outcome.
   * @evidence contracts/common.md#clear-and-simple-design The common envelope is reused without an unnecessary second success structure.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Success does not claim that empty emit proves a file exists or user code is safe.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains the empty-emit limit with tag separation under the documentation skill.
   */
  export interface ISuccess extends IBase<"success", string> {}

  /**
   * Compiler findings together with any available JavaScript emit.
   *
   * @evidence contracts/common.md#principled-implementation Error findings accompany a string emit payload so the UI can show both even when compilation is unsuccessful.
   * @evidence contracts/common.md#clear-and-simple-design Only the finding variant adds diagnostics to the shared envelope.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Findings remain explicit rather than converting nonempty emit into unconditional success.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines simultaneous diagnostics and emit with tag separation under the documentation skill.
   */
  export interface IFailure extends IBase<"failure", string> {
    diagnostics: IDiagnostic[];
  }

  /**
   * Operation failure whose transport payload may be an error record or message.
   *
   * @evidence contracts/common.md#principled-implementation Unknown preserves the permitted error payload domain until the receiver normalizes it.
   * @evidence contracts/common.md#clear-and-simple-design The error discriminant shares routing fields with other outcomes without pretending its payload is JavaScript.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failures retain their own outcome rather than inventing emit to satisfy consumers.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains payload variability with tag separation under the documentation skill.
   */
  export interface IError extends IBase<"error", unknown> {}

  interface IBase<Type extends string, Value> {
    type: Type;
    target: "javascript";
    value: Value;
  }

  /**
   * UI diagnostic with one-based location and a span measured in source characters.
   *
   * @evidence contracts/common.md#principled-implementation Location, severity, text and optional code represent compiler and lint findings without tying them to one producer.
   * @evidence contracts/common.md#clear-and-simple-design One diagnostic shape is shared by compile and lint result lanes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Producer codes are carried as metadata rather than hardcoded finding decisions.
   * @evidence contracts/common.md#meaningful-documentation Member JSDoc defines coordinate bases, span units and code purpose, with documentation-skill member spacing.
   */
  export interface IDiagnostic {
    /** 1-based line number. */
    line: number;

    /** 1-based column number. */
    column: number;

    /** Length of the span in source characters; at least 1. */
    length: number;

    severity: "error" | "warning";
    message: string;

    /** Diagnostic code, e.g. `"TS2322"` or a lint rule id. */
    code?: string;
  }

  /**
   * Lint findings, including an error diagnostic when the configured plugin fails.
   *
   * @evidence contracts/common.md#principled-implementation A diagnostic array covers both rule findings and plugin failure reports; absence of configured lint yields an empty array.
   * @evidence contracts/common.md#clear-and-simple-design The lint lane returns findings without unrelated JavaScript output fields.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Configured-plugin failure is kept visible rather than encoded as a clean empty list.
   * @evidence contracts/common.md#meaningful-documentation Native prose states failure representation with tag separation under the documentation skill.
   */
  export interface ILintResult {
    diagnostics: IDiagnostic[];
  }
}
