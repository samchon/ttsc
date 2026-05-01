import type { TtscCommonOptions } from "./TtscCommonOptions";

/** Internal options for transforming one source file through the CLI path. */
export interface TtscTransformOptions extends TtscCommonOptions {
  /** Source file to transform. Absolute paths and `cwd`-relative paths work. */
  file: string;
  /** Project config owning `file`; discovered from `file` when omitted. */
  tsconfig?: string;
  /** Optional output file path. Omit to return emitted text from stdout. */
  out?: string;
  /** Suppress summary banners from ttsc/native sidecars. Defaults to `true`. */
  quiet?: boolean;
  /** Normalize compiler output so diagnostics can be parsed structurally. */
  structuredDiagnostics?: boolean;
}
