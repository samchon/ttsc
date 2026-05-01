/** Result object returned by `build()` and `check()`. */
export interface ITtscBuildResult {
  /** Files written by the build when emitted-file listing was requested. */
  emittedFiles?: string[];
  /** Process-style exit status. `0` means success. */
  status: number;
  /** Captured stdout from TypeScript-Go or native plugin sidecars. */
  stdout: string;
  /** Captured stderr from TypeScript-Go or native plugin sidecars. */
  stderr: string;
}
