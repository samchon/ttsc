import type { StringLiteral } from "../expressions/StringLiteral";
import type { Identifier } from "../names/Identifier";

/**
 * The name of an {@link ImportAttribute}: either an identifier or a string
 * literal.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ImportAttributeName = Identifier | StringLiteral;
