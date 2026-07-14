/**
 * Options for `unicorn/template-indent`.
 *
 * Each selection list replaces the corresponding default list. `indent` is
 * either a positive number of spaces or the exact non-empty whitespace string
 * added after the opening template's source-line margin.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/template-indent.md
 */
export interface ITtscLintUnicornTemplateIndentRuleOptions {
  /** Block-comment contents that select the immediately following template. */
  comments?: readonly string[];

  /** Function paths whose direct template-literal arguments are checked. */
  functions?: readonly string[];

  /** Positive space count or exact whitespace unit used inside the template. */
  indent?: number | string;

  /** AST selectors whose matching template literals are checked. */
  selectors?: readonly string[];

  /** Identifier or dotted member paths used as checked template tags. */
  tags?: readonly string[];
}
