import type {
  TtscLintRuleOptionsSetting,
  TtscLintRuleSetting,
} from "../TtscLintRuleSetting";
import type { ITtscLintStorybookNoUninstalledAddonsRuleOptions } from "./ITtscLintStorybookRuleOptions";

/**
 * Storybook CSF and configuration rules from `eslint-plugin-storybook`.
 *
 * Checks Component Story Format conventions (default export meta, named story
 * exports, play-function shape) and configuration pitfalls in
 * `.storybook/main.ts`.
 *
 * @reference https://github.com/storybookjs/eslint-plugin-storybook
 *
 * @evidence contracts/common.md#principled-implementation Optional storybook keys represent selectable CSF and configuration policies; no-uninstalled-addons alone carries the typed object needed for its configurable package lookup.
 * @evidence contracts/common.md#clear-and-simple-design A family map owns Storybook rule selection while one options interface owns addon policy, keeping severity and tuple construction shared.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Storybook policy names are supported identities rather than repository story exceptions, and the options boundary remains typed.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain CSF metadata, play contexts and diagnostic or suggestion effects; family context, paragraphs and member spacing follow documentation guidance.
 */
export interface ITtscLintStorybookRules {
  /**
   * Require recognized interaction call names and `expect(...).matcher()` calls
   * to be directly awaited or returned. Recognition is syntactic and is not
   * restricted to a resolved `play` function or imported interaction helper;
   * debugger frames and asynchronous execution are not observed.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/await-interactions.md
   */
  "storybook/await-interactions"?: TtscLintRuleSetting;

  /**
   * Require forwarding the play-function `context` argument when invoking
   * another story's `play` function.
   *
   * The check recognizes `.play` calls and the nearest function's first
   * parameter, accepting that context name or an object spreading it. It does
   * not execute the nested play function or inspect runtime hooks.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/context-in-play-function.md
   */
  "storybook/context-in-play-function"?: TtscLintRuleSetting;

  /**
   * Require the CSF default meta object to declare a `component`.
   *
   * Only a recognized default metadata object is checked; the component's
   * runtime value, controls, documentation, and rendering are not validated.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/csf-component.md
   */
  "storybook/csf-component"?: TtscLintRuleSetting;

  /**
   * Require a default export unless the source has a recognized `storiesOf`
   * import or CSF4 meta call. This is a source convention, not an observation
   * of Storybook indexing.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/default-exports.md
   */
  "storybook/default-exports"?: TtscLintRuleSetting;

  /**
   * Reject the legacy `|` separator in Storybook story titles (`"Foo|Bar"`).
   *
   * Storybook 6 standardized on `/` for hierarchy and treats `|` as a literal
   * character, so the title collapses into a single sidebar entry instead of
   * nested folders.
   *
   * Findings have no `Deprecated` tag: the check does not establish a runtime
   * version in which the separator still performs hierarchy separation.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/hierarchy-separator.md
   */
  "storybook/hierarchy-separator"?: TtscLintRuleSetting;

  /**
   * Require `title` and `args` in CSF meta to be inline literals, not
   * references to outside variables or function calls.
   *
   * The native check accepts its supported literal AST kinds, including object
   * and array literals. It does not recursively prove every nested value is
   * static or run an indexer or codemod.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/meta-inline-properties.md
   */
  "storybook/meta-inline-properties"?: TtscLintRuleSetting;

  /**
   * Require recognized CSF metadata to use a `satisfies` expression rather than
   * an annotation or cast alone. The check recognizes the expression's syntax;
   * it does not validate the referenced type or inferred story arguments.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/meta-satisfies-type.md
   */
  "storybook/meta-satisfies-type"?: TtscLintRuleSetting;

  /**
   * Reject `name` metadata on a story when it matches Storybook's auto-derived
   * name from the export identifier.
   *
   * The explicit value adds boilerplate and drifts from the export when one
   * side is renamed without the other.
   *
   * Object-property reports include a trailing comma when located; assignment
   * reports are restricted to standalone top-level statements. Findings have
   * no `Unnecessary` tag because matching text does not prove deletion has no
   * observable effect.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/no-redundant-story-name.md
   */
  "storybook/no-redundant-story-name"?: TtscLintRuleSetting;

  /**
   * Reject direct imports from Storybook renderer packages (`@storybook/react`,
   * etc.); use the user-facing package surface.
   *
   * The diagnostic names the framework packages that replace the renderer, and
   * offers each as an editor suggestion that rewrites the module specifier.
   * None is applied automatically: which one is right depends on the project's
   * bundler, which the import does not state.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/no-renderer-packages.md
   */
  "storybook/no-renderer-packages"?: TtscLintRuleSetting;

  /**
   * Reject recognized Storybook imports of the legacy `storiesOf` builder,
   * removed in Storybook 8. Calls alone do not establish such an import.
   *
   * Findings have no `Deprecated` tag because the import predicate does not
   * establish an earlier working runtime version.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/no-stories-of.md
   */
  "storybook/no-stories-of"?: TtscLintRuleSetting;

  /**
   * Reject an explicit `title` property in recognized CSF metadata. The check
   * does not inspect whether the project enables automatic titles.
   *
   * Reports include a trailing comma when located, but have no `Unnecessary`
   * tag: this policy does not prove the title's value or evaluation removable.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/no-title-property-in-meta.md
   */
  "storybook/no-title-property-in-meta"?: TtscLintRuleSetting;

  /**
   * Compare normalized nonlocal addon names against package dependencies and
   * devDependencies, with exact configured ignore entries. Missing, unreadable,
   * invalid, or empty dependency manifests suppress this check; an installed
   * package's runtime availability is not verified.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/no-uninstalled-addons.md
   */
  "storybook/no-uninstalled-addons"?: TtscLintRuleOptionsSetting<ITtscLintStorybookNoUninstalledAddonsRuleOptions>;

  /**
   * Require named story exports to use PascalCase.
   *
   * Recognized story filters, underscore-prefixed exports, and `storiesOf`
   * imports affect eligibility. Sidebar rendering is not observed.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/prefer-pascal-case.md
   */
  "storybook/prefer-pascal-case"?: TtscLintRuleSetting;

  /**
   * Require at least one eligible named story when default metadata is
   * recognized, respecting include/exclude filters and the `storiesOf` import
   * exemption. Sources without recognized metadata are outside this check.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/story-exports.md
   */
  "storybook/story-exports"?: TtscLintRuleSetting;

  /**
   * Report directly named `expect` calls unless a named import exists from
   * `@storybook/test`, `storybook/test`, or legacy `@storybook/jest`. The check
   * does not resolve each call's binding or execute browser matchers.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/use-storybook-expect.md
   */
  "storybook/use-storybook-expect"?: TtscLintRuleSetting;

  /**
   * Reject import module strings containing `@testing-library`; use the
   * Storybook-bundled re-exports. This is a module-string policy, not a runtime
   * package-compatibility check.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/use-storybook-testing-library.md
   */
  "storybook/use-storybook-testing-library"?: TtscLintRuleSetting;
}
