import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * JSX accessibility rules from `eslint-plugin-jsx-a11y`, applied to TSX (and
 * JSX-in-TS) sources.
 *
 * Checks the static structure of JSX elements against WAI-ARIA authoring
 * guidance — interactive controls should be focusable, labels should reference
 * a control, ARIA properties should match the element role, and so on. Runtime
 * accessibility issues require live audits; this family catches the
 * statically-decidable subset.
 *
 * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
 *
 * @evidence contracts/common.md#principled-implementation Optional jsx-a11y identifiers represent independently configurable static accessibility policies through the severity-only union, without suggesting runtime accessibility certification.
 * @evidence contracts/common.md#clear-and-simple-design The family keeps JSX accessibility concerns together and delegates severity forms to one alias rather than adding per-rule option layers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The keys are supported accessibility rule identities; this representation contains no fixture allowance or foreign runtime mutation.
 * @evidence contracts/common.md#meaningful-documentation Family prose distinguishes static analysis from live audits and member comments explain ARIA, labels and interaction concerns; paragraphs and member boundaries follow documentation guidance.
 */
export interface ITtscLintJsxA11yRules {
  /**
   * Require image-like JSX elements (`<img>`, `<input type="image">`,
   * `<object>`, `<area>`) to expose alt text or an ARIA label.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/alt-text.md
   */
  "jsx-a11y/alt-text"?: TtscLintRuleSetting;

  /**
   * Reject `<a>` elements whose visible text is one of a small set of phrases
   * that carry no information out of context. Screen-reader users navigate by
   * listing links — "click here" / "more" / "read more" turn that list into
   * noise.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/anchor-ambiguous-text.md
   */
  "jsx-a11y/anchor-ambiguous-text"?: TtscLintRuleSetting;

  /**
   * Reject empty JSX anchors with no accessible content (text, `aria-label`, or
   * labelled child).
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/anchor-has-content.md
   */
  "jsx-a11y/anchor-has-content"?: TtscLintRuleSetting;

  /**
   * Reject anchors with missing, `#`-only, empty, or `javascript:` `href`
   * values, all of which break navigation semantics.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/anchor-is-valid.md
   */
  "jsx-a11y/anchor-is-valid"?: TtscLintRuleSetting;

  /**
   * Require an explicit tabIndex on elements carrying aria-activedescendant,
   * including natively focusable tags. Elements with a spread are skipped
   * because the attribute may arrive through it.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-activedescendant-has-tabindex.md
   */
  "jsx-a11y/aria-activedescendant-has-tabindex"?: TtscLintRuleSetting;

  /**
   * Reject `aria-*` JSX attribute names that are not part of the WAI-ARIA
   * States and Properties spec — catches typos such as `aria-labeledby`
   * (missing second `l`) that silently disable assistive-tech support.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-props.md
   */
  "jsx-a11y/aria-props"?: TtscLintRuleSetting;

  /**
   * Validate the native subset of boolean, tristate, and integer ARIA values —
   * e.g. `aria-checked` must be one of `true`,
   * `false`, `"mixed"`, and `aria-hidden="yes"` is rejected because the type is
   * boolean.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-proptypes.md
   */
  "jsx-a11y/aria-proptypes"?: TtscLintRuleSetting;

  /**
   * Require `role` values to be a concrete, non-abstract WAI-ARIA role
   * (`"button"`, `"checkbox"`, ...). Rejects misspellings and abstract roles
   * like `"range"`; computed values are skipped because the concrete role
   * cannot be checked statically.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-role.md
   */
  "jsx-a11y/aria-role"?: TtscLintRuleSetting;

  /**
   * Reject ARIA roles and attributes on elements that do not support them (e.g.
   * `aria-checked` on a `<meta>` tag).
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-unsupported-elements.md
   */
  "jsx-a11y/aria-unsupported-elements"?: TtscLintRuleSetting;

  /**
   * Validate the literal `autocomplete` token against the HTML spec vocabulary
   * and against the `type` of the surrounding input — e.g. `autocomplete="url"`
   * on `<input type="email">` is rejected because the two sets do not overlap.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/autocomplete-valid.md
   */
  "jsx-a11y/autocomplete-valid"?: TtscLintRuleSetting;

  /**
   * Require keyboard handlers alongside `onClick` on non-interactive JSX
   * elements so the element is also reachable by keyboard.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/click-events-have-key-events.md
   */
  "jsx-a11y/click-events-have-key-events"?: TtscLintRuleSetting;

  /**
   * Require interactive controls to have an accessible label (visible text,
   * `aria-label`, or `aria-labelledby`).
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/control-has-associated-label.md
   */
  "jsx-a11y/control-has-associated-label"?: TtscLintRuleSetting;

  /**
   * Reject empty JSX headings (`<h1>{}</h1>`) — assistive technology cannot
   * announce content that does not exist.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/heading-has-content.md
   */
  "jsx-a11y/heading-has-content"?: TtscLintRuleSetting;

  /**
   * Require `<html>` JSX elements to declare a non-empty `lang` attribute so
   * screen readers can pick the correct pronunciation. Largely superseded by
   * `jsx-a11y/lang`, which also validates the tag value.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/html-has-lang.md
   */
  "jsx-a11y/html-has-lang"?: TtscLintRuleSetting;

  /**
   * Require a known, nonempty title value on iframe JSX elements without a
   * spread. The native check does not compare title uniqueness and skips
   * elements carrying a spread.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/iframe-has-title.md
   */
  "jsx-a11y/iframe-has-title"?: TtscLintRuleSetting;

  /**
   * Reject redundant words such as _image_, _photo_, or _picture_ inside the
   * `alt` attribute of an `<img>` — the role already conveys "this is an
   * image".
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/img-redundant-alt.md
   */
  "jsx-a11y/img-redundant-alt"?: TtscLintRuleSetting;

  /**
   * Require elements with interactive ARIA roles (`role="button"`,
   * `role="link"`, ...) to be focusable.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/interactive-supports-focus.md
   */
  "jsx-a11y/interactive-supports-focus"?: TtscLintRuleSetting;

  /**
   * Require `<label>` elements to either wrap a form control or reference one
   * via `htmlFor`.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/label-has-associated-control.md
   */
  "jsx-a11y/label-has-associated-control"?: TtscLintRuleSetting;

  /**
   * Deprecated predecessor of `label-has-associated-control`. Checks the same
   * nesting / htmlFor presence requirement. The native alias exposes no custom
   * label-component options and does not verify the referenced control id.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/label-has-for.md
   */
  "jsx-a11y/label-has-for"?: TtscLintRuleSetting;

  /**
   * Validate present, statically known html lang values with the pinned Go
   * language parser, rejecting unsupported literal shapes and surrounding
   * whitespace. Missing lang is left to html-has-lang; dynamic values are
   * generally not validated.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/lang.md
   */
  "jsx-a11y/lang"?: TtscLintRuleSetting;

  /**
   * Require `<audio>` and `<video>` elements to provide a `<track
   * kind="captions">` child.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/media-has-caption.md
   */
  "jsx-a11y/media-has-caption"?: TtscLintRuleSetting;

  /**
   * Require `onMouseOver` / `onMouseOut` handlers to have `onFocus` / `onBlur`
   * parity so keyboard users get the same interaction.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/mouse-events-have-key-events.md
   */
  "jsx-a11y/mouse-events-have-key-events"?: TtscLintRuleSetting;

  /**
   * Reject the `accessKey` JSX attribute — it conflicts with
   * assistive-technology keyboard shortcuts.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-access-key.md
   */
  "jsx-a11y/no-access-key"?: TtscLintRuleSetting;

  /**
   * Reject `aria-hidden` on focusable JSX elements — focus would land on an
   * element hidden from assistive tech.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-aria-hidden-on-focusable.md
   */
  "jsx-a11y/no-aria-hidden-on-focusable"?: TtscLintRuleSetting;

  /**
   * Reject `autoFocus` / `autofocus` JSX attributes — they steal focus on page
   * load and disorient keyboard users.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-autofocus.md
   */
  "jsx-a11y/no-autofocus"?: TtscLintRuleSetting;

  /**
   * Reject `<blink>` and `<marquee>` — moving content cannot be paused and
   * harms users with cognitive or visual impairments (WCAG 2.2.2). The list is
   * closed: extra elements cannot be added.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-distracting-elements.md
   */
  "jsx-a11y/no-distracting-elements"?: TtscLintRuleSetting;

  /**
   * Reject non-interactive ARIA roles applied to natively interactive elements
   * (e.g. `<button role="presentation">`).
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-interactive-element-to-noninteractive-role.md
   */
  "jsx-a11y/no-interactive-element-to-noninteractive-role"?: TtscLintRuleSetting;

  /**
   * Reject interaction event handlers (`onClick`, `onKeyDown`) placed on known
   * non-interactive elements, even when a role attribute is present.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-noninteractive-element-interactions.md
   */
  "jsx-a11y/no-noninteractive-element-interactions"?: TtscLintRuleSetting;

  /**
   * Reject interactive ARIA roles applied to non-interactive elements (e.g.
   * `<li role="button">`); use the matching interactive tag.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-noninteractive-element-to-interactive-role.md
   */
  "jsx-a11y/no-noninteractive-element-to-interactive-role"?: TtscLintRuleSetting;

  /**
   * Reject `tabIndex` on non-interactive JSX elements that have no interactive
   * role.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-noninteractive-tabindex.md
   */
  "jsx-a11y/no-noninteractive-tabindex"?: TtscLintRuleSetting;

  /**
   * Reject explicit `role` attributes that duplicate the native semantics of
   * the element (e.g. `<button role="button">`).
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-redundant-roles.md
   */
  "jsx-a11y/no-redundant-roles"?: TtscLintRuleSetting;

  /**
   * Require a role attribute on recognized static elements with interaction
   * handlers. This check accepts attribute presence without validating that
   * the supplied role is interactive.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-static-element-interactions.md
   */
  "jsx-a11y/no-static-element-interactions"?: TtscLintRuleSetting;

  /**
   * Prefer native JSX tags over `div` / `span` plus an equivalent `role` (e.g.
   * `<button>` over `<div role="button">`).
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/prefer-tag-over-role.md
   */
  "jsx-a11y/prefer-tag-over-role"?: TtscLintRuleSetting;

  /**
   * Require ARIA properties that the chosen role mandates (e.g. `aria-checked`
   * on `role="checkbox"`).
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/role-has-required-aria-props.md
   */
  "jsx-a11y/role-has-required-aria-props"?: TtscLintRuleSetting;

  /**
   * Reject ARIA properties that the role does not support (e.g. `aria-checked`
   * on `role="link"`).
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/role-supports-aria-props.md
   */
  "jsx-a11y/role-supports-aria-props"?: TtscLintRuleSetting;

  /**
   * Restrict the `scope` attribute to `<th>` cells. On any other tag (`<div
   * scope="col">`, `<td scope="row">`) the attribute is ignored by browsers and
   * confuses table-aware assistive tech.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/scope.md
   */
  "jsx-a11y/scope"?: TtscLintRuleSetting;

  /**
   * Reject `tabIndex` values greater than zero. Positive indices jump the
   * keyboard focus order out of document order and almost always desynchronize
   * from later DOM changes; `0` and `-1` remain allowed.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/tabindex-no-positive.md
   */
  "jsx-a11y/tabindex-no-positive"?: TtscLintRuleSetting;
}
