import type { JSDocLink } from "./JSDocLink";
import type { JSDocLinkCode } from "./JSDocLinkCode";
import type { JSDocLinkPlain } from "./JSDocLinkPlain";
import type { JSDocText } from "./JSDocText";

/**
 * An inline piece of a JSDoc comment body — plain text or one of the inline
 * `{@link}` variants.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JSDocComment =
  | JSDocText
  | JSDocLink
  | JSDocLinkCode
  | JSDocLinkPlain;
