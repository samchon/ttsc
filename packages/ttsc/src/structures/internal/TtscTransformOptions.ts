import type { TtscCommonOptions } from "./TtscCommonOptions";

/** Internal options for transforming one source file through the CLI path. */
export interface TtscTransformOptions extends TtscCommonOptions {
  /** Source file to transform. Absolute paths and `cwd`-relative paths work. */
  file: string;
  /** Project config owning `file`; discovered from `file` when omitted. */
  tsconfig?: string;
  /** Optional output file path. Omit to return emitted text from stdout. */
  out?: string;
}
