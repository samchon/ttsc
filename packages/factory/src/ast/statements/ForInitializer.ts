import type { Expression } from "../expressions/Expression";
import type { VariableDeclarationList } from "./VariableDeclarationList";

/**
 * The initializer of a `for` loop: a declaration list or an expression.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation VariableDeclarationList and Expression distinguish declaration-based from expression-based loop initialization; assignment-target legality remains contextual.
 * @evidence contracts/common.md#clear-and-simple-design One alias shares the two initialization forms across for-loop variants.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives describe syntax forms without fixture-specific iteration setup.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies both initializer categories; prose/tag separation follows the documentation skill.
 */
export type ForInitializer = VariableDeclarationList | Expression;
