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
 * @evidence contracts/common.md#principled-implementation The union admits plain text and the three distinct inline-link spellings, giving the printer a kind for each supported body fragment without admitting block tags.
 * @evidence contracts/common.md#clear-and-simple-design Reusing four concrete fragment types keeps each payload with its own syntax instead of an open object with unrelated optional fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The union enumerates supported fragment syntax directly; custom text remains an explicit text node rather than a special case selected by a consumer name.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains concatenation and caller-owned separators, keeping that usage rule in its own paragraph before tags under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JSDocComment =
  | JSDocText
  | JSDocLink
  | JSDocLinkCode
  | JSDocLinkPlain;
