import type { ITtscCommonOptions } from "./ITtscCommonOptions";

export interface ITtscTransformOptions extends ITtscCommonOptions {
  /** Path to the .ts file to transform. Absolute or `cwd`-relative. */
  file: string;
  /** Path to the tsconfig owning `file`. Default: `tsconfig.json`. */
  tsconfig?: string;
  /**
   * When provided, the binary writes JS directly to this path instead of piping
   * stdout. Useful when the emitted text is large.
   */
  out?: string;
}
