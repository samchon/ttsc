import type { CallSignatureDeclaration } from "./CallSignatureDeclaration";
import type { ConstructSignatureDeclaration } from "./ConstructSignatureDeclaration";
import type { IndexSignatureDeclaration } from "./IndexSignatureDeclaration";
import type { MethodSignature } from "./MethodSignature";
import type { NotEmittedTypeElement } from "./NotEmittedTypeElement";
import type { PropertySignature } from "./PropertySignature";

/**
 * Any member of an interface or {@link TypeLiteralNode}, including a placeholder
 * that intentionally contributes no printed syntax.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The union admits call, construct, index, method, property and explicitly non-emitted member shapes rather than arbitrary statements; semantic member compatibility remains unchecked.
 * @evidence contracts/common.md#clear-and-simple-design One member alias owns the alternatives reused by interfaces and inline object types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives are syntax categories, without special members introduced for fixtures.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the owning member contexts and native type link; prose/tag separation follows the documentation skill.
 */
export type TypeElement =
  | CallSignatureDeclaration
  | ConstructSignatureDeclaration
  | IndexSignatureDeclaration
  | MethodSignature
  | NotEmittedTypeElement
  | PropertySignature;
