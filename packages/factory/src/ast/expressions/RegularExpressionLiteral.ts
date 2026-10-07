/**
 * A regular expression literal, e.g. `/ab+c/gi`.
 *
 * Built by {@link factory.createRegularExpressionLiteral}.
 *
 * Text includes the slash delimiters and any flags. It is emitted verbatim; the
 * outline does not parse the pattern or validate flag combinations.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Complete lexical text preserves regexp delimiters, pattern and flags without converting them to a runtime RegExp; valid spelling is a caller premise.
 * @evidence contracts/common.md#clear-and-simple-design One source-text field avoids a second pattern-and-flags representation or a parsing layer in the node.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual regexp source is supplied explicitly rather than replaced with a consumer-specific matcher or output patch.
 * @evidence contracts/common.md#meaningful-documentation Native prose and the member explain delimiters, flags and verbatim emission limits with documentation-compliant separation.
 */
export interface RegularExpressionLiteral {
  /** Discriminant tag; always `"RegularExpressionLiteral"`. */
  kind: "RegularExpressionLiteral";

  /** Complete valid regexp literal spelling, including slashes and flags. */
  text: string;
}
