import type { EntityName } from "../names/EntityName";
import type { JSDocMemberName } from "./JSDocMemberName";

/**
 * An inline `{@link name text}` JSDoc reference.
 *
 * Built by {@link factory.createJSDocLink}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocLink {
  /** Discriminant tag; always `"JSDocLink"`. */
  kind: "JSDocLink";

  /** The linked name, if any. */
  name?: EntityName | JSDocMemberName;

  /** The trailing link text. */
  text: string;
}
