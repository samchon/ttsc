import type { GetAccessorDeclaration } from "../declarations/GetAccessorDeclaration";
import type { MethodDeclaration } from "../declarations/MethodDeclaration";
import type { SetAccessorDeclaration } from "../declarations/SetAccessorDeclaration";
import type { PropertyAssignment } from "./PropertyAssignment";
import type { ShorthandPropertyAssignment } from "./ShorthandPropertyAssignment";
import type { SpreadAssignment } from "./SpreadAssignment";

/**
 * Any member of an {@link ObjectLiteralExpression}.
 *
 * Assignment, shorthand and spread entries coexist with methods and accessors.
 * Class-only fields and constructors are excluded from this object-member union.
 *
 * @evidence contracts/common.md#principled-implementation The six alternatives distinguish data assignments, spread, methods and accessors supported by object-literal printing, excluding class-only member shapes.
 * @evidence contracts/common.md#clear-and-simple-design Concrete member types share one union rather than a member record with unrelated optional payloads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Object-member alternatives retain their real syntax roles without routing unsupported class entries through a guessed assignment form.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains accepted categories and the class-member boundary, with a separated tag block following documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ObjectLiteralElement =
  | PropertyAssignment
  | ShorthandPropertyAssignment
  | SpreadAssignment
  | MethodDeclaration
  | GetAccessorDeclaration
  | SetAccessorDeclaration;
