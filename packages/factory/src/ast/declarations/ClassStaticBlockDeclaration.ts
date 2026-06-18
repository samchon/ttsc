import type { Block } from "../statements/Block";

/**
 * A class `static { ... }` initialization block.
 *
 * Built by {@link factory.createClassStaticBlockDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ClassStaticBlockDeclaration {
  /** Discriminant tag; always `"ClassStaticBlockDeclaration"`. */
  kind: "ClassStaticBlockDeclaration";

  /** Body. */
  body: Block;
}
