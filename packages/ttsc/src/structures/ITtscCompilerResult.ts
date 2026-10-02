import type { ITtscCompilerDiagnostic } from "./ITtscCompilerDiagnostic";

/**
 * Result of a ttsc TypeScript-Go compilation operation.
 *
 * Represents the possible outcomes of {@link TtscCompiler.compile}, which can be
 * either a successful compilation, a compilation that completed with
 * diagnostics, or an unexpected host error during the compilation process.
 *
 * This type follows the legacy `embed-typescript` result model, but stores all
 * emitted text artifacts in {@link ITtscCompilerResult.ISuccess.output} and
 * {@link ITtscCompilerResult.IFailure.output}. TypeScript-Go may emit
 * JavaScript, declaration files, source maps, and declaration maps from one
 * compile operation, so the public result is not limited to JavaScript.
 *
 * @author Jeongho Nam - https://github.com/samchon
 *
 * @evidence contracts/common.md#principled-implementation The type discriminant separates completed success, completed failure and host exception; emitted text remains available on completed outcomes even when diagnostics prevent success.
 * @evidence contracts/common.md#clear-and-simple-design Three named variants let callers narrow required output, diagnostics and finite error descriptions without interpreting process text.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Variant literals are API states; neither known diagnostic codes nor plugin names substitute for the compiler outcome.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc distinguishes text emit from source transformation and documents each variant and artifact map; paragraphs, member spacing and tag separation follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidence contracts/portability.md#os-neutral-implementation Completed variants carry slash-separated project-relative or absolute output keys, and diagnostics retain the producer's native file paths and coordinate conventions.
 */
export type ITtscCompilerResult =
  | ITtscCompilerResult.ISuccess
  | ITtscCompilerResult.IFailure
  | ITtscCompilerResult.IException;

export namespace ITtscCompilerResult {
  /**
   * Represents a successful ttsc compilation result.
   *
   * This interface is returned when the operation exits successfully without
   * error diagnostics. Non-fatal diagnostics may still be present. It contains
   * every text output captured from the native compiler host's `WriteFile`
   * callback.
   *
   * @evidence contracts/common.md#principled-implementation Success carries captured outputs and optional non-error findings, matching the result mapper's zero status and absence of error-category diagnostics.
   * @evidence contracts/common.md#clear-and-simple-design Required output and optional diagnostics keep a successful operation's payload directly accessible after discriminant narrowing.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The success literal describes the operation's result; output entries are captured artifacts rather than expected-answer placeholders.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states that success can retain non-fatal diagnostics and identifies all text artifact kinds; separate paragraphs and member/tag spacing follow the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidence contracts/portability.md#os-neutral-implementation Output keys normalize native separators to slashes while preserving the capture lane's relative or absolute spelling; optional diagnostics retain native producer paths and coordinate conventions.
   */
  export interface ISuccess {
    /** Indicates that the compilation was successful. */
    type: "success";

    /** Non-fatal diagnostics reported during compilation. */
    diagnostics?: ITtscCompilerDiagnostic[];

    /**
     * The generated compiler output.
     *
     * A record mapping slash-separated output file paths to their generated
     * text content. Keys can be project-relative or absolute, depending on
     * output placement and the capture lane. In particular, output outside the
     * project uses absolute keys. Native separators are normalized while
     * literal POSIX backslashes remain filename data.
     *
     * This includes JavaScript, declaration files, source maps, declaration
     * maps, and other text artifacts emitted through TypeScript-Go's
     * `WriteFile` callback.
     */
    output: Record<string, string>;
  }

  /**
   * Represents a ttsc compilation that completed with diagnostics or a
   * recoverable plugin failure.
   *
   * This interface is returned when the operation exits unsuccessfully or
   * reports error diagnostics, or when a plugin failure can be retained as a
   * build result while an independent TypeScript check runs. It contains both
   * structured diagnostic information and any output that was still generated
   * despite the failure.
   *
   * @evidence contracts/common.md#principled-implementation Failure retains both diagnostic evidence and partial captured artifacts; nonzero status without native findings is converted to a process diagnostic by the owning mapper.
   * @evidence contracts/common.md#clear-and-simple-design One completed-failure shape serves both compiler findings and recoverable plugin failures, with mandatory diagnostics and output.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Partial output is actual captured text; a failure is not converted to success by dropping findings or injecting expected artifacts.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc distinguishes error/nonzero outcomes from non-fatal success findings and explains partial output; paragraph, member and tag separation follow the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidence contracts/portability.md#os-neutral-implementation Partial output uses the same slash-separated relative or absolute keys as success; required diagnostics preserve native producer file paths and coordinate conventions.
   */
  export interface IFailure {
    /** Indicates that compilation completed with diagnostics. */
    type: "failure";

    /** Array of diagnostic messages describing the compilation issues. */
    diagnostics: ITtscCompilerDiagnostic[];

    /**
     * Any compiler output that was generated despite the diagnostics.
     *
     * This may be partial or empty depending on the severity of the issues and
     * how far TypeScript-Go progressed before returning diagnostics.
     * Paths use the same relative or absolute key convention as
     * {@link ISuccess.output}.
     */
    output: Record<string, string>;
  }

  /**
   * Represents an unexpected error during the compilation process.
   *
   * This interface is returned for host-level exceptions during preparation,
   * native execution, response decoding, output capture or cleanup. Normal
   * TypeScript diagnostics are represented by {@link IFailure}.
   *
   * The thrown value is described as finite data. Error name, message, stack,
   * causes, aggregate failures and enumerable outcome fields are retained.
   *
   * Repeated objects use `$ttscReference` JSON-pointer markers. Exceptional
   * scalar values, accessors and failed inspection use `$ttscValue` markers.
   * Serialization does not invoke getters or copy foreign class internal slots.
   *
   * @evidence contracts/common.md#principled-implementation Unknown accommodates finite causal error descriptions, outcome data and tagged exceptional values; the optional classifier identifies recognized preparation origins without pretending every exception is recognizable.
   * @evidence contracts/common.md#clear-and-simple-design The exception variant exposes only error and optional origin; completed outputs and diagnostic arrays remain with the completed variants.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing classification remains unknown rather than being guessed from a consumer or replaced with a fabricated compile result.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain finite causal serialization, markers and accessor limits alongside host-level execution, response and cleanup failures and classification; member and tag separation follow the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
   */
  export interface IException {
    /** Indicates that an unexpected host error occurred. */
    type: "exception";

    /**
     * Optional classifier so embedders can branch on the failure mode without
     * pattern-matching error messages. Omitted when ttsc cannot determine the
     * origin. Treat as `"unknown"` when missing.
     *
     * - `"plugin"`: plugin preparation failed before a build result could be
     *   recovered.
     * - `"host"`: the TypeScript-Go host could not start (missing binary, cache
     *   lock, invalid config).
     * - `"unknown"`: any other host-level failure.
     */
    kind?: "plugin" | "host" | "unknown";

    /** Finite causal description of the value thrown by the compiler host. */
    error: unknown;
  }
}
