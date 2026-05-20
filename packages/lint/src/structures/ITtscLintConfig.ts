import type { ITtscLintFormatConfig } from "./ITtscLintFormatConfig";
import type { ITtscLintPlugin } from "./ITtscLintPlugin";
import type { TtscLintRuleMap } from "./TtscLintRuleMap";

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

  /** Contributor plugin objects keyed by namespace. */
  plugins?: Record<string, ITtscLintPlugin>;

  /** Rule-name to severity map. Supports severity tuples with options. */
  rules?: TtscLintRuleMap;

  /** Prettier-style flat configuration for the `format/*` rules. */
  format?: ITtscLintFormatConfig;
}
