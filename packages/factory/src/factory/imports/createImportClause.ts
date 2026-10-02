import type {
  Identifier,
  ImportClause,
  NamedImports,
  NamespaceImport,
} from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create an {@link ImportClause}: the part of an import statement between
 * `import` and `from`.
 *
 * The `name` is the default-import binding, if any. The `namedBindings` slot
 * holds either a {@link NamedImports} brace group or a {@link NamespaceImport}. A
 * default binding and named bindings can appear together, joined by a comma.
 *
 * The `phaseModifier` is the keyword between `import` and the bindings:
 * `SyntaxKind.TypeKeyword` for a type-only import, `SyntaxKind.DeferKeyword`
 * for `import defer`. Upstream calls the pair `ImportPhaseModifierSyntaxKind`
 * and takes it in this position. The keyword-valued field preserves both forms
 * without reducing their distinction to a type-only boolean.
 *
 * Given a default binding `Def` plus named import `a`, this prints:
 *
 * ```ts
 * Def, { a }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The phase kind distinguishes type from defer; optional default and named
 *   bindings occupy different slots so the printer joins both in source order.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This clause describes bindings only; module specifiers and statement syntax
 *   belong to ImportDeclaration rather than another import policy here.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Explicit keyword kinds preserve defer instead of treating every phase as
 *   the old boolean type-only flag.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes binding slots and phase keywords, with the corrected
 *   bare-clause example separated from acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param phaseModifier The `type` or `defer` keyword, if any.
 * @param name The name.
 * @param namedBindings The named or namespace bindings, if any.
 * @returns The created {@link ImportClause}.
 */
export const createImportClause = (
  phaseModifier?: SyntaxKind.TypeKeyword | SyntaxKind.DeferKeyword,
  name?: Identifier,
  namedBindings?: NamedImports | NamespaceImport,
): ImportClause => make("ImportClause", { phaseModifier, name, namedBindings });
