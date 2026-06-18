import type { EntityName } from "../names/EntityName";
import type { JSDocMemberName } from "./JSDocMemberName";

/**
 * An inline `{@linkplain name text}` JSDoc reference.
 *
 * Built by {@link factory.createJSDocLinkPlain}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocLinkPlain {
  /** Discriminant tag; always `"JSDocLinkPlain"`. */
  kind: "JSDocLinkPlain";

  /** The linked name, if any. */
  name?: EntityName | JSDocMemberName;

  /** The trailing link text. */
  text: string;
}
