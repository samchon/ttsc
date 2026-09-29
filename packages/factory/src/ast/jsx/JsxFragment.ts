import type { JsxChild } from "./JsxChild";
import type { JsxClosingFragment } from "./JsxClosingFragment";
import type { JsxOpeningFragment } from "./JsxOpeningFragment";

/**
 * A JSX fragment, e.g. `<>children</>`.
 *
 * Built by {@link factory.createJsxFragment}.
 *
 * @evidence contracts/common.md#principled-implementation Dedicated opening/closing fragment nodes and ordered children preserve name-free grouping rather than introducing a synthetic component tag.
 * @evidence contracts/common.md#clear-and-simple-design The fragment owns child order while delimiter nodes own fixed spelling and child variants own payloads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Grouping is represented syntax, without injecting a consumer-specific runtime fragment component.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates paired fragment syntax and identifies delimiters and children; member spacing follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxFragment {
  /** Discriminant tag; always `"JsxFragment"`. */
  kind: "JsxFragment";

  /** The opening fragment. */
  openingFragment: JsxOpeningFragment;

  /** The children. */
  children: readonly JsxChild[];

  /** The closing fragment. */
  closingFragment: JsxClosingFragment;
}
