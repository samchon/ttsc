/**
 * A run of plain text inside a JSDoc comment body.
 *
 * Built by {@link factory.createJSDocText}.
 *
 * Standalone printing emits the content verbatim, including supplied spaces.
 * The enclosing JSDoc block supplies line prefixes and normalizes line endings.
 * Text does not escape comment delimiters.
 *
 * @evidence contracts/common.md#principled-implementation A string payload represents uninterpreted comment prose; the kind distinguishes that prose from inline references without pretending to parse or escape it.
 * @evidence contracts/common.md#clear-and-simple-design One text member carries the complete fragment, leaving block layout and inline links to their owning nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Arbitrary prose is retained as caller data rather than recognized fixture text or a foreign comment-processing hook.
 * @evidence contracts/common.md#meaningful-documentation The native description distinguishes standalone text from enclosing-block line layout and explains delimiter responsibility; paragraphs and members are separated according to the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocText {
  /** Discriminant tag; always `"JSDocText"`. */
  kind: "JSDocText";

  /** Verbatim content, including spacing needed between adjacent fragments. */
  text: string;
}
