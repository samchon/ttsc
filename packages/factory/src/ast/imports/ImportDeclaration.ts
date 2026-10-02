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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
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
