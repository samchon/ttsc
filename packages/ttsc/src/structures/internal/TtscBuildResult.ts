import type { ITtscCompilerDiagnostic } from "../ITtscCompilerDiagnostic";

/** Internal result captured from TypeScript-Go or native plugin sidecars. */
export interface TtscBuildResult {
  /** Structured diagnostics collected from compiler output. */
  diagnostics: ITtscCompilerDiagnostic[];
  /** Files written by the build when emitted-file listing was requested. */
  emittedFiles?: string[];
  /** Process-style exit status. `0` means success. */
  status: number;
  /** Captured stdout from TypeScript-Go or native plugin sidecars. */
  stdout: string;
  /** Captured stderr from TypeScript-Go or native plugin sidecars. */
  stderr: string;
}
