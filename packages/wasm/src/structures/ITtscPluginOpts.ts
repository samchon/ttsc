/** Options for dispatching a named plugin subcommand via `api.plugin`. */
export interface ITtscPluginOpts {
  /** Plugin id registered with `host.Expose` (e.g. `@ttsc/banner`). */
  name: string;
  /** Subcommand the plugin's Run will receive (e.g. `build`). */
  command: string;
  /** Forwarded as `--cwd=<value>`. */
  cwd?: string;
  /** Forwarded as `--tsconfig=<value>`. Defaults to `tsconfig.json`. */
  tsconfig?: string;
  /** Any extra key/value pairs map to `--key=value` argv entries. */
  [key: string]: string | boolean | number | undefined;
}
