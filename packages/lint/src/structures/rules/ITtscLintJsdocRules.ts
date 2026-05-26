import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Documentation-comment validation rules.
 *
 * Bundles `eslint-plugin-jsdoc` content checks (tag names, parameter
 * coverage, descriptions) with the lone `eslint-plugin-tsdoc` syntax
 * check (`jsdoc/tsdoc-syntax`) — both target `/** ... *\/` comments and
 * are too small in upstream-tsdoc's case to justify a dedicated family.
 *
 * Formatting concerns (alignment, indentation) are configured through
 * the top-level `format` block, not here.
 *
 * @reference https://github.com/gajus/eslint-plugin-jsdoc
 */
export interface ITtscLintJsdocRules {
  /**
   * Reject unknown JSDoc block-tag names. Catches typos like
   * `@returs` or `@parm`.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-tag-names.md
   */
  "jsdoc/check-tag-names"?: TtscLintRuleSetting;

  /**
   * Validate `@access` values against the closed set `public`,
   * `protected`, `private`, `package`. (Upstream extends to
   * `@version`/`@since`/`@license`/`@kind`/`@import` value checks;
   * those shapes are not yet implemented in the native engine.)
   *
   * Catches typos and stale enum members that slip past doc tooling.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-values.md
   */
  "jsdoc/check-values"?: TtscLintRuleSetting;

  /**
   * Reject content on marker-only JSDoc tags (`@async`, `@public`,
   * `@override`, ...) — these tags take no value.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/empty-tags.md
   */
  "jsdoc/empty-tags"?: TtscLintRuleSetting;

  /**
   * Reject JSDoc type braces in TypeScript sources, since the
   * surrounding TypeScript already carries the type.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/no-types.md
   */
  "jsdoc/no-types"?: TtscLintRuleSetting;

  /**
   * Reject `any` and `*` inside JSDoc type braces — these escape
   * the documented type system the same way TypeScript `any` does.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/reject-any-type.md
   */
  "jsdoc/reject-any-type"?: TtscLintRuleSetting;

  /**
   * Reject the unsafe `Function` type inside JSDoc type braces.
   *
   * Mirrors the `typescript/no-unsafe-function-type` rule from
   * {@link ITtscLintTypeScriptRules} for JSDoc comments.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/reject-function-type.md
   */
  "jsdoc/reject-function-type"?: TtscLintRuleSetting;

  /**
   * Require JSDoc blocks to include a leading block-level
   * description — every documented identifier should explain itself.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-description.md
   */
  "jsdoc/require-description"?: TtscLintRuleSetting;

  /**
   * Require every `@param` tag that names a parameter to also
   * carry a description after the name.
   *
   * A name-only `@param` adds nothing beyond the signature, so the
   * rule pushes authors to either describe the parameter or drop
   * the tag.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-param-description.md
   */
  "jsdoc/require-param-description"?: TtscLintRuleSetting;

  /**
   * Require every `@param` tag to include the parameter name it
   * documents.
   *
   * A bare `@param` cannot be linked to a signature position, so
   * doc tooling silently drops it.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-param-name.md
   */
  "jsdoc/require-param-name"?: TtscLintRuleSetting;

  /**
   * Require every `@property` tag that names a property to also
   * carry a description.
   *
   * Mirrors `require-param-description` for typedef and object-shape
   * comments, where a name-only entry adds nothing the surrounding
   * type doesn't convey.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-property-description.md
   */
  "jsdoc/require-property-description"?: TtscLintRuleSetting;

  /**
   * Require every `@property` tag to include the property name it
   * documents.
   *
   * Without the name the tag cannot be linked to a member of the
   * surrounding typedef, and doc generators discard it.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-property-name.md
   */
  "jsdoc/require-property-name"?: TtscLintRuleSetting;

  /**
   * Require every `@returns` tag to carry a description of the
   * returned value.
   *
   * The TypeScript signature already states the return type, so the
   * tag earns its keep only when it explains what the value means,
   * not its shape.
   *
   * @reference https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-returns-description.md
   */
  "jsdoc/require-returns-description"?: TtscLintRuleSetting;

  /**
   * Detect structural TSDoc problems in documentation comments:
   * malformed top-level block tags (`@` followed by non-letter) and
   * malformed or unclosed inline tags (`{@link ...}`). The broader
   * TSDoc grammar — closed-set tag names, escape sequences,
   * `{Type}`-annotation rejection, fenced-code rules — is not yet
   * implemented.
   *
   * TSDoc is Microsoft's curated dialect that powers API Extractor and
   * the rest of the Microsoft TypeScript documentation pipeline.
   * Upstream `eslint-plugin-tsdoc` ships exactly one rule; it lives
   * here rather than in a one-rule `tsdoc/*` family.
   *
   * @reference https://github.com/microsoft/tsdoc/blob/main/eslint-plugin/README.md
   */
  "jsdoc/tsdoc-syntax"?: TtscLintRuleSetting;
}
