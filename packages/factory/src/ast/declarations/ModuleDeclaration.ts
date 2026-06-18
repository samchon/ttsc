import type { NodeFlags } from "../../syntax";
import type { ModifierLike } from "../names/ModifierLike";
import type { ModuleBody } from "./ModuleBody";
import type { ModuleName } from "./ModuleName";

/**
 * A `namespace` / `module` declaration.
 *
 * Built by {@link factory.createModuleDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ModuleDeclaration {
  /** Discriminant tag; always `"ModuleDeclaration"`. */
  kind: "ModuleDeclaration";

  /** Modifiers. */
  modifiers?: readonly ModifierLike[];

  /** Name. */
  name: ModuleName;

  /** Body. */
  body?: ModuleBody;

  /** Flags. */
  flags: NodeFlags;
}
