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
 * @evidence contracts/common.md#principled-implementation
 *   String catch bindings become bare VariableDeclaration; omitted bindings
 *   remain absent and supplied declaration patterns are retained with the Block.
 *   Catch-specific grammar restrictions remain the caller's responsibility.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Binding normalization shares createVariableDeclaration; handler statements
 *   stay in Block and guarded/finally blocks belong to TryStatement.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No error is caught during construction or replaced with a successful value.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains omitted, string and declaration bindings and handler ownership,
 *   with a catch example separated from acknowledgment paragraphs.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param variableDeclaration The catch binding, or undefined to omit it.
 * @param block The handler body.
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
