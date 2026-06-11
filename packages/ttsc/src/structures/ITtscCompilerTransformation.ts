import type { ITtscCompilerDiagnostic } from "./ITtscCompilerDiagnostic";

/**
 * Result of a TypeScript source-to-source transformation operation.
 *
 * This mirrors `embed-typescript`'s `IEmbedTypeScriptTransformation` model.
 * Unlike {@link ITtscCompilerResult}, this contract is not an emit contract: the
 * `typescript` map must contain TypeScript source text, not generated
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

    /** Non-fatal diagnostics reported during transformation. */
    diagnostics?: ITtscCompilerDiagnostic[];

    /**
     * Transformed TypeScript source text keyed by project-relative file path.
     *
     * Values are TypeScript source text, never JavaScript, declaration files,
     * or source maps. When no transform native source is configured, this map
     * contains the unmodified TypeScript files loaded by the TypeScript-Go
     * Program.
     */
    typescript: Record<string, string>;

    /**
     * Source files the transform consulted per transformed file, keyed the same
     * way as {@link typescript}. Each entry lists the project-relative or
     * absolute paths whose content influenced that output beyond the file
     * itself — e.g. the declaration files a type-driven code generator read.
     *
     * Optional: only present when the transform native source reported a
     * `dependencies` object in its stdout envelope. Bundler adapters use it to
     * register watch files so type-only imports participate in HMR
     * invalidation. ttsc passes the paths through verbatim.
     */
    dependencies?: Record<string, string[]>;
  }

  /** Source-to-source transformation result that completed with diagnostics. */
  export interface IFailure {
    /** Indicates that transformation completed with diagnostics. */
    type: "failure";

    /**
     * Transformed or partially transformed TypeScript source text keyed by
     * project-relative file path.
     *
     * May be empty or partial when diagnostics prevented the transform native
     * source from completing its pass.
     */
    typescript: Record<string, string>;

    /** Diagnostics reported during transformation. */
    diagnostics: ITtscCompilerDiagnostic[];

    /**
     * Source files the transform consulted per transformed file. Same shape and
     * semantics as {@link ISuccess.dependencies}; may be partial when the
     * transform did not complete its pass.
     */
    dependencies?: Record<string, string[]>;
  }

  /** Unexpected host-level error during transformation. */
  export interface IException {
    /** Indicates that transformation could not complete normally. */
    type: "exception";

    /**
     * Optional classifier so embedders can branch on the failure mode without
     * pattern-matching error messages. Omitted when ttsc cannot determine the
     * origin. Treat as `"unknown"` when missing.
     *
     * - `"plugin"`: a native plugin sidecar crashed or exited non-zero.
     * - `"host"`: the TypeScript-Go host could not start (missing binary, cache
     *   lock, invalid config).
     * - `"unknown"`: any other host-level failure.
     */
    kind?: "plugin" | "host" | "unknown";

    /** Raw error thrown by the ttsc host. */
    error: unknown;
  }
}
