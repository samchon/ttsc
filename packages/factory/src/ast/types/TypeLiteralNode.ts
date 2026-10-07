import type { TypeElement } from "./TypeElement";

/**
 * An inline object type, e.g. `{ x: number }`.
 *
 * Built by {@link factory.createTypeLiteralNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation An ordered TypeElement collection represents inline object members without resolving their names or checking conflicts.
 * @evidence contracts/common.md#clear-and-simple-design The object wrapper owns member grouping and delegates each member's signature to TypeElement.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Member data comes from callers, with no fixture-keyed property substitution.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates inline object syntax and describes member order; separated member prose follows the documentation skill.
 */
export interface TypeLiteralNode {
  /** Discriminant tag; always `"TypeLiteralNode"`. */
  kind: "TypeLiteralNode";

  /** Inline object members in printed order. */
  members: readonly TypeElement[];
}
