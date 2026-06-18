import type {
  Identifier,
  ImportEqualsDeclaration,
  ModifierLike,
  ModuleReference,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ImportEqualsDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The modifiers.
 * @param isTypeOnly The isTypeOnly.
 * @param name The name.
 * @param moduleReference The moduleReference.
 * @returns The created {@link ImportEqualsDeclaration}.
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
