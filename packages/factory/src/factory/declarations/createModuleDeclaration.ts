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
 * Create a {@link ModuleDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The modifiers.
 * @param name The name.
 * @param body The body.
 * @param flags The flags.
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
