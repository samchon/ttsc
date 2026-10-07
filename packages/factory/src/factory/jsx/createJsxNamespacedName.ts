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
 * @evidence contracts/common.md#principled-implementation
 *   Namespace and local name remain distinct identifiers, producing JSX's
 *   colon-name form rather than a JavaScript property-access expression.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Two children describe the name without parsing a compound string or
 *   attaching resource-type behavior to a particular namespace.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   SVG-like names are examples, not privileged branches; no namespace rewrites
 *   or consumer-specific mappings alter the supplied identifiers.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains tag/attribute use and the corrected example renders the
 *   colon with no invented space or statement terminator.
 */
export const createJsxNamespacedName = (
  namespace: Identifier,
  name: Identifier,
): JsxNamespacedName =>
  make("JsxNamespacedName", {
    namespace,
    name,
  });
