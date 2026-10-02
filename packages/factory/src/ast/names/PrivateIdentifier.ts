/**
 * A private class member name, e.g. `#secret`.
 *
 * Built by {@link factory.createPrivateIdentifier}.
 *
 * @evidence contracts/common.md#principled-implementation A distinct kind and text including # preserve private-name spelling; class-scope legality is not checked here.
 * @evidence contracts/common.md#clear-and-simple-design The private name retains only its syntax identity and spelling, separate from declaration payloads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The # marker is language syntax, not an exception for particular callers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc and text documentation explain the leading # convention and constructor; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PrivateIdentifier {
  /** Discriminant tag; always `"PrivateIdentifier"`. */
  kind: "PrivateIdentifier";

  /** The private name, including the leading `#`. */
  text: string;
}
