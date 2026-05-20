/**
 * Plugin-level metadata exposed on `ITtscLintPlugin.meta`.
 *
 * All fields are optional. When `namespace` is absent, `@ttsc/lint` falls back
 * to the key used in the tsconfig `plugins` map (or `lint.config.*` `plugins`
 * object) as the rule-name prefix. `name` and `version` are purely
 * informational — they appear in diagnostic messages and are not validated at
 * build time.
 */
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
