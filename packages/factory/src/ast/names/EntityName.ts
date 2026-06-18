import type { Identifier } from "./Identifier";
import type { QualifiedName } from "./QualifiedName";

/**
 * A name in type space — an {@link Identifier} or a dotted {@link QualifiedName}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type EntityName = Identifier | QualifiedName;
