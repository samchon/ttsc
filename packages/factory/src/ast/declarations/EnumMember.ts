import type { Expression } from "../expressions/Expression";
import type { PropertyName } from "../names/PropertyName";

/**
 * A member of an enum declaration.
 *
 * Built by {@link factory.createEnumMember}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface EnumMember {
  /** Discriminant tag; always `"EnumMember"`. */
  kind: "EnumMember";

  /** The name. */
  name: PropertyName;

  /** The initializer, if any. */
  initializer?: Expression;
}
