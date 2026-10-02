import type { Block, ClassStaticBlockDeclaration } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ClassStaticBlockDeclaration}: a `static { ... }` block.
 *
 * This is a class member that runs initialization code when the class is
 * evaluated. The `body` block holds the statements after the `static` keyword;
 * its `multiLine` flag controls forced versus width-dependent block layout.
 *
 * Given a body that assigns `count = 0`, the printed member is:
 *
 * ```ts
 * static {
 *   count = 0;
 * }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   A Block body inside ClassStaticBlockDeclaration models class-evaluation
 *   initialization syntax; constructing the node does not execute those statements.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Block owns statements and this class member owns their static context.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Static initialization is emitted syntax, not a runtime class mutation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc explains class-evaluation timing and body ownership, with a
 *   static-block example separated from its acknowledgment paragraphs.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param body The body.
 * @returns The created {@link ClassStaticBlockDeclaration}.
 */
export const createClassStaticBlockDeclaration = (
  body: Block,
): ClassStaticBlockDeclaration => make("ClassStaticBlockDeclaration", { body });
