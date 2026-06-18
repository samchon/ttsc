import type { EntityName } from "../names/EntityName";
import type { JSDocMemberName } from "./JSDocMemberName";

/**
 * A name reference in JSDoc, used by tags like `@see`.
 *
 * Built by {@link factory.createJSDocNameReference}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocNameReference {
  /** Discriminant tag; always `"JSDocNameReference"`. */
  kind: "JSDocNameReference";

  /** The referenced name. */
  name: EntityName | JSDocMemberName;
}
