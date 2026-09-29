/**
 * The opening literal chunk before a template's first substitution.
 *
 * Built by {@link factory.createTemplateHead}.
 *
 * The printer supplies the opening backtick and `${`. Raw content takes
 * precedence when present; otherwise cooked text is escaped. This chunk alone
 * is not a complete expression.
 *
 * @evidence contracts/common.md#principled-implementation Separate cooked and optional raw content preserve the opening chunk's two text representations; the head kind identifies its opening-substitution delimiters without making it a complete template.
 * @evidence contracts/common.md#clear-and-simple-design The chunk stores content only; TemplateExpression owns composition and the printer supplies delimiters and escaping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts rawText is explicit lexical content, not a guessed substitution value or a post-print patch.
 * @evidence contracts/common.md#meaningful-documentation Native prose and members identify delimiter ownership, raw precedence and incomplete-expression status, with separated comments and tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateHead {
  /** Discriminant tag; always `"TemplateHead"`. */
  kind: "TemplateHead";

  /** Cooked opening content, excluding the backtick and `${` delimiters. */
  text: string;

  /** Optional valid raw content emitted instead of escaped cooked text. */
  rawText?: string;
}
