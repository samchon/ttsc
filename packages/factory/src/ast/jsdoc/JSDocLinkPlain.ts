import type { EntityName } from "../names/EntityName";
import type { JSDocMemberName } from "./JSDocMemberName";

/**
 * An inline `{@linkplain name text}` JSDoc reference.
 *
 * Built by {@link factory.createJSDocLinkPlain}.
 *
 * Documentation consumers interpret the plain-style link marker. The printer
 * appends text without a separator after a present name; a label therefore
 * carries its own leading space. An absent name leaves a text-only reference.
 *
 * @evidence contracts/common.md#principled-implementation The linkplain kind distinguishes plain-style link syntax; an optional structured target and required suffix retain the supported forms without establishing that a target resolves.
 * @evidence contracts/common.md#clear-and-simple-design Styling follows the literal kind, and target structure remains separate from text instead of adding a generic style switch or parsing labels.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The public plain-link node expresses styling intent without consumer-specific labels, foreign method replacement or a compensating lookup path.
 * @evidence contracts/common.md#meaningful-documentation Native prose states styling ownership, absent-name behavior and caller-owned spacing, with member and paragraph separation following the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocLinkPlain {
  /** Discriminant tag; always `"JSDocLinkPlain"`. */
  kind: "JSDocLinkPlain";

  /** The linked name, if any. */
  name?: EntityName | JSDocMemberName;

  /** Verbatim suffix; include a leading space to separate it from the name. */
  text: string;
}
