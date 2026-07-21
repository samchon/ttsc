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
 * and takes it in this position; this factory took a boolean here, which read a
 * modern first argument as `isTypeOnly` and could not express `defer` at all.
 *
 * Given a default binding `Def` plus named import `a`, this prints:
 *
 * ```ts
 * (Def, { a });
 * ```
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
