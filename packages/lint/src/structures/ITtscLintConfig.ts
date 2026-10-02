import type { ITtscLintPlugin } from "./ITtscLintPlugin";
import type { ITtscLintFormat } from "./format/ITtscLintFormat";
import type { TtscLintContributorOverlay } from "./rules/TtscLintContributorOverlay";
import type { ITtscLintRules } from "./rules/ITtscLintRules";

/**
 * Top-level object accepted by `@ttsc/lint` config files.
 *
 * Keep the file shape plain: users export an object and use `satisfies
 * ITtscLintConfig` when they want type checking. A config that uses typed
 * contributor rules passes the contributor's published rule interface, or an
 * intersection of several, as the generic argument:
 * `satisfies ITtscLintConfig<IDemoLintRules>`.
 *
 * @typeParam TContributors - Contributor rule interfaces whose rules receive
 *   exact option checking; see {@link TtscLintContributorOverlay}. Omitted, every
 *   contributor rule keeps the open `unknown`-options fallback.
 *
 * @evidence contracts/common.md#principled-implementation Optional selection, inheritance, formatting and rule fields represent one flat-config entry; the host folds entries in order.
 * @evidence contracts/common.md#clear-and-simple-design One interface owns the entry shape while rule and formatter schemas remain in their respective types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Configuration choices remain declared fields rather than consumer-specific branches or foreign mutations.
 * @evidence contracts/common.md#meaningful-documentation Member comments distinguish global ignores from selected-entry ignores, inheritance origins and project-rule selection; paragraphs and member spacing follow the documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation extends carries a native config path and files/ignores carry glob spelling anchored to its containing config directory. The native resolver uses filepath operations and physical path resolution for identity, converts relative candidates to slash spelling for glob matching, and keeps native case capability with the matching boundary.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintConfig is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintConfig is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintConfig is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintConfig<
  TContributors extends object = Record<never, never>,
> {
  /**
   * Globs that select the files this entry applies to, relative to this config
   * file's directory. An empty array imposes no file restriction, but remains
   * an explicit selector for project-rule validation.
   */
  files?: string | readonly string[];

  /**
   * Globs that exclude files from linting.
   *
   * When `files` contains patterns, the ignores only refine that selection
   * (the entry's rules skip the matched files). Without a nonempty `files`
   * restriction, including `files: []`, the ignores are global: the matched
   * files are excluded from every rule in the resolved config, including rules
   * inherited through `extends`.
   */
  ignores?: string | readonly string[];

  /**
   * Config file path folded in before this object's own rules apply.
   *
   * Relative paths resolve from the containing config file's directory.
   */
  extends?: string;

  /** Prettier-style flat configuration for the format rules. */
  format?: ITtscLintFormat;

  /**
   * Kebab-case built-in rule severities plus namespaced contributor rules.
   *
   * Built-in rules are concrete interface properties for autocomplete and typo
   * checking. Namespaced families and contributor rules use the familiar slash
   * form such as `react/jsx-key` or `demo/no-demo`.
   *
   * Project-scoped contributor rules use this same map, but their configuration
   * must come from entries without a `files` selector.
   */
  rules?: ITtscLintRules & TtscLintContributorOverlay<TContributors>;

  /** Contributor plugin objects keyed by namespace. */
  plugins?: Record<string, ITtscLintPlugin>;
}
