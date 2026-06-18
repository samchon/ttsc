import type { Identifier } from "../names/Identifier";
import type { PrivateIdentifier } from "../names/PrivateIdentifier";
import type { Token } from "../names/Token";
import type { Expression } from "./Expression";

/**
 * An optional property access, e.g. `a?.b`.
 *
 * Built by {@link factory.createPropertyAccessChain}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PropertyAccessChain {
  /** Discriminant tag; always `"PropertyAccessChain"`. */
  kind: "PropertyAccessChain";

  /** Expression. */
  expression: Expression;

  /** QuestionDotToken. */
  questionDotToken?: Token;

  /** Name. */
  name: Identifier | PrivateIdentifier;
}
