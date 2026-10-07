import type { StringLiteral } from "../expressions/StringLiteral";
import type { Identifier } from "../names/Identifier";

/**
 * The name of an {@link ImportAttribute}: either an identifier or a string
 * literal.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Identifier and StringLiteral retain bare and quoted attribute keys without admitting computed names.
 * @evidence contracts/common.md#clear-and-simple-design A shared two-variant alias owns key alternatives for ImportAttribute.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Syntax alternatives do not whitelist fixture-specific attribute names.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the owning attribute and distinguishes quoted keys; prose/tag separation follows the documentation skill.
 */
export type ImportAttributeName = Identifier | StringLiteral;
