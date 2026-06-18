import type { ModuleBlock } from "./ModuleBlock";
import type { ModuleDeclaration } from "./ModuleDeclaration";

/**
 * The body of a namespace / module declaration.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ModuleBody = ModuleBlock | ModuleDeclaration;
