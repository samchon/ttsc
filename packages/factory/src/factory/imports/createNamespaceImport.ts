import type { Identifier, NamespaceImport } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link NamespaceImport}: the `* as ns` binding that imports an entire
 * module under a single namespace name.
 *
 * This node fills the `namedBindings` slot of an {@link ImportClause}. The
 * `name` accepts a raw string and is wrapped in an identifier for you.
 *
 * Given the namespace name `ns`, this prints:
 *
 * ```ts
 * * as ns
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   asName converts a string binding to Identifier; NamespaceImport represents
 *   the * as binding clause while the enclosing import carries its target.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Name normalization shares asName and the clause contains only the local
 *   name; module resolution is not introduced into a syntax builder.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The star form is AST syntax rather than a generated snapshot of exports.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc explains namedBindings placement and string conversion, with
 *   a namespace example and separated acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @returns The created {@link NamespaceImport}.
 */
export const createNamespaceImport = (
  name: string | Identifier,
): NamespaceImport => make("NamespaceImport", { name: asName(name) });
