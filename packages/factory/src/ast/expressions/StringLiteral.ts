/**
 * A string literal expression.
 *
 * Built by {@link factory.createStringLiteral}.
 *
 * Text is the string value, not an already escaped source token. The printer
 * escapes content and supplies delimiters; absent singleQuote selects double
 * quotes.
 *
 * @evidence contracts/common.md#principled-implementation Unescaped content represents the string value independently of source quotation; the quote preference changes lexical spelling without supplying preescaped text.
 * @evidence contracts/common.md#clear-and-simple-design Content and one optional quote choice are sufficient; escaping and delimiter insertion remain in the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts singleQuote is an explicit syntax preference rather than a post-print replacement or a consumer-specific string value.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes value content from escaped tokens and specifies the quote default; comments and tags are separated under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface StringLiteral {
  /** Discriminant tag; always `"StringLiteral"`. */
  kind: "StringLiteral";

  /** The string content (unescaped). */
  text: string;

  /** When `true`, emit with single quotes instead of double. */
  singleQuote?: boolean;
}
