/** Inputs for locating the tsconfig/jsconfig that owns an invocation. */
export interface ITtscProjectLocatorOptions {
  /** Working directory for relative paths and upward config discovery. */
  cwd?: string;
  /** Source file used as the starting point for nearest-config discovery. */
  file?: string;
  /** Explicit tsconfig/jsconfig path. */
  tsconfig?: string;
}
