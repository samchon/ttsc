import type { Identifier } from "../names/Identifier";

/**
 * A namespace import, e.g. `* as ns`.
 *
 * Built by {@link factory.createNamespaceImport}.
 *
 * @evidence contracts/common.md#principled-implementation Required Identifier preserves the local binding after * as without resolving the imported module's members.
 * @evidence contracts/common.md#clear-and-simple-design One binding-name field leaves source attachment to ImportDeclaration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The local namespace name is supplied data without consumer-specific aliases.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates namespace import spelling and identifies the local binding; native spacing follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamespaceImport {
  /** Discriminant tag; always `"NamespaceImport"`. */
  kind: "NamespaceImport";

  /** Local namespace binding following as. */
  name: Identifier;
}
