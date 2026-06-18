import type { Identifier } from "../names/Identifier";

/**
 * A namespaced JSX name, e.g. `ns:name`.
 *
 * Built by {@link factory.createJsxNamespacedName}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxNamespacedName {
  /** Discriminant tag; always `"JsxNamespacedName"`. */
  kind: "JsxNamespacedName";

  /** The namespace. */
  namespace: Identifier;

  /** The name. */
  name: Identifier;
}
