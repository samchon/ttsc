import type { Identifier } from "../names/Identifier";
import type { Token } from "../names/Token";
import type { TypeNode } from "./TypeNode";

/**
 * A named tuple member, e.g. `[first: string]`.
 *
 * Built by {@link factory.createNamedTupleMember}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A label and element TypeNode plus optional rest/optional markers preserve named tuple syntax; marker combination legality is left to callers.
 * @evidence contracts/common.md#clear-and-simple-design Label, value type and marker presence are distinct fields, without positional flags.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The label is supplied syntax, with no fixture-specific tuple position rule.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates a labeled element and explains marker absence; separated member comments follow the documentation skill.
 */
export interface NamedTupleMember {
  /** Discriminant tag; always `"NamedTupleMember"`. */
  kind: "NamedTupleMember";

  /** Rest marker before the label, if present. */
  dotDotDotToken?: Token;

  /** Tuple element label. */
  name: Identifier;

  /** Optional marker after the label, if present. */
  questionToken?: Token;

  /** Type of the labeled tuple element. */
  type: TypeNode;
}
