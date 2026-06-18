import type {
  Expression,
  ImportClause,
  ImportDeclaration,
  ModifierLike,
} from "../../ast";
import { make } from "../internal/make";
import { createStringLiteral } from "../literals/createStringLiteral";

/**
 * Create an {@link ImportDeclaration}: an `import ... from "..."` statement.
 *
 * The `importClause` carries the default binding, namespace binding, and named
 * bindings. Omit it to emit a side-effect-only import that just runs the module
 * for its effects. The `moduleSpecifier` is the `from` target; pass a raw
 * string and it is wrapped in a string literal for you, or pass an expression
 * node directly.
 *
 * Given a named import of `a` from `"./mod"`, this prints:
 *
 * ```ts
 * import { a } from "./mod";
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param importClause The import clause; omitted for a side-effect-only import.
 * @param moduleSpecifier The module specifier (the `from` target).
 * @returns The created {@link ImportDeclaration}.
 */
export const createImportDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  importClause: ImportClause | undefined,
  moduleSpecifier: Expression | string,
): ImportDeclaration =>
  make("ImportDeclaration", {
    modifiers,
    importClause,
    moduleSpecifier:
      typeof moduleSpecifier === "string"
        ? createStringLiteral(moduleSpecifier)
        : moduleSpecifier,
  });
