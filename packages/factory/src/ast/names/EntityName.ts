import type { Identifier } from "./Identifier";
import type { QualifiedName } from "./QualifiedName";

/**
 * A bare or qualified entity name: an {@link Identifier} or a dotted
 * {@link QualifiedName}, used by type references and import-equals aliases.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Identifier and recursive QualifiedName represent bare and dotted entity references without admitting arbitrary expressions.
 * @evidence contracts/common.md#clear-and-simple-design This alias owns the two alternatives shared by type-name consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives describe syntax forms, not a special consumer or fixture.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes bare and qualified names and identifies type-reference and import-equals uses; concise separated prose follows the documentation skill.
 */
export type EntityName = Identifier | QualifiedName;
