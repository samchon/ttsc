/**
 * The JSDoc all type `*`.
 *
 * Built by {@link factory.createJSDocAllType}.
 *
 * This is the bare JSDoc wildcard, distinct from a TypeScript keyword node.
 *
 * @evidence contracts/common.md#principled-implementation A payload-free literal kind represents the JSDoc wildcard because its spelling is always an asterisk and has no child operands.
 * @evidence contracts/common.md#clear-and-simple-design One discriminant captures the complete wildcard form without storing redundant spelling or a separate wildcard flag.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed kind is the syntax identity of the wildcard, not a fixture answer or a consumer-dependent override.
 * @evidence contracts/common.md#meaningful-documentation The native description states the wildcard spelling and its distinction from a TypeScript keyword, with prose separated from acknowledgment tags as required by the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocAllType {
  /** Discriminant tag; always `"JSDocAllType"`. */
  kind: "JSDocAllType";
}
