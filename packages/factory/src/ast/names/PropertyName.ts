import type { ComputedPropertyName } from "../expressions/ComputedPropertyName";
import type { NumericLiteral } from "../expressions/NumericLiteral";
import type { StringLiteral } from "../expressions/StringLiteral";
import type { Identifier } from "./Identifier";
import type { PrivateIdentifier } from "./PrivateIdentifier";

/**
 * A name usable as an object/member key.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type PropertyName =
  | ComputedPropertyName
  | Identifier
  | NumericLiteral
  | PrivateIdentifier
  | StringLiteral;
