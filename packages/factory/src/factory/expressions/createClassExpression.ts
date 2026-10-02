import type {
  ClassElement,
  ClassExpression,
  HeritageClause,
  Identifier,
  ModifierLike,
  TypeParameterDeclaration,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ClassExpression}: a `class` used as an expression.
 *
 * A string `name` is normalized with {@link asName}; the name is optional, as
 * are the `modifiers`, `typeParameters` and `heritageClauses` (the `extends` /
 * `implements` clauses). The `members` are printed inside the class body.
 *
 * Given name `C` and no members, the printer emits:
 *
 * ```ts
 * class C {}
 * ```
 *
 * @evidence contracts/common.md#principled-implementation An optional normalized Identifier retains named versus anonymous class syntax, with signature and ordered member fields unchanged; legal modifier and heritage combinations remain caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design Name normalization precedes one shared make call; reused class-element and clause representations avoid a duplicate class schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An absent name remains absent rather than acquiring a fabricated identity; no consumer-specific base class is injected.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains optional header parts and string-name normalization, with example, parameter roles and separate tags under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers, if any.
 * @param name The class name, if any.
 * @param typeParameters The generic type parameters, if any.
 * @param heritageClauses The extends and implements clauses, if any.
 * @param members The class members.
 * @returns The created {@link ClassExpression}.
 */
export const createClassExpression = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | Identifier | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  heritageClauses: readonly HeritageClause[] | undefined,
  members: readonly ClassElement[],
): ClassExpression =>
  make("ClassExpression", {
    modifiers,
    name: name === undefined ? undefined : asName(name),
    typeParameters,
    heritageClauses,
    members,
  });
