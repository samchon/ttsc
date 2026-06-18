import type { PropertyName } from "../names/PropertyName";
import type { Token } from "../names/Token";
import type { BindingName } from "./BindingName";
import type { Expression } from "./Expression";

/**
 * An element of a destructuring binding pattern.
 *
 * Built by {@link factory.createBindingElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface BindingElement {
  /** Discriminant tag; always `"BindingElement"`. */
  kind: "BindingElement";

  /** DotDotDotToken. */
  dotDotDotToken?: Token;

  /** PropertyName. */
  propertyName?: PropertyName;

  /** Name. */
  name: BindingName;

  /** Initializer. */
  initializer?: Expression;
}
