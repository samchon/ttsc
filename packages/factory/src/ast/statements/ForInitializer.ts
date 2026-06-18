import type { Expression } from "../expressions/Expression";
import type { VariableDeclarationList } from "./VariableDeclarationList";

/**
 * The initializer of a `for` loop — a declaration list or an expression.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ForInitializer = VariableDeclarationList | Expression;
