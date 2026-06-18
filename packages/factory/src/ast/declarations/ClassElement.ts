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
