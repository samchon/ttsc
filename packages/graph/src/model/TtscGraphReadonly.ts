/**
 * Recursively readonly view of compiler graph records and arrays.
 *
 * @evidence contracts/common.md#principled-implementation Recursive mapped properties and array elements prevent typed consumers from mutating nested snapshot facts.
 * @evidence contracts/common.md#clear-and-simple-design One view type preserves the wire DTO shapes while expressing snapshot ownership separately from mutable result projections.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Readonly applies to nested arrays and records rather than only the outer graph array.
 * @evidence contracts/common.md#meaningful-documentation Native prose names compiler records and arrays as the supported view boundary.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export type TtscGraphReadonly<T> = T extends readonly (infer Element)[]
  ? readonly TtscGraphReadonly<Element>[]
  : T extends object
    ? { readonly [Key in keyof T]: TtscGraphReadonly<T[Key]> }
    : T;
