import type {
  JsxChild,
  JsxClosingElement,
  JsxElement,
  JsxOpeningElement,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxElement}: a paired `<Tag>...</Tag>` element with children.
 *
 * The element is built from three already-created pieces: the
 * {@link JsxOpeningElement} that carries the tag name and attributes, the list
 * of children rendered between the tags, and the {@link JsxClosingElement} that
 * repeats the tag name. The children may be {@link JsxText}, nested elements,
 * fragments, or {@link JsxExpression} braces, in source order.
 *
 * Given an opening `<Foo bar="x">`, a single `Hello` text child, and a closing
 * `</Foo>`, the printer emits:
 *
 * ```tsx
 * <Foo bar="x">Hello</Foo>
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param openingElement The opening element.
 * @param children The children.
 * @param closingElement The closing element.
 * @returns The created {@link JsxElement}.
 * @evidence contracts/common.md#principled-implementation
 *   Opening, ordered children and closing remain separate boundaries; children
 *   are not collapsed into text, preserving expressions and raw JSX content.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The parent assembles existing pieces without duplicating tag-name or
 *   attribute construction. Its printer owns whitespace-safe child layout.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Component names do not select synthetic children or raw-source templates,
 *   and no child is omitted merely to make paired output match expectations.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs distinguish the three pieces and supported child forms;
 *   the example demonstrates assembly while each argument retains its own description.
 */
export const createJsxElement = (
  openingElement: JsxOpeningElement,
  children: readonly JsxChild[],
  closingElement: JsxClosingElement,
): JsxElement =>
  make("JsxElement", {
    openingElement,
    children,
    closingElement,
  });
