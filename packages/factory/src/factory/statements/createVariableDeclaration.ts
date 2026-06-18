import type {
  BindingName,
  Expression,
  Token,
  TypeNode,
  VariableDeclaration,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link VariableDeclaration}: one `name = value` binding.
 *
 * The `name` is the binding target; a string becomes an identifier, while a
 * {@link BindingName} allows array or object destructuring such as `[a, b]`. The
 * `exclamationToken` adds the definite-assignment `!`, `type` adds a `: T`
 * annotation, and `initializer` adds `= value`. Each of those three is
 * optional.
 *
 * This node is a single declarator, not a full statement: it carries no `const`
 * / `let` / `var` keyword (that lives on the enclosing
 * {@link VariableDeclarationList}) and no trailing semicolon. With a `name` of
 * `x` and an `initializer` of `1`, it prints as:
 *
 * ```ts
 * x = 1;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name; a {@link BindingName} allows array / object
 *   destructuring (e.g. `const [a, b] = ...`).
 * @param exclamationToken The definite-assignment marker (`!`), if any.
 * @param type The type.
 * @param initializer The initializer, if any.
 * @returns The created {@link VariableDeclaration}.
 */
export const createVariableDeclaration = (
  name: string | BindingName,
  exclamationToken?: Token,
  type?: TypeNode,
  initializer?: Expression,
): VariableDeclaration =>
  make("VariableDeclaration", {
    name: typeof name === "string" ? createIdentifier(name) : name,
    exclamationToken,
    type,
    initializer,
  });
