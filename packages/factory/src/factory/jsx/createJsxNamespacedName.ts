import type { Identifier, JsxNamespacedName } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxNamespacedName}: a colon-separated `namespace:name` used in
 * tag or attribute names.
 *
 * Both parts are identifiers; the result reads `namespace:name`. It appears
 * where namespaced JSX names are valid, most commonly as an attribute name such
 * as `xlink:href` on an SVG element, or as a namespaced tag name.
 *
 * Given the namespace `ns` and the name `name`, the printer emits:
 *
 * ```tsx
 * ns: name;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param namespace The namespace.
 * @param name The name.
 * @returns The created {@link JsxNamespacedName}.
 */
export const createJsxNamespacedName = (
  namespace: Identifier,
  name: Identifier,
): JsxNamespacedName =>
  make("JsxNamespacedName", {
    namespace,
    name,
  });
