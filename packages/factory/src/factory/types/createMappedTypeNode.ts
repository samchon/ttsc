import type {
  MappedTypeNode,
  Token,
  TypeElement,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link MappedTypeNode}: a `{ [K in keyof T]: T[K] }` mapped type.
 *
 * The type parameter supplies the key variable and its `in` constraint. When
 * `nameType` is present it adds an `as` key remap, and when `type` is present
 * it adds the `: ValueType` value. Additional `members` are retained and printed
 * after the mapped member, separated by semicolons. The caller is responsible
 * for whether that supplied outline is legal in the target TypeScript context.
 *
 * The `readonlyToken` and `questionToken` carry optional modifier polarity. A
 * plain `readonly` or `?` token prints as `readonly ` and `?`; a `+` or `-`
 * token prefixes the modifier, so it prints as `+readonly`/`-readonly` and
 * `+?`/`-?`.
 *
 * Given a `K in keyof T` parameter and a `T[K]` value with no modifiers, the
 * printer renders:
 *
 * ```ts
 * { [K in keyof T]: T[K] }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Key constraint, remapping, modifier polarity, value and additional members
 *   retain distinct AST slots. Additional members are preserved rather than
 *   deleted to make an otherwise invalid mapped outline appear valid.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One mapped node carries the supplied structure; token interpretation and
 *   separators remain printer responsibilities, not duplicate factory logic.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No key names or expected mapped outputs select special branches. Grammar
 *   validity is a caller obligation, not patched by silently dropping members.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs distinguish modifier polarity, key/value structure and
 *   additional members; the example represents the ordinary member-free form.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param readonlyToken The `readonly` modifier with optional `+`/`-` polarity,
 *   if any.
 * @param typeParameter The key type parameter holding the `in` constraint.
 * @param nameType The `as` key remap type, if any.
 * @param questionToken The optional-marker `?` with optional `+`/`-` polarity,
 *   if any.
 * @param type The mapped value type, if any.
 * @param members The members, if any.
 * @returns The created {@link MappedTypeNode}.
 */
export const createMappedTypeNode = (
  readonlyToken: Token | undefined,
  typeParameter: TypeParameterDeclaration,
  nameType: TypeNode | undefined,
  questionToken: Token | undefined,
  type: TypeNode | undefined,
  members: readonly TypeElement[] | undefined,
): MappedTypeNode =>
  make("MappedTypeNode", {
    readonlyToken,
    typeParameter,
    nameType,
    questionToken,
    type,
    members,
  });
