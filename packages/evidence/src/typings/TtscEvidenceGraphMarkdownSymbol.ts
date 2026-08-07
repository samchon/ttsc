/**
 * A Markdown node kind that can become an evidence unit or host an evidence
 * declaration.
 *
 * `"file"` is the document root. `"h1"` through `"h4"` select ATX heading
 * sections at that exact level; Setext headings and H5/H6 headings are outside
 * this contract.
 *
 * These nodes form the Markdown outline: the file contains every heading, and a
 * heading contains the lower-level headings before the next heading of equal or
 * higher level. An `@evidence` target, or an `@evidenceExclude` target allowed
 * by its reference policy, acknowledges its selected node and every selected
 * descendant. A reference selector still defines which descendants are
 * obligations; an unselected ancestor remains addressable as their aggregate
 * scope.
 *
 * A file evidence target is its project-relative path with `/` separators. A
 * declaration may spell those separators as `/` or `\`. A heading target
 * appends its anchor, such as `docs/orders.md#create-order`. An explicit
 * `{#anchor}` suffix wins. Its anchor must start with an ASCII letter or digit
 * and may then contain ASCII letters, digits, `.`, `_`, `:`, and `-`.
 *
 * Without an explicit anchor, the heading becomes a lowercase slug: letters,
 * numbers, and `_` remain; whitespace and `-` collapse to `-`; other
 * punctuation is removed. Two selected headings that produce the same target
 * are ambiguous and need distinct explicit anchors.
 *
 * Targets are one whitespace-delimited declaration token. A Markdown source
 * path therefore cannot contain whitespace; the rule reports such a file with a
 * rename diagnostic instead of creating an impossible obligation.
 */
export type TtscEvidenceGraphMarkdownSymbol =
  | "file"
  | "h1"
  | "h2"
  | "h3"
  | "h4";
