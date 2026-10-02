/**
 * A literal chunk between two template substitutions.
 *
 * Built by {@link factory.createTemplateMiddle}.
 *
 * The printer supplies the preceding `}` and following `${`. Raw content
 * overrides escaped cooked text when present. The enclosing template must
 * supply another substitution after this chunk.
 *
 * @evidence contracts/common.md#principled-implementation Cooked and raw fields represent the inter-substitution content, while the middle kind selects continuation delimiters; another substitution is required by that position.
 * @evidence contracts/common.md#clear-and-simple-design The chunk stores no adjacent expressions; TemplateSpan and TemplateExpression own substitution order and composition.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The continuation form records actual template structure rather than inserting a fake final delimiter or expected interpolation value.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains both delimiter boundaries, raw precedence and continuation requirements; member comments and tags use documentation-compliant separation.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TemplateMiddle {
  /** Discriminant tag; always `"TemplateMiddle"`. */
  kind: "TemplateMiddle";

  /** Cooked content between `}` and `${`, excluding those delimiters. */
  text: string;

  /** Optional valid raw content emitted instead of escaped cooked text. */
  rawText?: string;
}
