import type { Expression } from "../expressions/Expression";
import type { ModifierLike } from "../names/ModifierLike";
import type { NamedExports } from "./NamedExports";
import type { NamespaceExport } from "./NamespaceExport";

/**
 * An `export` declaration.
 *
 * Built by {@link factory.createExportDeclaration}.
 *
 * The module operand normally is a string literal. Its broad Expression field
 * does not enforce that spelling or resolve a module.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Type-only flag, optional named/namespace clause and module operand preserve export forms, including star export; broad operand and clause combinations remain unchecked.
 * @evidence contracts/common.md#clear-and-simple-design Clause representation owns binding details while the declaration owns type-only and from attachment.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Module names and exported bindings come from callers without hardcoded package aliases.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains operand restrictions and comments distinguish absent star clause and module source; paragraphs follow the documentation skill.
 */
export interface ExportDeclaration {
  /** Discriminant tag; always `"ExportDeclaration"`. */
  kind: "ExportDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** Whether type follows export for a type-only declaration. */
  isTypeOnly: boolean;

  /** The export clause; omitted for `export *`. */
  exportClause?: NamedExports | NamespaceExport;

  /** The module specifier (the `from` target). */
  moduleSpecifier?: Expression;
}
