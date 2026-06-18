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
  | SpreadAssignment;
