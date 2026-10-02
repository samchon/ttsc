import type { Identifier } from "../names/Identifier";

/**
 * An `export as namespace X` declaration.
 *
 * Built by {@link factory.createNamespaceExportDeclaration}.
 *
 * @evidence contracts/common.md#principled-implementation One Identifier preserves the name in export-as-namespace syntax; declaration-file/module context legality remains unchecked.
 * @evidence contracts/common.md#clear-and-simple-design A name-only payload needs no module source because this form declares namespace exposure rather than re-exporting a target.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The name is supplied data without patching runtime globals or hardcoding consumer namespaces.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates export-as-namespace and labels its exposure name; separated comments follow the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamespaceExportDeclaration {
  /** Discriminant tag; always `"NamespaceExportDeclaration"`. */
  kind: "NamespaceExportDeclaration";

  /** Namespace exposed after export as namespace. */
  name: Identifier;
}
