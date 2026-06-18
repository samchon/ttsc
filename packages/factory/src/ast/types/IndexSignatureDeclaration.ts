import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { TypeNode } from "./TypeNode";

/**
 * An index signature, e.g. `[key: string]: number`.
 *
 * Built by {@link factory.createIndexSignature}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface IndexSignatureDeclaration {
  /** Discriminant tag; always `"IndexSignature"`. */
  kind: "IndexSignature";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** The type. */
  type: TypeNode;
}
