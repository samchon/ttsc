import type { ClassDeclaration } from "../declarations/ClassDeclaration";
import type { EnumDeclaration } from "../declarations/EnumDeclaration";
import type { FunctionDeclaration } from "../declarations/FunctionDeclaration";
import type { InterfaceDeclaration } from "../declarations/InterfaceDeclaration";
import type { TypeAliasDeclaration } from "../declarations/TypeAliasDeclaration";

/**
 * Any named, top-level declaration statement.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type Declaration =
  | FunctionDeclaration
  | ClassDeclaration
  | InterfaceDeclaration
  | TypeAliasDeclaration
  | EnumDeclaration;
