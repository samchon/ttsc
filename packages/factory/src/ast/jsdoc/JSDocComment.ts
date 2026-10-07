import type { JSDocLink } from "./JSDocLink";
import type { JSDocLinkCode } from "./JSDocLinkCode";
import type { JSDocLinkPlain } from "./JSDocLinkPlain";
import type { JSDocText } from "./JSDocText";

/**
 * An inline piece of a JSDoc comment body: plain text or one of the inline
 * `{@link}` variants.
 *
 * A fragment array is concatenated without inserted separators. Text fragments
 * supply any spaces required around inline references.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The union admits plain text and the three distinct inline-link spellings, giving the printer a kind for each supported body fragment without admitting block tags.
 * @evidence contracts/common.md#clear-and-simple-design Reusing four concrete fragment types keeps each payload with its own syntax instead of an open object with unrelated optional fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The union enumerates supported fragment syntax directly; custom text remains an explicit text node rather than a special case selected by a consumer name.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains concatenation and caller-owned separators, keeping that usage rule in its own paragraph before tags under the documentation guidance.
 */
export type JSDocComment =
  | JSDocText
  | JSDocLink
  | JSDocLinkCode
  | JSDocLinkPlain;
