/** Options for the `@ttsc/lint` integration of {@link createWorkerCompiler}. */
export interface ILintPluginConfig {
  /** Plugin id registered with `host.Expose` (default: `"@ttsc/lint"`). */
  name?: string;
}
