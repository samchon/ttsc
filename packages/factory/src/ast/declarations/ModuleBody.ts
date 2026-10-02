import type { ModuleBlock } from "./ModuleBlock";
import type { ModuleDeclaration } from "./ModuleDeclaration";

/**
 * The body of a namespace / module declaration.
 *
 * @evidence contracts/common.md#principled-implementation ModuleBlock and nested ModuleDeclaration distinguish a braced body from continued namespace qualification, using recursive declarations without arbitrary expression bodies.
 * @evidence contracts/common.md#clear-and-simple-design One alias owns the two body forms reused by ModuleDeclaration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Recursive alternatives encode supported syntax rather than wrappers that hide module-resolution failures.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies module-body ownership; native links and prose/tag separation follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ModuleBody = ModuleBlock | ModuleDeclaration;
