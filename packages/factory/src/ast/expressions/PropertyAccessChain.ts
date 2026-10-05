import type { Identifier } from "../names/Identifier";
import type { PrivateIdentifier } from "../names/PrivateIdentifier";
import type { Token } from "../names/Token";
import type { Expression } from "./Expression";

/**
 * An optional property access, e.g. `a?.b`.
 *
 * Built by {@link factory.createPropertyAccessChain}.
 *
 * The marker controls this link. Without it, a plain dot continues optional
 * chaining established by the receiver. The name union does not enforce
 * contextual restrictions on private-name access.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Receiver, optional marker and member name represent one chain link; absence of the marker means continuation rather than converting the outline to an ordinary access, and private-name validity remains caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design This node holds only its link; earlier links remain in the receiver instead of being flattened into a second chain structure.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Optionality and member identity come from explicit syntax fields, not guessed nullability or patched receiver properties.
 * @evidence contracts/common.md#meaningful-documentation Native prose states marker absence and private-name limits, while field comments describe printed link effects with member and tag separation.
 */
export interface PropertyAccessChain {
  /** Discriminant tag; always `"PropertyAccessChain"`. */
  kind: "PropertyAccessChain";

  /** Receiver, possibly containing earlier optional-chain links. */
  expression: Expression;

  /** Presence prints `?.`; absence prints `.` as a chain continuation. */
  questionDotToken?: Token;

  /** Member identifier; callers ensure private-name access is legal. */
  name: Identifier | PrivateIdentifier;
}
