import type { Block, CatchClause, VariableDeclaration } from "../../ast";
import { make } from "../internal/make";
import { createVariableDeclaration } from "./createVariableDeclaration";

/**
 * Create a {@link CatchClause}: the `catch (...) { ... }` arm of a try.
 *
 * The `variableDeclaration` binds the caught value. Pass a string for the
 * common `catch (e)` case and it is turned into a bare binding; pass a full
 * {@link VariableDeclaration} when you need a type or destructuring pattern;
 * pass `undefined` for the binding-less `catch { ... }` form. The `block` is
 * the handler body.
 *
 * With `variableDeclaration` of `e` and a `block` calling `handle(e)`, the
 * result is:
 *
 * ```ts
 * catch (e) {
 *   handle(e);
 * }
 * ```
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
