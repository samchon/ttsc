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
 * Given a `number` type and a `px` tail inside a ``width:${...}`` template, the
 * printer renders:
 *
 * ```ts
 * `width:${number}px`;
 * ```
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
