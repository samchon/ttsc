import type { Token } from "../names/Token";
import type { TypeElement } from "./TypeElement";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A mapped type, e.g. `{ [K in keys]: T }`.
 *
 * Built by {@link factory.createMappedTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface MappedTypeNode {
  /** Discriminant tag; always `"MappedTypeNode"`. */
  kind: "MappedTypeNode";

  /** ReadonlyToken. */
  readonlyToken?: Token;

  /** TypeParameter. */
  typeParameter: TypeParameterDeclaration;

  /** NameType. */
  nameType?: TypeNode;

  /** QuestionToken. */
  questionToken?: Token;

  /** Type. */
  type?: TypeNode;

  /** Members. */
  members?: readonly TypeElement[];
}
