import type { JSDocTypeExpression, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocTypeExpression}: a brace-wrapped JSDoc type.
 *
 * The `type` is the wrapped type. The printer surrounds it with curly braces,
 * producing the `{Type}` form that JSDoc tags use to carry their type.
 *
 * The TypeNode input includes JSDoc-specific forms such as wildcard, nullable
 * and variadic nodes. The caller must choose a child valid for its tag context.
 *
 * With a `number` type, the printer emits:
 *
 * ```ts
 * {number}
 * ```
 *
 * @evidence contracts/common.md#principled-implementation A direct TypeNode child assignment records a brace wrapper for ordinary and JSDoc type forms, preserving structured composition without claiming contextual validation.
 * @evidence contracts/common.md#clear-and-simple-design One child supplies the payload, while the kind delegates brace emission to the printer without storing another type string.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper retains the supplied type rather than inserting an expected braced answer or altering foreign type nodes.
 * @evidence contracts/common.md#meaningful-documentation Native prose states brace output, supported JSDoc children and caller-owned contextual validity with an example; prose and native tags remain separated under the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @returns The created {@link JSDocTypeExpression}.
 */
export const createJSDocTypeExpression = (
  type: TypeNode,
): JSDocTypeExpression =>
  make("JSDocTypeExpression", {
    type,
  });
