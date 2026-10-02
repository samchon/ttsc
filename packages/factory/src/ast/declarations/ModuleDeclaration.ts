import type { NodeFlags } from "../../syntax";
import type { ModifierLike } from "../names/ModifierLike";
import type { ModuleBody } from "./ModuleBody";
import type { ModuleName } from "./ModuleName";

/**
 * A `namespace` / `module` declaration.
 *
 * Built by {@link factory.createModuleDeclaration}.
 *
 * A string-literal name always prints as module. For an identifier, the
 * Namespace flag selects namespace; other flags select module. An omitted
 * body denotes a bodyless declaration ending with a semicolon.
 *
 * @evidence contracts/common.md#principled-implementation ModuleName preserves quoted versus identifier names, and optional recursive body retains declaration shape; Namespace selects identifier keyword spelling without validating arbitrary NodeFlags.
 * @evidence contracts/common.md#clear-and-simple-design Name/body/flags separate syntax choices; ModuleBody owns recursive qualification and statement grouping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Flags are documented syntax choices rather than OS or consumer-specific module patches.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains keyword selection and absent bodies in separate paragraphs; role-specific member comments follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ModuleDeclaration {
  /** Discriminant tag; always `"ModuleDeclaration"`. */
  kind: "ModuleDeclaration";

  /** Leading modifiers and decorators, if supplied. */
  modifiers?: readonly ModifierLike[];

  /** Identifier namespace/module name or quoted external module name. */
  name: ModuleName;

  /** Braced or nested declaration body; absent for a bodyless declaration. */
  body?: ModuleBody;

  /** Namespace selects namespace for identifier names; quoted names always use module. */
  flags: NodeFlags;
}
