import type { EntityName } from "../names/EntityName";
import type { JSDocMemberName } from "./JSDocMemberName";

/**
 * A name reference in JSDoc, used by tags like `@see`.
 *
 * Built by {@link factory.createJSDocNameReference}.
 *
 * The printer emits the contained name without decoration. The wrapper does
 * not check that the named entity or member exists.
 *
 * @evidence contracts/common.md#principled-implementation A required entity or member name supplies the target syntax for reference-bearing tags while explicitly leaving symbol resolution outside this printable representation.
 * @evidence contracts/common.md#clear-and-simple-design One required name wraps the reference role without duplicating the entity or member name's internal structure.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper retains a structured caller target and introduces no guessed lookup result or consumer-specific resolution fallback.
 * @evidence contracts/common.md#meaningful-documentation The native prose explains undecorated output and the absence of target validation, with distinct explanatory paragraphs and separated tags under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocNameReference {
  /** Discriminant tag; always `"JSDocNameReference"`. */
  kind: "JSDocNameReference";

  /** The referenced name. */
  name: EntityName | JSDocMemberName;
}
