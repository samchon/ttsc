import type { SyntaxKind } from "../../syntax";
import type { Identifier } from "../names/Identifier";

/**
 * A meta-property, e.g. `import.meta` or `new.target`.
 *
 * Built by {@link factory.createMetaProperty}.
 *
 * Supply a legal keyword/name pair such as `import` with `meta` or `new` with
 * `target`, in a context that allows it. SyntaxKind permits unrelated tokens
 * and does not enforce those pairs.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Keyword and identifier retain the two parts of meta-property syntax; the broad token and identifier fields require caller validation of the permitted pair and enclosing context.
 * @evidence contracts/common.md#clear-and-simple-design Two direct constituents represent the dotted form without inferring the keyword from the name or introducing a special property-access receiver.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The keyword/name pair is explicit input rather than a patched import object or guessed new-target value.
 * @evidence contracts/common.md#meaningful-documentation Native prose states valid pairs and the broad token-type limitation; member comments identify the leading keyword and following member with separated tags.
 */
export interface MetaProperty {
  /** Discriminant tag; always `"MetaProperty"`. */
  kind: "MetaProperty";

  /** Leading keyword, normally ImportKeyword or NewKeyword. */
  keywordToken: SyntaxKind;

  /** Meta-property member following the dot, normally `meta` or `target`. */
  name: Identifier;
}
