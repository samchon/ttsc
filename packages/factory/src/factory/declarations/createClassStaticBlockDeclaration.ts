import type { Block, ClassStaticBlockDeclaration } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ClassStaticBlockDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param body The body.
 * @returns The created {@link ClassStaticBlockDeclaration}.
 */
export const createClassStaticBlockDeclaration = (
  body: Block,
): ClassStaticBlockDeclaration => make("ClassStaticBlockDeclaration", { body });
