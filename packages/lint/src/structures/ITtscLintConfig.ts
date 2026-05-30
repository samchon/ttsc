import type { ITtscLintPlugin } from "./ITtscLintPlugin";
import type { ITtscLintFormat } from "./format/ITtscLintFormat";
import type { ITtscLintRules } from "./rules/ITtscLintRules";

/**
 * Top-level object accepted by `@ttsc/lint` config files.
 *
 * Keep the file shape plain: users export an object and use `satisfies
 * ITtscLintConfig` when they want type checking.
 */
export interface ITtscLintConfig {
  /** Globs that select the files this entry applies to. */
  files?: string | readonly string[];

  /** Globs that exclude files this entry would otherwise match. */
  ignores?: string | readonly string[];

  /**
   * Config file path folded in before this object's own rules apply.
   *
   * Relative paths resolve from the containing config file's directory.
   */
  extends?: string;

  /** Prettier-style flat configuration for the format rules. */
  format?: ITtscLintFormat;

  /**
   * Kebab-case built-in rule severities plus namespaced contributor rules.
   *
   * Built-in rules are concrete interface properties for autocomplete and typo
   * checking. Namespaced families and contributor rules use the familiar slash
   * form such as `react/jsx-key` or `demo/no-demo`.
   */
  rules?: ITtscLintRules;

  /** Contributor plugin objects keyed by namespace. */
  plugins?: Record<string, ITtscLintPlugin>;
}
