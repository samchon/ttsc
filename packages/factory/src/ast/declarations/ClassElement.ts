import type { ClassStaticBlockDeclaration } from "./ClassStaticBlockDeclaration";
import type { ConstructorDeclaration } from "./ConstructorDeclaration";
import type { GetAccessorDeclaration } from "./GetAccessorDeclaration";
import type { MethodDeclaration } from "./MethodDeclaration";
import type { PropertyDeclaration } from "./PropertyDeclaration";
import type { SemicolonClassElement } from "./SemicolonClassElement";
import type { SetAccessorDeclaration } from "./SetAccessorDeclaration";

/**
 * Any member of a {@link ClassDeclaration}.
 *
 * @evidence contracts/common.md#principled-implementation The union distinguishes constructors, methods, properties, accessors, static blocks and semicolon members; it does not enforce class-level restrictions on their combinations.
 * @evidence contracts/common.md#clear-and-simple-design One alias owns class-member alternatives shared by declaration and expression classes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives are syntax categories rather than fixture-specific member exceptions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies class-member ownership with its native class link; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ClassElement =
  | ClassStaticBlockDeclaration
  | ConstructorDeclaration
  | GetAccessorDeclaration
  | MethodDeclaration
  | PropertyDeclaration
  | SemicolonClassElement
  | SetAccessorDeclaration;
