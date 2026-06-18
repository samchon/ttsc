import type {
  Block,
  ConstructorDeclaration,
  ModifierLike,
  ParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConstructorDeclaration}: a class `constructor(...) { ... }`.
 *
 * The `modifiers` precede the `constructor` keyword. The `parameters` print
 * inside the parentheses, and a parameter that carries accessibility modifiers
 * such as `private readonly` becomes a parameter property. The `body` block is
 * the constructor body; when it holds no statements the printer collapses it to
 * `{}` on the same line.
 *
 * Given a single `private readonly value: number` parameter and an empty body,
 * the printed constructor is:
 *
 * ```ts
 * constructor(private readonly value: number) {}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param parameters The parameters.
 * @param body The body.
 * @returns The created {@link ConstructorDeclaration}.
 */
export const createConstructorDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  parameters: readonly ParameterDeclaration[],
  body: Block | undefined,
): ConstructorDeclaration =>
  make("ConstructorDeclaration", { modifiers, parameters, body });
