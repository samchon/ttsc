import type { ComputedPropertyName } from "../expressions/ComputedPropertyName";
import type { NumericLiteral } from "../expressions/NumericLiteral";
import type { StringLiteral } from "../expressions/StringLiteral";
import type { Identifier } from "./Identifier";
import type { PrivateIdentifier } from "./PrivateIdentifier";

/**
 * A name usable as an object/member key.
 *
 * Individual declaration contexts can restrict these forms. In particular,
 * a private identifier is meaningful only where private members are allowed.
 *
 * @evidence contracts/common.md#principled-implementation The union covers computed, identifier, numeric, private and string keys; it represents shared spelling alternatives without asserting context legality.
 * @evidence contracts/common.md#clear-and-simple-design One property-name alias owns the alternatives reused by member declarations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Key categories are syntax representations, not hardcoded names or consumer exceptions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains the union's purpose and context restrictions in separate paragraphs following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type PropertyName =
  | ComputedPropertyName
  | Identifier
  | NumericLiteral
  | PrivateIdentifier
  | StringLiteral;
