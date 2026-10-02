import type { Expression, TypeAssertion, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TypeAssertion}: the angle-bracket cast form `<Type>expr`.
 *
 * `type` is the asserted type and `expression` is the value being cast. The
 * printer wraps the type in angle brackets and places it before the expression
 * with no space. This is the older cast syntax; the `as` form is a separate
 * node.
 *
 * With `type` of `Foo` and `expression` of `x`, the printer emits:
 *
 * ```ts
 * <Foo>x
 * ```
 *
 * This is assertion syntax, not a runtime conversion. Callers choose an
 * enclosing grammar context that permits angle-bracket assertions rather
 * than JSX; construction does not perform type checking.
 *
 * @evidence contracts/common.md#principled-implementation Type and operand retain the angle-bracket assertion form separately from as syntax; caller-owned grammar context and assertion validity are not established by construction.
 * @evidence contracts/common.md#clear-and-simple-design One make call records the two constituents, leaving assertion delimiters and operand precedence to the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The type assertion does not become a runtime cast, patched value or fabricated assignability result.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes assertion from conversion and states the JSX-context limit; expression example, parameters and tags remain separate.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The asserted type.
 * @param expression The expression to cast.
 * @returns The created {@link TypeAssertion}.
 */
export const createTypeAssertion = (
  type: TypeNode,
  expression: Expression,
): TypeAssertion => make("TypeAssertion", { type, expression });
