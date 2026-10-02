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
 * ns:name
 * ```
 *
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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
