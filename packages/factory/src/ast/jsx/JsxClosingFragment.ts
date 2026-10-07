/**
 * The closing fragment of a {@link JsxFragment}, i.e. `</>`.
 *
 * Built by {@link factory.createJsxJsxClosingFragment}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A distinct kind records the name-free closing fragment delimiter rather than a closing element with an invented tag.
 * @evidence contracts/common.md#clear-and-simple-design A kind-only interface suffices for the fixed closing syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed delimiter is JSX grammar, not hardcoded consumer output.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states the exact closing delimiter and actual constructor name; prose/tag separation follows the documentation skill.
 */
export interface JsxClosingFragment {
  /** Discriminant tag; always `"JsxClosingFragment"`. */
  kind: "JsxClosingFragment";
}
