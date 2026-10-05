import type { Identifier } from "../names/Identifier";
import type { ArrayBindingPattern } from "./ArrayBindingPattern";
import type { ObjectBindingPattern } from "./ObjectBindingPattern";

/**
 * A binding name: an identifier or a destructuring pattern.
 *
 * It excludes access expressions, which can be assignment targets but cannot
 * introduce a local binding in a declaration.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Identifier and the two binding patterns represent declaration bindings; property and element accesses remain outside this union because they do not introduce names.
 * @evidence contracts/common.md#clear-and-simple-design The union reuses three concrete node shapes without a general expression wrapper or duplicate binding schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Destructuring is represented directly rather than converted into artificial identifiers for printing.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the declaration-binding boundary and exclusion of access targets, with a separate acknowledgment block under documentation guidance.
 */
export type BindingName =
  | Identifier
  | ObjectBindingPattern
  | ArrayBindingPattern;
