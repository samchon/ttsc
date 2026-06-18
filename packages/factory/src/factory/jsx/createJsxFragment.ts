import type {
  JsxChild,
  JsxClosingFragment,
  JsxFragment,
  JsxOpeningFragment,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxFragment}: a `<>...</>` fragment grouping children without
 * a wrapping element.
 *
 * The fragment is built from an empty {@link JsxOpeningFragment} (`<>`), the
 * list of children, and an empty {@link JsxClosingFragment} (`</>`). It exists
 * to render several siblings where a single root is required, without emitting
 * an extra DOM tag. The children follow the same rules as a {@link JsxElement}.
 *
 * Given an opening fragment, a single `Hello` text child, and a closing
 * fragment, the printer emits:
 *
 * ```tsx
 * <>Hello</>
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param openingFragment The opening fragment.
 * @param children The children.
 * @param closingFragment The closing fragment.
 * @returns The created {@link JsxFragment}.
 */
export const createJsxFragment = (
  openingFragment: JsxOpeningFragment,
  children: readonly JsxChild[],
  closingFragment: JsxClosingFragment,
): JsxFragment =>
  make("JsxFragment", {
    openingFragment,
    children,
    closingFragment,
  });
