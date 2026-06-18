import type { JsxAttributeLike, JsxAttributes } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxAttributes}: the ordered collection of props on a JSX
 * element.
 *
 * Each entry is either a {@link JsxAttribute} (`name=value`) or a
 * {@link JsxSpreadAttribute} (`{...props}`). This node is what an opening or
 * self-closing element holds as its `attributes`; an empty list prints to
 * nothing.
 *
 * Printed on its own, the collection leads with a separating space before each
 * attribute. Given a single `bar="x"` property, the printer emits (note the
 * leading space):
 *
 * ```tsx
 * bar = "x";
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param properties The attribute properties.
 * @returns The created {@link JsxAttributes}.
 */
export const createJsxAttributes = (
  properties: readonly JsxAttributeLike[],
): JsxAttributes => make("JsxAttributes", { properties });
