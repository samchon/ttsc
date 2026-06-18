import type { Identifier } from "../names/Identifier";
import type { Token } from "../names/Token";
import type { TypeNode } from "./TypeNode";

/**
 * A named tuple member, e.g. `[first: string]`.
 *
 * Built by {@link factory.createNamedTupleMember}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamedTupleMember {
  /** Discriminant tag; always `"NamedTupleMember"`. */
  kind: "NamedTupleMember";

  /** DotDotDotToken. */
  dotDotDotToken?: Token;

  /** Name. */
  name: Identifier;

  /** QuestionToken. */
  questionToken?: Token;

  /** Type. */
  type: TypeNode;
}
