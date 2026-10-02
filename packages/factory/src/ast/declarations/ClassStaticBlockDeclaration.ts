import type { Block } from "../statements/Block";

/**
 * A class `static { ... }` initialization block.
 *
 * Built by {@link factory.createClassStaticBlockDeclaration}.
 *
 * @evidence contracts/common.md#principled-implementation A distinct class-static-block kind and required Block preserve static initialization syntax without performing initialization.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper owns static placement while Block owns its statement sequence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is represented source syntax, not a runtime class patch or hidden initialization hook.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates static-block syntax and identifies initialization body; native spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ClassStaticBlockDeclaration {
  /** Discriminant tag; always `"ClassStaticBlockDeclaration"`. */
  kind: "ClassStaticBlockDeclaration";

  /** Initialization statements inside the static block. */
  body: Block;
}
