import type { JSDocNullableType, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocNullableType}: a JSDoc `?`-marked nullable type.
 *
 * The `type` is the wrapped type. The `postfix` flag controls placement of the
 * `?` marker: when `true` it prints after the type, when `false` it prints
 * before.
 *
 * The child accepts TypeNode forms, including JSDoc-specific wrappers. This
 * constructor records annotation placement and does not validate values or the
 * combined form's legality in a containing annotation.
 *
 * With a `number` type and `postfix` of `true`, the printer emits:
 *
 * ```ts
 * number?
 * ```
 *
 * The same type with `postfix` of `false` instead emits:
 *
 * ```ts
 * ?number
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @param postfix Whether the `?` is written after the type.
 * @returns The created {@link JSDocNullableType}.
 * @evidence contracts/common.md#principled-implementation The required TypeNode child and postfix flag preserve question-mark modification, distinct from the bare unknown marker; JSDoc children can compose without implying contextual validity.
 * @evidence contracts/common.md#clear-and-simple-design A single placement option with a prefix default exposes the notation choice without another nullable representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Nullable notation is explicit caller intent rather than a guessed type-name rule or a substituted runtime value.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains both placements and the contextual-validation boundary with examples; separate paragraphs and parameter descriptions follow the documentation guidance.
 */
export const createJSDocNullableType = (
  type: TypeNode,
  postfix: boolean = false,
): JSDocNullableType =>
  make("JSDocNullableType", {
    type,
    postfix,
  });
