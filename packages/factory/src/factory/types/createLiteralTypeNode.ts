import type {
  BigIntLiteral,
  LiteralTypeNode,
  NumericLiteral,
  PrefixUnaryExpression,
  StringLiteral,
  Token,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link LiteralTypeNode}: a literal used in type position such as
 * `"foo"`, `42`, `true`, or `null`.
 *
 * The printer emits the wrapped literal directly, so the rendered text is
 * exactly that literal's own source. A {@link PrefixUnaryExpression} covers
 * negative numeric literals such as `-1`, and a {@link Token} covers keyword
 * literals such as `true`, `false`, and `null`.
 *
 * Given a `"foo"` string literal, the printer renders:
 *
 * ```ts
 * "foo"
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The literal child remains structured inside LiteralTypeNode, preserving
 *   its literal spelling or unary form; allowed Token inputs still require valid context.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The wrapper gives an expression literal a type role without reparsing text
 *   or maintaining separate constructors for every literal category.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Literal values are not used as fixture identifiers or converted into
 *   broader keyword types to match an expected result.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc names the supported literal forms and shows a bare literal type;
 *   the child parameter and returned wrapper are documented.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param literal The literal; a {@link PrefixUnaryExpression} covers negative
 *   numeric literals such as `-1`.
 * @returns The created {@link LiteralTypeNode}.
 */
export const createLiteralTypeNode = (
  literal:
    | StringLiteral
    | NumericLiteral
    | BigIntLiteral
    | PrefixUnaryExpression
    | Token,
): LiteralTypeNode => make("LiteralTypeNode", { literal });
