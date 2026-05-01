import type { ITtscCompilerDiagnostic } from "./ITtscCompilerDiagnostic";

/**
 * Result of a ttsc TypeScript transformation operation.
 *
 * Mirrors `embed-typescript`'s `IEmbedTypeScriptTransformation` shape: normal
 * transform diagnostics are represented as `"failure"` with partial
 * TypeScript output, while host-level errors are represented as `"exception"`.
 */
export type ITtscCompilerTransformation =
  | ITtscCompilerTransformation.ISuccess
  | ITtscCompilerTransformation.IFailure
  | ITtscCompilerTransformation.IException;

export namespace ITtscCompilerTransformation {
  /** Successful TypeScript transformation result. */
  export interface ISuccess {
    /** Indicates that transformation completed without diagnostics. */
    type: "success";

    /** Transformed TypeScript source text keyed by project file path. */
    typescript: Record<string, string>;
  }

  /** TypeScript transformation result that completed with diagnostics. */
  export interface IFailure {
    /** Indicates that transformation completed with diagnostics. */
    type: "failure";

    /** Transformed TypeScript source text produced despite diagnostics. */
    typescript: Record<string, string>;

    /** Diagnostics reported during transformation. */
    diagnostics: ITtscCompilerDiagnostic[];
  }

  /** Unexpected host-level error during transformation. */
  export interface IException {
    /** Indicates that transformation could not complete normally. */
    type: "exception";

    /** Raw error thrown by the ttsc host. */
    error: unknown;
  }
}
