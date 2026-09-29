import type { Expression } from "../expressions/Expression";
import type { ModifierLike } from "../names/ModifierLike";
import type { ImportClause } from "./ImportClause";

/**
 * An `import` declaration.
 *
 * Built by {@link factory.createImportDeclaration}.
 *
 * The module operand normally is a string literal. The broad Expression
 * field does not restrict its grammar or resolve the named module.
 *
 * @evidence contracts/common.md#principled-implementation Optional ImportClause distinguishes side-effect imports from bindings; required module operand is preserved but its broad Expression shape does not validate a string specifier.
 * @evidence contracts/common.md#clear-and-simple-design The declaration owns module attachment and leading modifiers; ImportClause owns binding and phase detail.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Module operands come from callers without special package substitution or foreign loader mutation.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states operand restrictions and native members explain absent side-effect binding; paragraph separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportDeclaration {
  /** Discriminant tag; always `"ImportDeclaration"`. */
  kind: "ImportDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The import clause; omitted for a side-effect-only import. */
  importClause?: ImportClause;

  /** The module specifier (the `from` target). */
  moduleSpecifier: Expression;
}
