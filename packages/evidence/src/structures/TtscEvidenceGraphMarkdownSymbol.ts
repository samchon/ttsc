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
 * A file evidence target is its path relative to the reference's root, or the
 * project root when none is declared, with `/` separators. A declaration may
 * spell those separators as `/` or `\`. A heading target
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
 *
 * @evidence contracts/common.md#principled-implementation The literal union represents exactly the supported file and ATX H1-H4 outline nodes; explicit anchors and generated slugs address those nodes under the documented target grammar.
 * @evidence contracts/common.md#clear-and-simple-design One shared outline vocabulary serves both declaration hosts and reference units without introducing a separate enum or parser-node facade.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported heading forms and whitespace-containing source addresses are stated limitations rather than silently fabricated targets.
 * @evidence contracts/common.md#meaningful-documentation The comment gives supported headings, containment, anchor precedence, slug construction and address limitations in distinct paragraphs before the tags.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type lists Markdown unit kinds and names no path, file, filesystem or process.
 */
export type TtscEvidenceGraphMarkdownSymbol =
  | "file"
  | "h1"
  | "h2"
  | "h3"
  | "h4";
