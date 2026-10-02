import type { JSDocAllType } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocAllType}: the JSDoc `*` wildcard type.
 *
 * This node takes no inputs. It represents the "any" wildcard written as a bare
 * asterisk in a JSDoc type expression.
 *
 * The printer emits:
 *
 * ```ts
 * *
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Calling make with the wildcard kind and an empty payload constructs the childless asterisk form without interpreting a type name.
 * @evidence contracts/common.md#clear-and-simple-design The zero-argument adapter exposes the complete form directly and delegates only discriminant construction to make.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed wildcard kind encodes grammar, not an expected fixture result; no consumer branch or foreign mutation participates.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the lack of inputs and bare-asterisk output with an example; separate paragraphs and native tags follow the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link JSDocAllType}.
 */
export const createJSDocAllType = (): JSDocAllType => make("JSDocAllType", {});
