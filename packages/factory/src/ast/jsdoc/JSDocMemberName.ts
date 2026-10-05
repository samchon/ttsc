import type { EntityName } from "../names/EntityName";
import type { Identifier } from "../names/Identifier";

/**
 * A `Class#method` reference in JSDoc.
 *
 * Built by {@link factory.createJSDocMemberName}.
 *
 * The left side may itself be a member reference, preserving a chain of `#`
 * selections. Names are printed structurally without resolving their targets.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A recursive owner and identifier member express a hash-separated name chain while retaining the distinction between entity names and instance-member selections.
 * @evidence contracts/common.md#clear-and-simple-design The two sides are the only payload; recursive composition handles longer chains without parallel flattened-name storage.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The hash separator belongs to the represented name grammar, while arbitrary owner and member nodes remain caller data rather than patched symbol tables.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains recursive chains and unresolved targets, and member comments identify owner and selection with paragraph and field separation required by the documentation guidance.
 */
export interface JSDocMemberName {
  /** Discriminant tag; always `"JSDocMemberName"`. */
  kind: "JSDocMemberName";

  /** Owning entity or preceding member selection. */
  left: EntityName | JSDocMemberName;

  /** Instance member selected after the `#` separator. */
  right: Identifier;
}
