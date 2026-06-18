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
 * With no parameters and a `number` return type, the printer emits:
 *
 * ```ts
 * function(): number
 * ```
 *
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
