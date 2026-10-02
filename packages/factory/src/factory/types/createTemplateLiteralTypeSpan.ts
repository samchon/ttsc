import type {
  TemplateLiteralTypeSpan,
  TemplateMiddle,
  TemplateTail,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateLiteralTypeSpan}: one interpolation of a template
 * literal type, an interpolated type plus the literal text that follows it.
 *
 * The type prints first, then the trailing literal. The literal is a
 * {@link TemplateMiddle} when another span follows and a {@link TemplateTail}
 * when it closes the template. A span only renders meaningfully inside a
 * template literal type; on its own it is just a fragment.
 *
 * Given a `number` type and a `px` tail inside a `width:${...}` template, the
 * printer renders:
 *
 * ```ts
 * `width:${number}px`
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The interpolated type and middle/tail literal retain their different roles;
 *   a tail closes the parent template while a middle opens its next interpolation.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One fragment carries only its type and following literal, leaving the
 *   opening head and overall span order to the template parent.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The literal suffix is not parsed into an expected string result and the
 *   type is not replaced by consumer-specific interpolation text.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states that the span is a fragment and labels the example as
 *   parent-context output; middle/tail roles and both inputs are explained.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The interpolated type.
 * @param literal The trailing middle or tail literal.
 * @returns The created {@link TemplateLiteralTypeSpan}.
 */
export const createTemplateLiteralTypeSpan = (
  type: TypeNode,
  literal: TemplateMiddle | TemplateTail,
): TemplateLiteralTypeSpan =>
  make("TemplateLiteralTypeSpan", { type, literal });
