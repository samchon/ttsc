import type { Identifier, ImportSpecifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create an {@link ImportSpecifier}: one entry inside a {@link NamedImports}
 * brace group.
 *
 * Pass `propertyName` to alias an export under a different local name, which
 * prints as `propertyName as name`; leave it undefined for a plain binding. The
 * `name` accepts a raw string and is wrapped in an identifier for you. Set
 * `isTypeOnly` to prefix the single specifier with `type`.
 *
 * Given source name `x` aliased to `y`, this prints:
 *
 * ```ts
 * x as y
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   propertyName retains the imported name when aliased and asName converts the
 *   local string name to Identifier. isTypeOnly marks this individual binding.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Source and local names stay in one specifier; named-group braces and module
 *   lookup are outside its responsibility.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Alias and type-only choices are explicit fields, not rewritten module exports.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes original/local names and per-specifier type-only syntax,
 *   with an alias example separated from acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param isTypeOnly Whether this is a type-only import/export.
 * @param propertyName The original (source) name, when aliased.
 * @param name The name.
 * @returns The created {@link ImportSpecifier}.
 */
export const createImportSpecifier = (
  isTypeOnly: boolean,
  propertyName: Identifier | undefined,
  name: string | Identifier,
): ImportSpecifier =>
  make("ImportSpecifier", { isTypeOnly, propertyName, name: asName(name) });
