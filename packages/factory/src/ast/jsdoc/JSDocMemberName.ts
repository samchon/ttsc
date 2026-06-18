import type { EntityName } from "../names/EntityName";
import type { Identifier } from "../names/Identifier";

/**
 * A `Class#method` reference in JSDoc.
 *
 * Built by {@link factory.createJSDocMemberName}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocMemberName {
  /** Discriminant tag; always `"JSDocMemberName"`. */
  kind: "JSDocMemberName";

  /** The left-hand side. */
  left: EntityName | JSDocMemberName;

  /** The right-hand side. */
  right: Identifier;
}
