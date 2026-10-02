import type {
  JsxAttributes,
  JsxOpeningElement,
  JsxTagName,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxOpeningElement}: the `<Tag>` that opens a paired
 * {@link JsxElement}.
 *
 * This is the leading half of a `<Tag>...</Tag>` pair; it carries the tag name,
 * optional generic `typeArguments`, and the attributes, but no children and no
 * trailing slash. Pair it with a matching {@link JsxClosingElement} through
 * {@link createJsxElement}.
 *
 * Given the tag name `Foo`, no type arguments, and attributes holding a single
 * `bar="x"`, the printer emits:
 *
 * ```tsx
 * <Foo bar="x">
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Tag, generic arguments and attributes retain their opening-tag roles; this
 *   node contains no children and does not pretend to close the element.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The opening is reusable by paired-element assembly without duplicating
 *   child storage or closing-tag construction.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Component names do not inject attributes or generic defaults, and the
 *   opening syntax comes from structured children rather than string replacement.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose distinguishes the opening half from self-closing syntax and
 *   states the matching-tag context alongside all three parameter descriptions.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name.
 * @param typeArguments The generic type arguments, if any.
 * @param attributes The attributes.
 * @returns The created {@link JsxOpeningElement}.
 */
export const createJsxOpeningElement = (
  tagName: JsxTagName,
  typeArguments: readonly TypeNode[] | undefined,
  attributes: JsxAttributes,
): JsxOpeningElement =>
  make("JsxOpeningElement", {
    tagName,
    typeArguments,
    attributes,
  });
