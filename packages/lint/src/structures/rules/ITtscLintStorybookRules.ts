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
 */
export interface ITtscLintStorybookRules {
  /**
   * Require `await` on Storybook interaction helpers (`userEvent`, `expect`,
   * `waitFor`, ...) inside a `play` function.
   *
   * The interactions addon intercepts the awaited promises to record steps, so
   * a missing `await` skips that frame in the debugger and races the next
   * assertion.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/await-interactions.md
   */
  "storybook/await-interactions"?: TtscLintRuleSetting;

  /**
   * Require forwarding the play-function `context` argument when invoking
   * another story's `play` function.
   *
   * Storybook hangs the canvas, step tracker, and interactions addon off
   * `context`; omitting it leaves the nested call without the runtime hooks it
   * needs to drive the canvas.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/context-in-play-function.md
   */
  "storybook/context-in-play-function"?: TtscLintRuleSetting;

  /**
   * Require the CSF default meta object to declare a `component`.
   *
   * The reference unlocks Storybook's auto-generated controls, prop-table docs,
   * and CSF3 default render — without it those features silently no-op.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/csf-component.md
   */
  "storybook/csf-component"?: TtscLintRuleSetting;

  /**
   * Require every story file to provide the CSF default export.
   *
   * Storybook keys all per-file configuration (title, decorators, parameters,
   * component) off that default; files without it are skipped at indexing
   * time.
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
   * Tagged `Deprecated`: the separator is superseded rather than broken, and
   * the story still renders, so an editor strikes that separator through.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/hierarchy-separator.md
   */
  "storybook/hierarchy-separator"?: TtscLintRuleSetting;

  /**
   * Require `title` and `args` in CSF meta to be inline literals, not
   * references to outside variables or function calls.
   *
   * Storybook's indexer and upgrade codemods read these via static analysis and
   * skip stories where the value is not literal.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/meta-inline-properties.md
   */
  "storybook/meta-inline-properties"?: TtscLintRuleSetting;

  /**
   * Require CSF meta objects to type-check with `satisfies Meta<…>` rather than
   * a `: Meta<…>` annotation or `as` cast.
   *
   * `satisfies` preserves the narrowed literal types so dependent `StoryObj`
   * declarations can infer the component's args precisely.
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
   * Tagged `Unnecessary`: both reported shapes — the `name` / `storyName`
   * property and a standalone `Story.storyName = ...` assignment — span the
   * complete removable annotation, including its trailing comma or semicolon,
   * so an editor greys out a range whose deletion leaves valid syntax.
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
   * Reject the legacy `storiesOf(...)` builder API.
   *
   * Storybook 7 removed it in favour of CSF default-export metadata; remaining
   * uses block the migration to CSF3 and the modern indexer.
   *
   * Tagged `Deprecated`: an editor strikes the import specifier through, since
   * the instruction is to migrate off the builder rather than to delete the
   * import and leave the calls below it unresolved.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/no-stories-of.md
   */
  "storybook/no-stories-of"?: TtscLintRuleSetting;

  /**
   * Reject the `title` property in CSF meta when the project uses Storybook's
   * auto-title generation.
   *
   * CSF3 derives the title from the file path, so an explicit `title` is
   * redundant and drifts from the on-disk layout when files are moved.
   *
   * Tagged `Unnecessary`: the reported range is the complete removable
   * property, including a trailing comma when present, so deleting the faded
   * range is the resolution and leaves valid object syntax.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/no-title-property-in-meta.md
   */
  "storybook/no-title-property-in-meta"?: TtscLintRuleSetting;

  /**
   * Validate Storybook addon names against the project's dependencies, so
   * misspelled addon ids surface at lint time.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/no-uninstalled-addons.md
   */
  "storybook/no-uninstalled-addons"?: TtscLintRuleOptionsSetting<ITtscLintStorybookNoUninstalledAddonsRuleOptions>;

  /**
   * Require named story exports to use PascalCase.
   *
   * Storybook derives the displayed story name from the export identifier and
   * inserts spaces at case boundaries, so non-PascalCase exports render with
   * awkward or merged labels in the sidebar.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/prefer-pascal-case.md
   */
  "storybook/prefer-pascal-case"?: TtscLintRuleSetting;

  /**
   * Require every story file to export at least one named story alongside the
   * default meta.
   *
   * A file with only the default export contributes nothing to the sidebar and
   * usually means a story was deleted but the file was not.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/story-exports.md
   */
  "storybook/story-exports"?: TtscLintRuleSetting;

  /**
   * Require `expect` to be imported from `@storybook/test` in play functions,
   * not from Jest.
   *
   * The Storybook re-export is built for the browser interactions runner;
   * Jest's `expect` ships only Node-only matchers and throws when the play
   * function executes in a browser preview.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/use-storybook-expect.md
   */
  "storybook/use-storybook-expect"?: TtscLintRuleSetting;

  /**
   * Reject direct Testing Library imports inside story files; use the
   * Storybook-bundled re-exports.
   *
   * @reference https://github.com/storybookjs/eslint-plugin-storybook/blob/main/docs/rules/use-storybook-testing-library.md
   */
  "storybook/use-storybook-testing-library"?: TtscLintRuleSetting;
}
