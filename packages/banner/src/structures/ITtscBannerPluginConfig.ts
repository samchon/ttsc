/** `compilerOptions.plugins[]` entry shape consumed by `@ttsc/banner`. */
export interface ITtscBannerPluginConfig {
  /** Set to `false` to keep the entry while disabling this plugin. */
  enabled?: boolean;

  /** Plugin module specifier. */
  transform?: string;

  /** Inline banner text. */
  text?: string;

  /** Path to `banner.config.*`, resolved from the selected tsconfig directory. */
  config?: string;

  /** Extra plugin-owned fields are passed through unchanged. */
  [key: string]: unknown;
}
