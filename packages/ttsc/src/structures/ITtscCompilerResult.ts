import type { ITtscCompilerDiagnostic } from "./ITtscCompilerDiagnostic";

/**
 * Result of a ttsc TypeScript-Go compilation operation.
 *
 * Represents the possible outcomes of {@link TtscCompiler.compile}, which can
 * be either a successful compilation, a compilation that completed with
 * diagnostics, or an unexpected host error during the compilation process.
 *
 * This type follows the legacy `embed-typescript` result model, but stores all
 * emitted text artifacts in {@link ITtscCompilerResult.ISuccess.output} and
 * {@link ITtscCompilerResult.IFailure.output}. TypeScript-Go may emit
 * JavaScript, declaration files, source maps, and declaration maps from one
 * compile operation, so the public result is not limited to JavaScript.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ITtscCompilerResult =
  | ITtscCompilerResult.ISuccess
  | ITtscCompilerResult.IFailure
  | ITtscCompilerResult.IException;

export namespace ITtscCompilerResult {
  /**
   * Represents a successful ttsc compilation result.
   *
   * This interface is returned when TypeScript-Go completes without
   * diagnostics, containing every text output captured from the native
   * compiler host's `WriteFile` callback.
   */
  export interface ISuccess {
    /**
     * Indicates that the compilation was successful.
     */
    type: "success";

    /**
     * The generated compiler output.
     *
     * A record mapping project-relative output file paths to their generated
     * text content. This includes JavaScript, declaration files, source maps,
     * declaration maps, and any other text artifact emitted through
     * TypeScript-Go's `WriteFile` callback.
     */
    output: Record<string, string>;
  }

  /**
   * Represents a ttsc compilation that completed but had diagnostics.
   *
   * This interface is returned when the compiler reports errors, warnings, or
   * other diagnostics during normal compilation. It contains both structured
   * diagnostic information and any output that was still generated despite the
   * diagnostics.
   */
  export interface IFailure {
    /**
     * Indicates that compilation completed with diagnostics.
     */
    type: "failure";

    /**
     * Array of diagnostic messages describing the compilation issues.
     */
    diagnostics: ITtscCompilerDiagnostic[];

    /**
     * Any compiler output that was generated despite the diagnostics.
     *
     * This may be partial or empty depending on the severity of the issues and
     * how far TypeScript-Go progressed before returning diagnostics.
     */
    output: Record<string, string>;
  }

  /**
   * Represents an unexpected error during the compilation process.
   *
   * This interface is returned when ttsc cannot prepare, build, or spawn the
   * native compiler host. Normal TypeScript diagnostics are represented by
   * {@link IFailure}; this variant is reserved for host-level exceptions.
   */
  export interface IException {
    /**
     * Indicates that an unexpected host error occurred.
     */
    type: "exception";

    /**
     * The error that was thrown while preparing or running the compiler host.
     */
    error: unknown;
  }
}
