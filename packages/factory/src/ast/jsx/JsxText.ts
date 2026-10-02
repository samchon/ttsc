/**
 * Literal text appearing as a child of a {@link JsxElement} or
 * {@link JsxFragment}.
 *
 * Built by {@link factory.createJsxText}.
 *
 * Text is emitted as supplied, including trailing whitespace. Callers must
 * provide valid JSX text; the trivia flag does not suppress printing.
 *
 * @evidence contracts/common.md#principled-implementation Raw text preserves literal JSX child content and whitespace; the stored trivia flag does not validate, escape or discard that content.
 * @evidence contracts/common.md#clear-and-simple-design Text and trivia metadata are separate fields without evaluating a rendered child.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The value is caller syntax, with no fixture-specific whitespace trimming or component output substitution.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains raw emission and trivia metadata's lack of print effect; paragraphs and member separation follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxText {
  /** Discriminant tag; always `"JsxText"`. */
  kind: "JsxText";

  /** Raw JSX text emitted verbatim, including trailing whitespace. */
  text: string;

  /** Stored trivia classification; the printer does not use it to suppress text. */
  containsOnlyTriviaWhiteSpaces: boolean;
}
