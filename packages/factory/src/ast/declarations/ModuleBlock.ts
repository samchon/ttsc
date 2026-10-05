import type { Statement } from "../statements/Statement";

/**
 * The `{ ... }` body of a namespace / module.
 *
 * Built by {@link factory.createModuleBlock}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation An ordered Statement list preserves the brace body of a module/namespace, including placeholders; contextual validity of those statements remains unchecked.
 * @evidence contracts/common.md#clear-and-simple-design The body owns sequence while ModuleDeclaration owns its name and module/namespace choice.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Statement contents are supplied syntax, without consumer-specific module bodies or runtime global changes.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies namespace/module body use and statement order; separated native comments follow the documentation skill.
 */
export interface ModuleBlock {
  /** Discriminant tag; always `"ModuleBlock"`. */
  kind: "ModuleBlock";

  /** Namespace or module body statements in printed order. */
  statements: readonly Statement[];
}
