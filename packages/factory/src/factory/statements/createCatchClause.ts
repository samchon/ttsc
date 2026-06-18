import type { Block, CatchClause, VariableDeclaration } from "../../ast";
import { make } from "../internal/make";
import { createVariableDeclaration } from "./createVariableDeclaration";

/**
 * Create a {@link CatchClause}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param variableDeclaration The variableDeclaration.
 * @param block The block.
 * @returns The created {@link CatchClause}.
 */
export const createCatchClause = (
  variableDeclaration: string | VariableDeclaration | undefined,
  block: Block,
): CatchClause =>
  make("CatchClause", {
    variableDeclaration:
      typeof variableDeclaration === "string"
        ? createVariableDeclaration(
            variableDeclaration,
            undefined,
            undefined,
            undefined,
          )
        : variableDeclaration,
    block,
  });
