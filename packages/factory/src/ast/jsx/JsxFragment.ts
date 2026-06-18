import type { JsxChild } from "./JsxChild";
import type { JsxClosingFragment } from "./JsxClosingFragment";
import type { JsxOpeningFragment } from "./JsxOpeningFragment";

/**
 * A JSX fragment, e.g. `<>children</>`.
 *
 * Built by {@link factory.createJsxFragment}.
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
