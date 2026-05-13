/** Plugin-level metadata shared with the diagnostic surface. */
export interface ITtscLintPluginMeta {
  /** Plugin package name as published on npm. */
  name?: string;

  /** Plugin package version. */
  version?: string;

  /**
   * Rule namespace prefix (e.g. "import" → "import/no-cycle"). When omitted,
   * `@ttsc/lint` uses the key from the tsconfig `plugins` map.
   */
  namespace?: string;
}
