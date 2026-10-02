/**
 * Recursively readonly view of compiler graph records and arrays.
 *
 * @evidence contracts/common.md#principled-implementation Recursive mapped properties and array elements prevent typed consumers from mutating nested snapshot facts.
 * @evidence contracts/common.md#clear-and-simple-design One view type preserves the wire DTO shapes while expressing snapshot ownership separately from mutable result projections.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Readonly applies to nested arrays and records rather than only the outer graph array.
 * @evidence contracts/common.md#meaningful-documentation Native prose names compiler records and arrays as the supported view boundary.
 */
export type TtscGraphReadonly<T> = T extends readonly (infer Element)[]
  ? readonly TtscGraphReadonly<Element>[]
  : T extends object
    ? { readonly [Key in keyof T]: TtscGraphReadonly<T[Key]> }
    : T;
