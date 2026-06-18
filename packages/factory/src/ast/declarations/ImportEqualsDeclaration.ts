import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { ModuleReference } from "./ModuleReference";

/**
 * An `import x = require(...)` / `import x = ns.y` declaration.
 *
 * Built by {@link factory.createImportEqualsDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportEqualsDeclaration {
  /** Discriminant tag; always `"ImportEqualsDeclaration"`. */
  kind: "ImportEqualsDeclaration";

  /** Modifiers. */
  modifiers?: readonly ModifierLike[];

  /** IsTypeOnly. */
  isTypeOnly: boolean;

  /** Name. */
  name: Identifier;

  /** ModuleReference. */
  moduleReference: ModuleReference;
}
