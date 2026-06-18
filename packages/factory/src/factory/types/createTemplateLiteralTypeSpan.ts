import type {
  TemplateLiteralTypeSpan,
  TemplateMiddle,
  TemplateTail,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TemplateLiteralTypeSpan}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The type.
 * @param literal The literal.
 * @returns The created node.
 */
export const createTemplateLiteralTypeSpan = (
  type: TypeNode,
  literal: TemplateMiddle | TemplateTail,
): TemplateLiteralTypeSpan =>
  make("TemplateLiteralTypeSpan", { type, literal });
