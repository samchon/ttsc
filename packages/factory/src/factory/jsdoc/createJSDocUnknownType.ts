import type { JSDocUnknownType } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocUnknownType}: the JSDoc `?` unknown type.
 *
 * This node takes no inputs. It represents the unknown-type marker written as a
 * bare question mark in a JSDoc type expression.
 *
 * The printer emits:
 *
 * ```ts
 * ?
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The unknown kind and empty payload construct the bare question-mark form, preserving its distinction from a child-bearing nullable type.
 * @evidence contracts/common.md#clear-and-simple-design A zero-argument constructor records the marker without unused child or placement options.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The question-mark node is supported grammar data rather than a fallback guessed from known input types.
 * @evidence contracts/common.md#meaningful-documentation Native prose and the output example explain the bare marker and lack of inputs; paragraph and tag separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link JSDocUnknownType}.
 */
export const createJSDocUnknownType = (): JSDocUnknownType =>
  make("JSDocUnknownType", {});
