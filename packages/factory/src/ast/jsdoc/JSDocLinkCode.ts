import type { EntityName } from "../names/EntityName";
import type { JSDocMemberName } from "./JSDocMemberName";

/**
 * An inline `{@linkcode name text}` JSDoc reference.
 *
 * Built by {@link factory.createJSDocLinkCode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocLinkCode {
  /** Discriminant tag; always `"JSDocLinkCode"`. */
  kind: "JSDocLinkCode";

  /** The linked name, if any. */
  name?: EntityName | JSDocMemberName;

  /** The trailing link text. */
  text: string;
}
