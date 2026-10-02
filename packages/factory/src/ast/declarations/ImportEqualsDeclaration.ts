import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { ModuleReference } from "./ModuleReference";

/**
 * An `import x = require(...)` / `import x = ns.y` declaration.
 *
 * Built by {@link factory.createImportEqualsDeclaration}.
 *
 * @evidence contracts/common.md#principled-implementation Local name, type-only state and entity/external module reference preserve both import-equals forms; module resolution and context legality remain unchecked.
 * @evidence contracts/common.md#clear-and-simple-design ModuleReference owns the two reference alternatives while the declaration owns binding and type-only syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation records require syntax without installing a loader shim or hardcoding module targets.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates both reference forms and comments identify binding and type-only roles; member spacing follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportEqualsDeclaration {
  /** Discriminant tag; always `"ImportEqualsDeclaration"`. */
  kind: "ImportEqualsDeclaration";

  /** Leading modifiers and decorators, if supplied. */
  modifiers?: readonly ModifierLike[];

  /** Whether type precedes the local binding. */
  isTypeOnly: boolean;

  /** Local binding identifier before the equals sign. */
  name: Identifier;

  /** Entity alias or require-style reference after the equals sign. */
  moduleReference: ModuleReference;
}
