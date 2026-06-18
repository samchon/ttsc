import type { ExpressionWithTypeArguments, HeritageClause } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link HeritageClause}: an `extends` or `implements` clause.
 *
 * This is the supertype list attached to a class or interface header. The
 * `token` selects the keyword the printer emits, either the `extends` or the
 * `implements` syntax kind. The `types` are the referenced supertypes, printed
 * after the keyword and separated by commas.
 *
 * Given the `implements` token and the types `IAnimal` and `ISerializable`, the
 * printed clause is:
 *
 * ```ts
 * implements IAnimal, ISerializable
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param token The `extends` or `implements` keyword.
 * @param types The constituent types.
 * @returns The created {@link HeritageClause}.
 */
export const createHeritageClause = (
  token: SyntaxKind,
  types: readonly ExpressionWithTypeArguments[],
): HeritageClause => make("HeritageClause", { token, types });
