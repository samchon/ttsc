/**
 * Options shapes for every rule in {@link ITtscLintBoundariesRules}.
 *
 * The `boundaries/*` family classifies each source file as belonging to a named
 * _element_ (a layer, feature, or app within the project). Classification-based
 * rules share the element-declaration block; the external-package rule has its
 * own allow/disallow object without local element declarations.
 *
 * @reference https://github.com/javierbrea/eslint-plugin-boundaries
 */

/**
 * One source-path element used by the `boundaries/*` rules.
 *
 * @evidence contracts/common.md#principled-implementation A required type label and path pattern classify an element, while entry/private selections govern which files that element exposes to other elements.
 * @evidence contracts/common.md#clear-and-simple-design Element identity and its two file-access boundaries stay together because downstream policies refer to the same classification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Element membership is configured through source patterns instead of fixed repository directories or consumer layer names.
 * @evidence contracts/common.md#meaningful-documentation Members distinguish type labels, suffix-matched paths, entry files and private files; each retains its own separated native comment.
 */
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

/**
 * Dependency policy used by `boundaries/element-types`.
 *
 * @evidence contracts/common.md#principled-implementation Optional source-type selection and allowed/rejected target labels represent a policy over classified elements rather than over raw import text.
 * @evidence contracts/common.md#clear-and-simple-design One policy entry keeps its source condition, target effects and diagnostic override together for ordered evaluation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Architecture restrictions use declared element labels and policy values, without guessed project names or patched module resolution.
 * @evidence contracts/common.md#meaningful-documentation Members explain omitted source matching, allow/disallow target roles and message override, with blank lines between properties.
 */
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
 *
 * @evidence contracts/common.md#principled-implementation The optional readonly element list represents shared source classification; omitted selection is distinct from any particular project's architecture.
 * @evidence contracts/common.md#clear-and-simple-design One base owns element declarations so entry-point, private and dependency policies cannot drift into independent classification shapes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Classification enters through caller-supplied element definitions, without repository-specific root constants.
 * @evidence contracts/common.md#meaningful-documentation Owning prose identifies source-path classification and the member states its importer/imported-file role, separated from tags.
 */
export interface ITtscLintBoundariesElementsOptions {
  /** Source path elements used to classify importers and imported files. */
  elements?: readonly ITtscLintBoundariesElement[];
}

/**
 * `boundaries/element-types` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The allow/disallow fallback and ordered policy list express the native first-matching element-type decision over the shared element classification.
 * @evidence contracts/common.md#clear-and-simple-design Inheriting element definitions leaves this object responsible only for policy order and fallback.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Policy priority and fallback are explicit rule inputs instead of per-import exceptions to the classifier.
 * @evidence contracts/common.md#meaningful-documentation Comments state first-match precedence and the allow default, with default tags and member spacing separated from prose.
 */
export interface ITtscLintBoundariesElementTypesRuleOptions extends ITtscLintBoundariesElementsOptions {
  /**
   * Fallback policy when no element-type policy produces a decision.
   *
   * @default "allow"
   */
  default?: "allow" | "disallow";

  /**
   * Ordered policies. The first policy producing an allow/disallow decision
   * wins.
   */
  rules?: readonly ITtscLintBoundariesElementTypesRule[];
}

/**
 * `boundaries/external` rule options.
 *
 * @evidence contracts/common.md#principled-implementation String-or-list allow/disallow selectors represent external specifier patterns, with a message field independent of matching semantics.
 * @evidence contracts/common.md#clear-and-simple-design External policy uses a small direct object because it needs no local-element declaration list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Package exceptions are caller-authored patterns rather than hardcoded dependency names or installation mutations.
 * @evidence contracts/common.md#meaningful-documentation Members explain the empty allowance behavior, rejected patterns and diagnostic override as separate comments.
 */
export interface ITtscLintBoundariesExternalRuleOptions {
  /** Allowed package/specifier patterns. Empty imposes no allowlist restriction. */
  allow?: string | readonly string[];

  /** External package/specifier patterns that are rejected. */
  disallow?: string | readonly string[];

  /** Optional diagnostic override. */
  message?: string;
}

/**
 * `boundaries/entry-point` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The alias selects the shared element representation whose entry lists define permitted external entry files.
 * @evidence contracts/common.md#clear-and-simple-design Reusing the element block avoids a second shape for identical source classification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Entry-file policy uses declared elements rather than hardcoded index filenames.
 * @evidence contracts/common.md#meaningful-documentation The rule name and shared target make the alias's purpose explicit; the target documents entry-file meaning and member spacing.
 */
export type ITtscLintBoundariesEntryPointRuleOptions =
  ITtscLintBoundariesElementsOptions;

/**
 * `boundaries/no-private` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The alias uses shared element private-file lists to express which local files outside importers may not access.
 * @evidence contracts/common.md#clear-and-simple-design No duplicate private-rule element shape is introduced because classification and file visibility already belong to the shared block.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Privacy is configured through element metadata instead of fixture-specific import prohibitions.
 * @evidence contracts/common.md#meaningful-documentation The alias names the private-import rule, while the shared element documentation supplies the exact same-element exception.
 */
export type ITtscLintBoundariesNoPrivateRuleOptions =
  ITtscLintBoundariesElementsOptions;

/**
 * `boundaries/no-unknown` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The shared element list defines known source classifications, so the alias needs no unrelated unknown-name vocabulary.
 * @evidence contracts/common.md#clear-and-simple-design Reusing classification keeps the unknown rule consistent with every other boundaries rule.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Known sources derive from configured elements instead of a hardcoded workspace file list.
 * @evidence contracts/common.md#meaningful-documentation The owning comment names the rule and the shared block explains classification of importers and targets without redundant property tags.
 */
export type ITtscLintBoundariesNoUnknownRuleOptions =
  ITtscLintBoundariesElementsOptions;

/**
 * One entity selector in a `boundaries/dependencies` policy.
 *
 * @evidence contracts/common.md#principled-implementation Independent type/origin/source/path selectors and entry/private/unknown predicates represent the classified entity facts the dependency matcher exposes.
 * @evidence contracts/common.md#clear-and-simple-design Entity conditions remain separate from dependency-statement metadata because they describe the source or target file, not an import edge.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Selectors inspect declared classification and dependency origin rather than fabricated resolution metadata.
 * @evidence contracts/common.md#meaningful-documentation Each member distinguishes glob matching from boolean file predicates, with separate native comments and no property acknowledgments.
 */
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

/**
 * Entity selector or legacy element-type shorthand.
 *
 * @evidence contracts/common.md#principled-implementation The union preserves string type-label shorthand, structured entity conditions and lists of either, matching the native selector decoder's alternatives.
 * @evidence contracts/common.md#clear-and-simple-design One alias centralizes shorthand normalization for both source and target selectors.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The legacy string form addresses an existing supported configuration syntax rather than a consumer-specific compatibility wrapper.
 * @evidence contracts/common.md#meaningful-documentation Owning prose identifies the shorthand alternative and the structured member type documents entity predicates separately.
 */
export type ITtscLintBoundariesDependenciesEntitySelector =
  | string
  | ITtscLintBoundariesDependenciesEntitySelectorObject
  | readonly (string | ITtscLintBoundariesDependenciesEntitySelectorObject)[];

/**
 * Metadata selector for the import or re-export itself.
 *
 * @evidence contracts/common.md#principled-implementation Kind literals distinguish value/type/typeof edges; source, nodeKind and specifier patterns select facts about the import statement independently of entity classification.
 * @evidence contracts/common.md#clear-and-simple-design Import metadata has its own named shape so file predicates cannot be confused with statement predicates.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Matching uses supported AST and import metadata instead of special module examples or guessed runtime behavior.
 * @evidence contracts/common.md#meaningful-documentation Members name dependency-kind, specifier, AST-kind and imported-name matching, with a concrete ImportDeclaration example and property spacing.
 */
export interface ITtscLintBoundariesDependenciesInfoSelector {
  /** TypeScript dependency kind. */
  kind?: "value" | "type" | "typeof" | readonly ("value" | "type" | "typeof")[];

  /** Import specifier glob(s). */
  source?: string | readonly string[];

  /** AST dependency kind glob(s), such as `ImportDeclaration`. */
  nodeKind?: string | readonly string[];

  /** Imported or re-exported name glob(s). */
  specifiers?: string | readonly string[];
}

/**
 * Complete dependency selector used by an allow/disallow effect.
 *
 * @evidence contracts/common.md#principled-implementation Separate from/to entity selectors and dependency metadata jointly identify an edge, preserving each endpoint's different role.
 * @evidence contracts/common.md#clear-and-simple-design Named component selectors compose without duplicating their field vocabularies in each effect.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Edge selection uses endpoint and statement facts rather than per-file exemptions added after a policy fails.
 * @evidence contracts/common.md#meaningful-documentation Members identify importer, imported entity and edge metadata as distinct concerns, each with a separate native comment.
 */
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

/**
 * One allow/disallow effect selector.
 *
 * @evidence contracts/common.md#principled-implementation Effects accept entity shorthand, full edge selectors or readonly lists, preserving the native decoder's supported target-only and whole-edge forms.
 * @evidence contracts/common.md#clear-and-simple-design Reusing entity and dependency selectors avoids another overlapping policy-object hierarchy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Multiple effect forms reflect existing supported configuration syntax instead of additional project-specific selector meanings.
 * @evidence contracts/common.md#meaningful-documentation Owning prose identifies the effect role and named alternatives retain their own endpoint and metadata explanations.
 */
export type ITtscLintBoundariesDependenciesEffect =
  | ITtscLintBoundariesDependenciesEntitySelector
  | ITtscLintBoundariesDependenciesSelector
  | readonly (
      | string
      | ITtscLintBoundariesDependenciesEntitySelectorObject
      | ITtscLintBoundariesDependenciesSelector
    )[];

/**
 * One ordered `boundaries/dependencies` policy.
 *
 * @evidence contracts/common.md#principled-implementation Source/target/metadata conditions select an edge, allow/disallow carry its effects, and importKind preserves a legacy filter whose dependency.kind precedence is explicit.
 * @evidence contracts/common.md#clear-and-simple-design One policy groups its conditions, effects and message while reusing named selector shapes for their own responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The legacy filter has a stated supported precedence; it is not a hidden override or compensating per-import exception.
 * @evidence contracts/common.md#meaningful-documentation Members state omitted-endpoint behavior, effect direction and legacy precedence, keeping separate topics in separate comments.
 */
export interface ITtscLintBoundariesDependenciesPolicy {
  /** Importing entity selector. Omit to match every configured source. */
  from?: ITtscLintBoundariesDependenciesEntitySelector;

  /** Imported entity selector. Omit to match every target. */
  to?: ITtscLintBoundariesDependenciesEntitySelector;

  /** Dependency metadata selector. */
  dependency?:
    | ITtscLintBoundariesDependenciesInfoSelector
    | readonly ITtscLintBoundariesDependenciesInfoSelector[];

  /**
   * Selectors whose matching dependencies are allowed. Entity shorthand selects
   * the imported entity when from is present, or the importer when it is
   * absent; full edge selectors retain their explicit from/to roles.
   */
  allow?: ITtscLintBoundariesDependenciesEffect;

  /** Rejected dependency selectors, with the same shorthand direction as allow. */
  disallow?: ITtscLintBoundariesDependenciesEffect;

  /** Legacy dependency-kind filter; `dependency.kind` takes precedence. */
  importKind?: "value" | "type" | "typeof";

  /** Optional diagnostic override for this policy. */
  message?: string;
}

/**
 * `boundaries/dependencies` rule options.
 *
 * Policies are evaluated in order and the last matching effect wins. Within one
 * policy, `disallow` takes precedence over `allow`.
 *
 * @evidence contracts/common.md#principled-implementation Ordered policies with last-effect precedence compose over element classification; independent origin, unknown-local and internal-edge gates define the evaluated population.
 * @evidence contracts/common.md#clear-and-simple-design Classification is inherited, while policy list, population gates and diagnostic override remain directly visible in one rule object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The rules alias is documented compatibility for policies; configured origin gates avoid repository-specific dependency exemptions.
 * @evidence contracts/common.md#meaningful-documentation Owning prose states effect precedence; members explain fallback, alias, population gates and supported message placeholders with paragraph separation.
 */
export interface ITtscLintBoundariesDependenciesRuleOptions extends ITtscLintBoundariesElementsOptions {
  /**
   * Fallback policy when no policy effect matches.
   *
   * @default "disallow"
   */
  default?: "allow" | "disallow";

  /** Ordered dependency policies. Cannot be combined with the rules alias. */
  policies?: readonly ITtscLintBoundariesDependenciesPolicy[];

  /** Ordered dependency policies; use this compatibility alias or policies. */
  rules?: readonly ITtscLintBoundariesDependenciesPolicy[];

  /** Evaluate external and core dependencies as well as local targets. */
  checkAllOrigins?: boolean;

  /** Evaluate local targets that match no configured element. */
  checkUnknownLocals?: boolean;

  /** Evaluate dependencies within the same configured element root. */
  checkInternals?: boolean;

  /**
   * Global diagnostic override.
   *
   * Supports `{{from.type}}`, `{{from.path}}`, `{{from.origin}}`,
   * `{{to.type}}`, `{{to.path}}`, `{{to.origin}}`, `{{dependency.source}}`,
   * `{{dependency.kind}}`, `{{dependency.nodeKind}}`, and `{{policy.index}}`
   * placeholders.
   */
  message?: string;
}
