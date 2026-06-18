import type { Identifier } from "../names/Identifier";
import type { JsxNamespacedName } from "./JsxNamespacedName";

/**
 * The name of a {@link JsxAttribute} — an {@link Identifier} or a
 * {@link JsxNamespacedName}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxAttributeName = Identifier | JsxNamespacedName;
