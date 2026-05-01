import type { TtscCommonOptions } from "./TtscCommonOptions";

/** Internal options for emitting one source file through the file-argument path. */
export interface TtscSingleFileEmitOptions extends TtscCommonOptions {
  /** Source file to emit. Absolute paths and `cwd`-relative paths work. */
  file: string;
  /** Project config owning `file`; discovered from `file` when omitted. */
  tsconfig?: string;
  /** Optional output file path. */
  out?: string;
  /** Suppress summary banners from ttsc/native sidecars. Defaults to `true`. */
  quiet?: boolean;
  /** Normalize compiler output so diagnostics can be parsed structurally. */
  structuredDiagnostics?: boolean;
}
