import type { PropertyName } from "../names/PropertyName";
import type { Token } from "../names/Token";
import type { BindingName } from "./BindingName";
import type { Expression } from "./Expression";

/**
 * An element of a destructuring binding pattern.
 *
 * Built by {@link factory.createBindingElement}.
 *
 * A source property name can differ from the local binding name. Defaults and
 * rest markers are syntax only; callers must provide a valid combination for
 * the enclosing object or array pattern.
 *
 * @evidence contracts/common.md#principled-implementation Independent source property and local BindingName fields preserve renamed destructuring; optional default and rest fields record their syntax without validating their combination.
 * @evidence contracts/common.md#clear-and-simple-design The element owns one local binding with optional mapping and default; enclosing patterns own collection order and punctuation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A rest marker and renamed property are explicit input syntax, not synthesized bindings compensating for a missing source property.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes source and local names and valid-context requirements; each optional member explains its effect with separated comments and tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface BindingElement {
  /** Discriminant tag; always `"BindingElement"`. */
  kind: "BindingElement";

  /** Presence prints the rest marker `...`; absence declares a normal binding. */
  dotDotDotToken?: Token;

  /** Source property when mapping it to a different local binding. */
  propertyName?: PropertyName;

  /** Local identifier or nested destructuring pattern. */
  name: BindingName;

  /** Optional default expression printed after `=`. */
  initializer?: Expression;
}
