import type {
  JSDocFunctionType,
  ParameterDeclaration,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocFunctionType}: a JSDoc `function(...)` type.
 *
 * The `parameters` are the function parameters, printed inside the parentheses.
 * The `type` is the return type, printed after a colon when present.
 *
 * Its TypeNode union includes JSDoc-specific types. Parameters and children
 * are retained by reference; no JSDoc signature validity check is performed.
 *
 * With no parameters and a `number` return type, the printer emits:
 *
 * ```ts
 * function(): number
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Ordered parameter declarations and an optional TypeNode return, including JSDoc forms, are retained directly for function-form emission without validating parameter or return grammar in context.
 * @evidence contracts/common.md#clear-and-simple-design Two role-based assignments capture parameters and return syntax, keeping layout in the printer and avoiding a second flattened signature.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied parameters and return nodes remain unchanged rather than recognized signature examples or mutations of a foreign function model.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains omitted-return punctuation, retained references and the grammar-validation boundary with an output example; separate paragraphs and parameter tags follow the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @param parameters The parameters.
 * @param type The return type, if any.
 * @returns The created {@link JSDocFunctionType}.
 */
export const createJSDocFunctionType = (
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
): JSDocFunctionType =>
  make("JSDocFunctionType", {
    parameters,
    type,
  });
