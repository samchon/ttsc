import type { StringLiteral } from "../expressions/StringLiteral";
import type { Identifier } from "../names/Identifier";

/**
 * The name of a namespace / module declaration.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ModuleName = Identifier | StringLiteral;
