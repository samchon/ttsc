import type { JSDocNonNullableType, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocNonNullableType}: a JSDoc `!`-marked non-nullable type.
 *
 * The `type` is the wrapped type. The `postfix` flag controls placement of the
 * `!` marker: when `true` it prints after the type, when `false` it prints
 * before.
 *
 * The child accepts TypeNode forms, including JSDoc-specific wrappers.
 * Construction records notation without checking nullability or whether a
 * combined annotation is accepted in the caller's context.
 *
 * With a `number` type and `postfix` of `true`, the printer emits:
 *
 * ```ts
 * number!
 * ```
 *
 * The same type with `postfix` of `false` instead emits:
 *
 * ```ts
 * !number
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The adapter retains the TypeNode child, including JSDoc type forms, and placement flag under the non-nullable kind; prefix or postfix notation does not infer semantic nullability or contextual validity.
 * @evidence contracts/common.md#clear-and-simple-design A default-false flag chooses one of two spellings directly, avoiding parallel constructors or redundant marker text.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The exclamation mark belongs to this syntax form; no type-name exception, value assertion or foreign checker mutation supplies its meaning.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes both placements and caller-owned contextual validity with corrected output examples; paragraph and native-tag separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @param postfix Whether the `!` is written after the type.
 * @returns The created {@link JSDocNonNullableType}.
 */
export const createJSDocNonNullableType = (
  type: TypeNode,
  postfix: boolean = false,
): JSDocNonNullableType =>
  make("JSDocNonNullableType", {
    type,
    postfix,
  });
