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
 * @evidence contracts/common.md#principled-implementation
 *   Undefined importClause represents a side-effect import. String module
 *   targets become StringLiteral while supplied expression nodes stay unchanged.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Bindings are delegated to ImportClause and quote representation to the
 *   string builder; this node only joins them into the import statement.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A module target describes source syntax, not a loader or resolution patch.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains omitted bindings and string normalization, with a
 *   concrete import example and separate acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
