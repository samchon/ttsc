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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
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
