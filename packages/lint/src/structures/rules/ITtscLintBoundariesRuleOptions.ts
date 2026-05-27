/**
 * Options shapes for every rule in {@link ITtscLintBoundariesRules}.
 *
 * The `boundaries/*` family classifies each source file as belonging to a
 * named *element* (a layer, feature, or app within the project). Every
 * rule below shares the same element-declaration block, so the helper
 * interfaces in this file describe that block first and then layer the
 * per-rule options on top.
 *
 * @reference https://github.com/javierbrea/eslint-plugin-boundaries
 */

/** One source-path element used by the `boundaries/*` rules. */
export interface ITtscLintBoundariesElement {
  /** Element type name used by `boundaries/element-types` policies. */
  type: string;

  /**
   * Glob-like source path pattern. Relative patterns are matched against
   * any project-path suffix, so `src/app/**` works in temporary and
   * monorepo roots alike.
   */
  pattern: string;

  /**
   * File(s) inside the element that may be imported from outside that
   * element. Used by `boundaries/entry-point`.
   */
  entry?: string | readonly string[];

  /**
   * File(s) inside the element that may only be imported by the same
   * element. Used by `boundaries/no-private`.
   */
  private?: string | readonly string[];
}

/** Dependency policy used by `boundaries/element-types`. */
export interface ITtscLintBoundariesElementTypesRule {
  /**
   * Source element type(s) the policy applies to. Omit to match all
   * sources.
   */
  from?: string | readonly string[];

  /** Target element type(s) allowed from the matching source. */
  allow?: string | readonly string[];

  /** Target element type(s) rejected from the matching source. */
  disallow?: string | readonly string[];

  /** Optional diagnostic override. */
  message?: string;
}

/**
 * Shared element-declaration block used by every TypeScript source-path
 * `boundaries/*` rule.
 */
export interface ITtscLintBoundariesElementsOptions {
  /**
   * Source path elements used to classify importers and imported files.
   */
  elements?: readonly ITtscLintBoundariesElement[];
}

/** `boundaries/element-types` rule options. */
export interface ITtscLintBoundariesElementTypesRuleOptions
  extends ITtscLintBoundariesElementsOptions {
  /**
   * Fallback policy when no rule matches.
   *
   * @default "allow"
   */
  default?: "allow" | "disallow";

  /** Ordered dependency policies. First matching policy wins. */
  rules?: readonly ITtscLintBoundariesElementTypesRule[];
}

/** `boundaries/external` rule options. */
export interface ITtscLintBoundariesExternalRuleOptions {
  /**
   * External package/specifier patterns that are allowed. Empty means
   * all.
   */
  allow?: string | readonly string[];

  /** External package/specifier patterns that are rejected. */
  disallow?: string | readonly string[];

  /** Optional diagnostic override. */
  message?: string;
}

/** `boundaries/entry-point` rule options. */
export type ITtscLintBoundariesEntryPointRuleOptions =
  ITtscLintBoundariesElementsOptions;

/** `boundaries/no-private` rule options. */
export type ITtscLintBoundariesNoPrivateRuleOptions =
  ITtscLintBoundariesElementsOptions;

/** `boundaries/no-unknown` rule options. */
export type ITtscLintBoundariesNoUnknownRuleOptions =
  ITtscLintBoundariesElementsOptions;

/**
 * `boundaries/dependencies` rule options.
 *
 * The upstream unified rule subsumes `element-types`, `entry-point`,
 * `external`, `no-private`, and `no-unknown` behind a single
 * direction-aware policy block. The v1 native port registers the rule
 * name and decodes this config shape but does not yet emit diagnostics
 * (`v1 stub; full validation deferred` — see `rules_boundaries.go`).
 */
export interface ITtscLintBoundariesDependenciesRuleOptions
  extends ITtscLintBoundariesElementsOptions {
  /**
   * Fallback policy when no rule matches.
   *
   * @default "allow"
   */
  default?: "allow" | "disallow";

  /** Ordered dependency policies. First matching policy wins. */
  rules?: readonly ITtscLintBoundariesElementTypesRule[];
}
