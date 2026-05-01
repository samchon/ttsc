import type { ITtscCompilerDiagnostic } from "./ITtscCompilerDiagnostic";

/**
 * Result of a TypeScript source-to-source transformation operation.
 *
 * This mirrors `embed-typescript`'s `IEmbedTypeScriptTransformation` model.
 * Unlike {@link ITtscCompilerResult}, this contract is not an emit contract:
 * the `typescript` map must contain TypeScript source text, not generated
 * JavaScript, declaration files, or source maps.
 */
export type ITtscCompilerTransformation =
  | ITtscCompilerTransformation.ISuccess
  | ITtscCompilerTransformation.IFailure
  | ITtscCompilerTransformation.IException;

export namespace ITtscCompilerTransformation {
  /** Successful source-to-source transformation result. */
  export interface ISuccess {
    /** Indicates that transformation completed without diagnostics. */
    type: "success";

    /** Transformed TypeScript source text keyed by project file path. */
    typescript: Record<string, string>;
  }

  /** Source-to-source transformation result that completed with diagnostics. */
  export interface IFailure {
    /** Indicates that transformation completed with diagnostics. */
    type: "failure";

    /** Transformed or partially transformed TypeScript source text. */
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
