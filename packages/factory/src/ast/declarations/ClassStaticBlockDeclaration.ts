import type { Block } from "../statements/Block";

/**
 * A class `static { ... }` initialization block.
 *
 * Built by {@link factory.createClassStaticBlockDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A distinct class-static-block kind and required Block preserve static initialization syntax without performing initialization.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper owns static placement while Block owns its statement sequence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is represented source syntax, not a runtime class patch or hidden initialization hook.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates static-block syntax and identifies initialization body; native spacing follows the documentation skill.
 */
export interface ClassStaticBlockDeclaration {
  /** Discriminant tag; always `"ClassStaticBlockDeclaration"`. */
  kind: "ClassStaticBlockDeclaration";

  /** Initialization statements inside the static block. */
  body: Block;
}
