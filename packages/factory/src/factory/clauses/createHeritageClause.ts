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
 * @evidence contracts/common.md#principled-implementation
 *   HeritageClause retains the keyword kind and ordered type expressions.
 *   The broad SyntaxKind input relies on callers choosing extends/implements.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One keyword and type list model the clause, while class/interface builders
 *   own attachment and context-specific validity.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Keyword selection is explicit input, without guessing from a class name.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies both keywords and comma-separated supertypes, with an
 *   implements example and separated explanatory/tag paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
