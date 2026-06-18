import type { JsxAttribute } from "./JsxAttribute";
import type { JsxSpreadAttribute } from "./JsxSpreadAttribute";

/**
 * Any node that may appear as a property of {@link JsxAttributes} — a
 * {@link JsxAttribute} or a {@link JsxSpreadAttribute}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxAttributeLike = JsxAttribute | JsxSpreadAttribute;
