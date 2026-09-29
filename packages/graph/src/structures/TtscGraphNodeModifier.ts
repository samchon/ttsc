/**
 * A declaration modifier carried on a symbol {@link ITtscGraphNode}, when the
 * declaration pass records it. Used by projections that reason about visibility
 * and shape — e.g. a public-API overview filters on `export`, a class outline
 * separates `static` members.
 *
 * @evidence contracts/common.md#principled-implementation The literal union represents the declaration modifiers the native pass records, without assigning runtime behavior to absent modifiers.
 * @evidence contracts/common.md#clear-and-simple-design Shared modifier values serve node presentation and projection decisions without separate visibility flags for each consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Visibility comes from compiler facts rather than naming conventions for private symbols.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains optional collection and the visibility/shape use cases.
 */
export type TtscGraphNodeModifier =
  | "export"
  | "default"
  | "declare"
  | "abstract"
  | "static"
  | "readonly"
  | "async"
  | "const"
  | "public"
  | "private"
  | "protected";
