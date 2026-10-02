import type { JsxAttributeLike, JsxAttributes } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxAttributes}: the ordered collection of props on a JSX
 * element.
 *
 * Each entry is either a {@link JsxAttribute} (`name=value`) or a
 * {@link JsxSpreadAttribute} (`{...props}`). This node is what an opening or
 * self-closing element holds as its `attributes`; an empty list prints to
 * nothing.
 *
 * Printed on its own, the collection leads with a separating space before each
 * attribute. Given a single `bar="x"` property, the printer emits (note the
 * leading space):
 *
 * ```tsx
 *  bar="x"
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Attribute and spread entries remain ordered, preserving JSX's override and
 *   evaluation sequence. The empty list emits no attribute separator.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One list is reusable by paired and self-closing openings; each child owns
 *   its syntax while the attributes printer owns leading separating spaces.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Entries are neither sorted by name nor merged into a fabricated props
 *   object; no expected attribute value controls retention.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains empty output and the standalone leading space; the
 *   example now includes that space and the actual = spelling.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param properties The attribute properties.
 * @returns The created {@link JsxAttributes}.
 */
export const createJsxAttributes = (
  properties: readonly JsxAttributeLike[],
): JsxAttributes => make("JsxAttributes", { properties });
