import type { Identifier } from "../names/Identifier";

/**
 * A namespaced JSX name, e.g. `ns:name`.
 *
 * Built by {@link factory.createJsxNamespacedName}.
 *
 * @evidence contracts/common.md#principled-implementation Two Identifier operands preserve colon-qualified JSX spelling rather than dotted property access; namespace support in a JSX consumer remains unchecked.
 * @evidence contracts/common.md#clear-and-simple-design Namespace prefix and local name are explicit fields sharing the existing identifier shape.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Names are supplied data rather than hardcoded namespace mappings for components.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates colon qualification and labels prefix/local roles; separated comments follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxNamespacedName {
  /** Discriminant tag; always `"JsxNamespacedName"`. */
  kind: "JsxNamespacedName";

  /** The namespace. */
  namespace: Identifier;

  /** Local name after the colon. */
  name: Identifier;
}
