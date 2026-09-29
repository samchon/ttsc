import type { EntityName } from "../../ast";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Normalize the string shorthand for an entity name to an identifier.
 *
 * Existing entity-name nodes keep their structure and identity. A string is
 * identifier text, not qualified-name syntax; callers needing dotted structure
 * construct a QualifiedName explicitly. Shared conversion keeps type-reference
 * and declaration builders from inventing separate name policies.
 *
 * @internal
 */
export const asEntityName = (name: string | EntityName): EntityName =>
  typeof name === "string" ? createIdentifier(name) : name;
