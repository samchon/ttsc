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
 * @evidence contracts/common.md#principled-implementation
 *   Fragment boundaries and ordered children are retained without introducing
 *   a named tag, preserving sibling grouping rather than adding wrapper syntax.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The parent composes existing fragment delimiters and children, sharing
 *   whitespace-safe layout with elements without duplicating attribute concerns.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The factory does not replace fragments with a framework-specific component
 *   or inject a DOM wrapper based on expected output.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose describes the absence of a wrapping tag and the three inputs;
 *   its example shows the assembled fragment with meaningful text preserved.
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
