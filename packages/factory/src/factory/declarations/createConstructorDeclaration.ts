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
 * the optional constructor body; when it holds no statements the printer
 * collapses it to `{}` on the same line. An omitted body yields a bodyless
 * signature ending with a semicolon.
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
 * @evidence contracts/common.md#principled-implementation
 *   ConstructorDeclaration retains ordered parameters and an optional Block;
 *   parameter modifiers express property declarations at the constructor context.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Parameter and Block builders own their contents; this node only supplies
 *   constructor-level modifiers and grouping without inventing a class name.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Supplied bodies remain unchanged, rather than synthesized initialization.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains accessibility-based parameter properties and empty-block
 *   layout, with separate example and acknowledgment paragraphs.
 */
export const createConstructorDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  parameters: readonly ParameterDeclaration[],
  body: Block | undefined,
): ConstructorDeclaration =>
  make("ConstructorDeclaration", { modifiers, parameters, body });
