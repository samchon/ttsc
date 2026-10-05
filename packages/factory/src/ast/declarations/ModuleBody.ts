import type { ModuleBlock } from "./ModuleBlock";
import type { ModuleDeclaration } from "./ModuleDeclaration";

/**
 * The body of a namespace / module declaration.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation ModuleBlock and nested ModuleDeclaration distinguish a braced body from continued namespace qualification, using recursive declarations without arbitrary expression bodies.
 * @evidence contracts/common.md#clear-and-simple-design One alias owns the two body forms reused by ModuleDeclaration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Recursive alternatives encode supported syntax rather than wrappers that hide module-resolution failures.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies module-body ownership; native links and prose/tag separation follow the documentation skill.
 */
export type ModuleBody = ModuleBlock | ModuleDeclaration;
