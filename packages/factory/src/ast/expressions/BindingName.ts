import type { Identifier } from "../names/Identifier";
import type { ArrayBindingPattern } from "./ArrayBindingPattern";
import type { ObjectBindingPattern } from "./ObjectBindingPattern";

/**
 * A binding name — an identifier or a destructuring pattern.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type BindingName =
  | Identifier
  | ObjectBindingPattern
  | ArrayBindingPattern;
