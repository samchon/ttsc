import type { Decorator, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link Decorator}: an `@expression` attached to a declaration.
 *
 * The `expression` is the decorator body, commonly an identifier or a call
 * expression. The printer prefixes it with `@` and emits the expression as
 * given, except that it adds parentheses when the decorator grammar would not
 * accept the expression bare, such as a binary expression or an element access.
 * It does not add the surrounding declaration.
 *
 * With `expression` of an identifier named `deco`, this prints:
 *
 * ```ts
 * @deco
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Decorator stores its expression; the printer supplies @ at a declaration
 *   boundary instead of changing the supplied expression's AST.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One expression field is sufficient; declaration attachment belongs to the
 *   caller and no decorator registry is introduced.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decoration is represented as syntax, not applied by patching a class.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains expression ownership and the missing surrounding declaration,
 *   with an example and separate acknowledgment paragraphs. The parentheses the printer adds for a bare binary expression or element access are stated.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link Decorator}.
 */
export const createDecorator = (expression: Expression): Decorator =>
  make("Decorator", { expression });
