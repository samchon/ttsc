import type { EntityName } from "./EntityName";
import type { Identifier } from "./Identifier";

/**
 * A dotted entity name used in type space, e.g. `ns.Type`.
 *
 * Built by {@link factory.createQualifiedName}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface QualifiedName {
  /** Discriminant tag; always `"QualifiedName"`. */
  kind: "QualifiedName";

  /** The left-hand qualifier. */
  left: EntityName;

  /** The right-hand identifier. */
  right: Identifier;
}
