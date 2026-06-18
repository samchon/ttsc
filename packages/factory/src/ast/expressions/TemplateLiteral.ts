import type { NoSubstitutionTemplateLiteral } from "./NoSubstitutionTemplateLiteral";
import type { TemplateExpression } from "./TemplateExpression";

/**
 * A template literal expression (with or without substitutions).
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type TemplateLiteral =
  | NoSubstitutionTemplateLiteral
  | TemplateExpression;
