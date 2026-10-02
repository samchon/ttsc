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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscGraphNodeModifier declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscGraphNodeModifier declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscGraphNodeModifier declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscGraphNodeModifier declares a data shape or groups members and performs no filesystem, path or process operation.
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
