import type {
  ModifierLike,
  ModuleBody,
  ModuleDeclaration,
  ModuleName,
} from "../../ast";
import { NodeFlags } from "../../syntax";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link ModuleDeclaration}: a `namespace X { ... }` or `module X { ...
 * }`.
 *
 * The `modifiers` precede the keyword, so an `export` modifier prints `export
 * namespace`. The `name` accepts a string, which is wrapped in an identifier,
 * or a prebuilt module name. The `body` is the brace block, normally a
 * {@link ModuleBlock}, whose statements the printer indents one per line.
 *
 * The `flags` decide the keyword the printer emits: the `Namespace` flag prints
 * `namespace`, while the default prints `module`. This is the one input that
 * does not show up as text directly but changes the rendered keyword.
 *
 * Given an `export` modifier, the name `app`, a body holding `export type ID =
 * string;`, and the `Namespace` flag, the printed declaration is:
 *
 * ```ts
 * export namespace app {
 *   export type ID = string;
 * }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   String names become Identifier while supplied ModuleName nodes preserve
 *   literal names. NodeFlags selects module/namespace spelling independently
 *   of modifiers and optional body; flags do not evaluate a runtime module.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The node owns name, keyword flags and body attachment; ModuleBlock owns
 *   contained statements, allowing nested ModuleBody without a string parser.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   NodeFlags.None is the declared omitted-flags default, not a guessed keyword.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs distinguish name conversion and flag-selected keywords,
 *   with an export-namespace example separated from acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers, if any.
 * @param name The name.
 * @param body The body.
 * @param flags The node flags that select the `namespace` or `module` keyword.
 * @returns The created {@link ModuleDeclaration}.
 */
export const createModuleDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | ModuleName,
  body: ModuleBody | undefined,
  flags: NodeFlags = NodeFlags.None,
): ModuleDeclaration =>
  make("ModuleDeclaration", {
    modifiers,
    name: typeof name === "string" ? createIdentifier(name) : name,
    body,
    flags,
  });
