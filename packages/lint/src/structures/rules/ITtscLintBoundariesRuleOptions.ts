/**
 * Options shapes for every rule in {@link ITtscLintBoundariesRules}.
 *
 * The `boundaries/*` family classifies each source file as belonging to a named
 * _element_ (a layer, feature, or app within the project). Every rule below
 * shares the same element-declaration block, so the helper interfaces in this
 * file describe that block first and then layer the per-rule options on top.
 *
 * @reference https://github.com/javierbrea/eslint-plugin-boundaries
 */

/** One source-path element used by the `boundaries/*` rules. */
export interface ITtscLintBoundariesElement {
  /** Element type name used by `boundaries/element-types` policies. */
  type: string;

  /**
   * Glob-like source path pattern. Relative patterns are matched against any
   * project-path suffix, so `src/app/**` works in temporary and monorepo roots
   * alike.
   */
  pattern: string;

  /**
   * File(s) inside the element that may be imported from outside that element.
   * Used by `boundaries/entry-point`.
   */
  entry?: string | readonly string[];

  /**
   * File(s) inside the element that may only be imported by the same element.
   * Used by `boundaries/no-private`.
   */
  private?: string | readonly string[];
}

/** Dependency policy used by `boundaries/element-types`. */
export interface ITtscLintBoundariesElementTypesRule {
  /** Source element type(s) the policy applies to. Omit to match all sources. */
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
  /** Source path elements used to classify importers and imported files. */
  elements?: readonly ITtscLintBoundariesElement[];
}

/** `boundaries/element-types` rule options. */
export interface ITtscLintBoundariesElementTypesRuleOptions extends ITtscLintBoundariesElementsOptions {
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
  /** External package/specifier patterns that are allowed. Empty means all. */
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

/** One entity selector in a `boundaries/dependencies` policy. */
export interface ITtscLintBoundariesDependenciesEntitySelectorObject {
  /** Element type glob(s). */
  type?: string | readonly string[];

  /** Dependency origin glob(s). */
  origin?: "local" | "external" | "core" | readonly string[];

  /** Import specifier or source-file glob(s). */
  source?: string | readonly string[];

  /** Element-local path glob(s). */
  path?: string | readonly string[];

  /** Whether the selected file is a configured entry file. */
  entry?: boolean;

  /** Whether the selected file is a configured private file. */
  private?: boolean;

  /** Whether the local target matched no configured element. */
  unknown?: boolean;
}

/** Entity selector or legacy element-type shorthand. */
export type ITtscLintBoundariesDependenciesEntitySelector =
  | string
  | ITtscLintBoundariesDependenciesEntitySelectorObject
  | readonly (
      | string
      | ITtscLintBoundariesDependenciesEntitySelectorObject
    )[];

/** Metadata selector for the import or re-export itself. */
export interface ITtscLintBoundariesDependenciesInfoSelector {
  /** TypeScript dependency kind. */
  kind?: "value" | "type" | "typeof" | readonly (
    | "value"
    | "type"
    | "typeof"
  )[];

  /** Import specifier glob(s). */
  source?: string | readonly string[];

  /** AST dependency kind glob(s), such as `ImportDeclaration`. */
  nodeKind?: string | readonly string[];

  /** Imported or re-exported name glob(s). */
  specifiers?: string | readonly string[];
}

/** Complete dependency selector used by an allow/disallow effect. */
export interface ITtscLintBoundariesDependenciesSelector {
  /** Importing entity selector. */
  from?: ITtscLintBoundariesDependenciesEntitySelector;

  /** Imported entity selector. */
  to?: ITtscLintBoundariesDependenciesEntitySelector;

  /** Dependency metadata selector. */
  dependency?:
    | ITtscLintBoundariesDependenciesInfoSelector
    | readonly ITtscLintBoundariesDependenciesInfoSelector[];
}

/** One allow/disallow effect selector. */
export type ITtscLintBoundariesDependenciesEffect =
  | ITtscLintBoundariesDependenciesEntitySelector
  | ITtscLintBoundariesDependenciesSelector
  | readonly (
      | string
      | ITtscLintBoundariesDependenciesEntitySelectorObject
      | ITtscLintBoundariesDependenciesSelector
    )[];

/** One ordered `boundaries/dependencies` policy. */
export interface ITtscLintBoundariesDependenciesPolicy {
  /** Importing entity selector. Omit to match every configured source. */
  from?: ITtscLintBoundariesDependenciesEntitySelector;

  /** Imported entity selector. Omit to match every target. */
  to?: ITtscLintBoundariesDependenciesEntitySelector;

  /** Dependency metadata selector. */
  dependency?:
    | ITtscLintBoundariesDependenciesInfoSelector
    | readonly ITtscLintBoundariesDependenciesInfoSelector[];

  /** Selectors whose matching dependencies are allowed. */
  allow?: ITtscLintBoundariesDependenciesEffect;

  /** Selectors whose matching dependencies are rejected. */
  disallow?: ITtscLintBoundariesDependenciesEffect;

  /** Legacy dependency-kind filter; `dependency.kind` takes precedence. */
  importKind?: "value" | "type" | "typeof";

  /** Optional diagnostic override for this policy. */
  message?: string;
}

/**
 * `boundaries/dependencies` rule options.
 *
 * Policies are evaluated in order and the last matching effect wins. Within
 * one policy, `disallow` takes precedence over `allow`.
 */
export interface ITtscLintBoundariesDependenciesRuleOptions
  extends ITtscLintBoundariesElementsOptions {
  /**
   * Fallback policy when no rule matches.
   *
   * @default "disallow"
   */
  default?: "allow" | "disallow";

  /** Ordered dependency policies. Prefer this current upstream name. */
  policies?: readonly ITtscLintBoundariesDependenciesPolicy[];

  /** Ordered dependency policies; compatibility alias for `policies`. */
  rules?: readonly ITtscLintBoundariesDependenciesPolicy[];

  /** Evaluate external and `node:` dependencies as well as local targets. */
  checkAllOrigins?: boolean;

  /** Evaluate local targets that match no configured element. */
  checkUnknownLocals?: boolean;

  /** Evaluate dependencies within the same configured element root. */
  checkInternals?: boolean;

  /**
   * Global diagnostic override.
   *
   * Supports `{{from.type}}`, `{{to.type}}`, `{{dependency.source}}`,
   * `{{dependency.kind}}`, and `{{policy.index}}` placeholders.
   */
  message?: string;
}
