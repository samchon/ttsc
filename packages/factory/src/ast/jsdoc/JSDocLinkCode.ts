import type { EntityName } from "../names/EntityName";
import type { JSDocMemberName } from "./JSDocMemberName";

/**
 * An inline `{@linkcode name text}` JSDoc reference.
 *
 * Built by {@link factory.createJSDocLinkCode}.
 *
 * Documentation consumers interpret the code-style link marker. The printer
 * emits that marker and appends text verbatim, so a label after a name must
 * carry its own leading separator. An absent name emits only the text.
 *
 * @evidence contracts/common.md#principled-implementation The linkcode discriminant preserves the code-style link spelling while optional structured names and raw text retain the supported named and text-only forms without resolving targets.
 * @evidence contracts/common.md#clear-and-simple-design Two payload fields separate a reusable name node from label text; code rendering is indicated by the node kind rather than another option.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Code-style intent is expressed through a supported syntax node, not by changing documentation tooling or recognizing particular labels.
 * @evidence contracts/common.md#meaningful-documentation The native prose identifies the consumer's styling responsibility and the missing-target and spacing behavior, with separated paragraphs and members under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocLinkCode {
  /** Discriminant tag; always `"JSDocLinkCode"`. */
  kind: "JSDocLinkCode";

  /** The linked name, if any. */
  name?: EntityName | JSDocMemberName;

  /** Verbatim suffix; include a leading space to separate it from the name. */
  text: string;
}
