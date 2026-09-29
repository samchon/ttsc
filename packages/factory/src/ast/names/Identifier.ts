/**
 * An identifier: a name such as a variable, type, property, or keyword
 * reference.
 *
 * Built by {@link factory.createIdentifier}.
 *
 * Text is supplied spelling; this representation does not validate a name
 * against identifier grammar or its declaration context.
 *
 * @evidence contracts/common.md#principled-implementation The Identifier tag distinguishes a name from quoted literals; text retains caller spelling rather than asserting grammatical validity.
 * @evidence contracts/common.md#clear-and-simple-design Kind and spelling are the complete name payload, without binding or compiler state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The discriminant is a syntax category; no consumer name is encoded into the representation.
 * @evidence contracts/common.md#meaningful-documentation JSDoc describes name use and unchecked spelling; paragraph separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface Identifier {
  /** Discriminant tag; always `"Identifier"`. */
  kind: "Identifier";

  /** The identifier text. */
  text: string;
}
