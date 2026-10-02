import type {
  Expression,
  ImportAttribute,
  ImportAttributeName,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ImportAttribute}: one `name: value` entry inside an
 * {@link ImportAttributes} clause.
 *
 * The `name` is an identifier or string literal key and the `value` is the
 * attribute expression, almost always a string literal. The printer separates
 * the two with `: `.
 *
 * Given a `"type"` name and a `"json"` string value, this prints:
 *
 * ```ts
 * "type": "json"
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   ImportAttribute preserves its identifier/string key and expression value
 *   as distinct fields; the caller supplies a grammar-valid attribute value.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A single entry does not own the introducing keyword or braces, which belong
 *   to ImportAttributes; colon formatting remains the printer's responsibility.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Resource-type values come from the caller instead of an assumed json default.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc identifies key/value representations and common string usage,
 *   followed by a separate colon-entry example and acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The attribute name.
 * @param value The attribute value.
 * @returns The created {@link ImportAttribute}.
 */
export const createImportAttribute = (
  name: ImportAttributeName,
  value: Expression,
): ImportAttribute => make("ImportAttribute", { name, value });
