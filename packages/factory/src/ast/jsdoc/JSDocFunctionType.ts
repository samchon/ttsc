import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc function type, e.g. `function(string): number`.
 *
 * Built by {@link factory.createJSDocFunctionType}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocFunctionType {
  /** Discriminant tag; always `"JSDocFunctionType"`. */
  kind: "JSDocFunctionType";

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** The return type, if any. */
  type?: TypeNode;
}
