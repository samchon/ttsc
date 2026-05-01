import type { ITtscCommonOptions } from "./ITtscCommonOptions";

/** Options for transforming one source file through the JS `ttsc` API. */
export interface ITtscTransformOptions extends ITtscCommonOptions {
  /** Source file to transform. Absolute paths and `cwd`-relative paths work. */
  file: string;
  /** Project config owning `file`; discovered from `file` when omitted. */
  tsconfig?: string;
  /** Optional output file path. Omit to return emitted text from stdout. */
  out?: string;
}
