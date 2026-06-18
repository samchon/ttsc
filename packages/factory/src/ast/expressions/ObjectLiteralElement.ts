import type { GetAccessorDeclaration } from "../declarations/GetAccessorDeclaration";
import type { MethodDeclaration } from "../declarations/MethodDeclaration";
import type { SetAccessorDeclaration } from "../declarations/SetAccessorDeclaration";
import type { PropertyAssignment } from "./PropertyAssignment";
import type { ShorthandPropertyAssignment } from "./ShorthandPropertyAssignment";
import type { SpreadAssignment } from "./SpreadAssignment";

/**
 * Any member of an {@link ObjectLiteralExpression}.
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
