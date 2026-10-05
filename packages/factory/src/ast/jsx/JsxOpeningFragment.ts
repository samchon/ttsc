/**
 * The opening fragment of a {@link JsxFragment}, i.e. `<>`.
 *
 * Built by {@link factory.createJsxOpeningFragment}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A distinct kind preserves the name-free opening fragment delimiter without inventing element attributes or a tag name.
 * @evidence contracts/common.md#clear-and-simple-design A kind-only interface is sufficient for fixed opening syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The delimiter is JSX syntax, not a consumer-specific runtime factory value.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the exact opening delimiter and constructor; prose/tag separation follows the documentation skill.
 */
export interface JsxOpeningFragment {
  /** Discriminant tag; always `"JsxOpeningFragment"`. */
  kind: "JsxOpeningFragment";
}
