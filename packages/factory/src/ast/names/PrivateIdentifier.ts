/**
 * A private class member name, e.g. `#secret`.
 *
 * Built by {@link factory.createPrivateIdentifier}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A distinct kind and text including # preserve private-name spelling; class-scope legality is not checked here.
 * @evidence contracts/common.md#clear-and-simple-design The private name retains only its syntax identity and spelling, separate from declaration payloads.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The # marker is language syntax, not an exception for particular callers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc and text documentation explain the leading # convention and constructor; member spacing follows the documentation skill.
 */
export interface PrivateIdentifier {
  /** Discriminant tag; always `"PrivateIdentifier"`. */
  kind: "PrivateIdentifier";

  /** The private name, including the leading `#`. */
  text: string;
}
