import type {
  Identifier,
  ImportEqualsDeclaration,
  ModifierLike,
  ModuleReference,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create an {@link ImportEqualsDeclaration}: an `import x = ...` statement.
 *
 * The `modifiers` precede the `import` keyword, so an `export` modifier prints
 * `export import`. When `isTypeOnly` is true the printer inserts the `type`
 * keyword to make it a type-only import. The `name` is the local binding, and
 * `moduleReference` is the right-hand side, either an external module reference
 * such as `require("...")` or an entity name for an aliased namespace.
 *
 * Given an `export` modifier, `isTypeOnly` of false, the name `app`, and a
 * `require("./app")` module reference, the printed statement is:
 *
 * ```ts
 * export import app = require("./app");
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers, if any.
 * @param isTypeOnly Whether the import is type-only (`import type`).
 * @param name The local binding name.
 * @param moduleReference The right-hand side module or entity reference.
 * @returns The created {@link ImportEqualsDeclaration}.
 * @evidence contracts/common.md#principled-implementation
 *   Identifier normalization supplies the local binding; ModuleReference retains
 *   external require syntax or an entity-name alias, independently of type-only.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One import-equals node combines binding and reference without resolving
 *   modules; external-reference builders own require operand syntax.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Type-only and reference choices are caller fields, not live-module mutation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains exported/type-only forms and the two reference kinds,
 *   with separate import example and acknowledgment paragraphs.
 */
export const createImportEqualsDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  isTypeOnly: boolean,
  name: string | Identifier,
  moduleReference: ModuleReference,
): ImportEqualsDeclaration =>
  make("ImportEqualsDeclaration", {
    modifiers,
    isTypeOnly,
    name: asName(name),
    moduleReference,
  });
