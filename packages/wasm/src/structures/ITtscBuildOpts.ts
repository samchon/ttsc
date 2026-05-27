/** Options shared by `build`, `check`, and `transform`. */
export interface ITtscBuildOpts {
  /** Absolute virtual path the project lives at inside the MemFS. */
  cwd: string;
  /** Tsconfig path, relative to `cwd`. Defaults to `tsconfig.json`. */
  tsconfig?: string;
}
