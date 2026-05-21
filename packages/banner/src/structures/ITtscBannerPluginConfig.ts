/** `compilerOptions.plugins[]` entry shape consumed by `@ttsc/banner`. */
export interface ITtscBannerPluginConfig {
  /** Set to `false` to keep the entry while disabling this plugin. */
  enabled?: boolean;

  /** Plugin module specifier. */
  transform?: string;

  /**
   * Path to a `banner.config.*` file, resolved from the directory that contains
   * the tsconfig. When omitted, `@ttsc/banner` walks up from that directory and
   * uses the first `banner.config.{ts,cts,mts,js,cjs,mjs,json}` file it finds.
   * Any other key in this entry is rejected with an error.
   */
  configFile?: string;
}
