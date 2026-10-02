import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Solid TSX rules from `eslint-plugin-solid`.
 *
 * Solid components compile to fine-grained reactivity, so patterns that look
 * correct in React (destructuring props, calling `useEffect`-style hooks with
 * array deps) silently break reactivity in Solid. This family captures the
 * common Solid-only pitfalls.
 *
 * @reference https://github.com/solidjs-community/eslint-plugin-solid
 *
 * @evidence contracts/common.md#principled-implementation Optional solid identifiers use severity-only settings because this native family exposes no rule options decoder; its public shape does not promise upstream option objects.
 * @evidence contracts/common.md#clear-and-simple-design The map groups Solid reactivity and JSX policies while keeping native rule execution outside the configuration representation and sharing severity construction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported Solid rule identifiers remain explicit entries; unsupported upstream options are not admitted through a catch-all payload or consumer-specific exception.
 * @evidence contracts/common.md#meaningful-documentation Native member comments distinguish the current native checks from upstream configurable behavior and explain Solid-specific concerns; paragraphs and member spacing follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintSolidRules is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintSolidRules is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintSolidRules is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintSolidRules is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintSolidRules {
  /**
   * Reject early and conditional `return` from a Solid component — Solid
   * components must return exactly once at the top level.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/components-return-once.md
   */
  "solid/components-return-once"?: TtscLintRuleSetting;

  /**
   * Report DOM event handler names whose first letter after `on` is lowercase,
   * such as `onclick`, so they can use `onClick` or an `on:` namespace. The
   * native check does not validate the complete casing or handler value type.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/event-handlers.md
   */
  "solid/event-handlers"?: TtscLintRuleSetting;

  /**
   * Route each Solid export to the correct entry point (`solid-js`,
   * `solid-js/web`, or `solid-js/store`) and relocate a misrouted one to where
   * it belongs, joining an existing import from that entry when the file
   * already has one. The diagnostic names the symbol and its entry point.
   *
   * Autofixable. A specifier that stands alone has its declaration's module
   * specifier rewritten; one with siblings, or one beside a default binding, is
   * cut out and relocated. A type-only declaration relocates into a type-only
   * one, never into a value import.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/imports.md
   */
  "solid/imports"?: TtscLintRuleSetting;

  /**
   * Reject duplicate JSX props on the same Solid element. Unlike React, Solid
   * silently keeps the first value, so the duplicate is dead code and almost
   * always a typo.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-no-duplicate-props.md
   */
  "solid/jsx-no-duplicate-props"?: TtscLintRuleSetting;

  /**
   * Reject `javascript:` URLs in Solid JSX attributes (`href`, `src`, ...) —
   * they evaluate the suffix as code in the page context and are a
   * long-standing XSS vector.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-no-script-url.md
   */
  "solid/jsx-no-script-url"?: TtscLintRuleSetting;

  /**
   * Reject Solid JSX component names that are not declared or imported in
   * scope.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-no-undef.md
   */
  "solid/jsx-no-undef"?: TtscLintRuleSetting;

  /**
   * Report array literals passed as Solid DOM event handlers. This source
   * policy does not distinguish Solid's handler-and-data tuple from other array
   * values.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-array-handlers.md
   */
  "solid/no-array-handlers"?: TtscLintRuleSetting;

  /**
   * Reject destructured Solid component props — destructuring breaks reactivity
   * by reading the property eagerly.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-destructure.md
   */
  "solid/no-destructure"?: TtscLintRuleSetting;

  /**
   * Reject `innerHTML` and `dangerouslySetInnerHTML` JSX attributes, including
   * static strings, because they bypass ordinary text escaping. The native rule
   * does not expose upstream's `allowStatic` option.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-innerhtml.md
   */
  "solid/no-innerhtml"?: TtscLintRuleSetting;

  /**
   * Reject Solid APIs that rely on ES6 `Proxy` (including `new Proxy`,
   * `Proxy.revocable`, imports from `solid-js/store`, and dynamic spread shapes
   * through `mergeProps`). For shipping to runtimes without `Proxy` support;
   * off by default.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-proxy-apis.md
   */
  "solid/no-proxy-apis"?: TtscLintRuleSetting;

  /**
   * Reject React-style dependency arrays in Solid tracked scopes
   * (`createEffect(() => ..., [deps])`).
   *
   * Type-aware via the Checker. The tag below claims the array is dead, so the
   * callee has to be the Solid primitive itself rather than a same-named local
   * or a shadowing parameter, and only symbol resolution can say that. Enabling
   * this rule therefore puts the whole run on the checker path.
   *
   * Tagged `Unnecessary`: the reported range is the array literal alone, and
   * Solid tracks dependencies automatically, so deleting it is the whole
   * resolution and an editor greys it out.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-react-deps.md
   */
  "solid/no-react-deps"?: TtscLintRuleSetting;

  /**
   * Reject React-specific JSX props such as `className` and `htmlFor` — Solid
   * uses `class` and `for`.
   *
   * The two renames are autofixed by rewriting the name token alone, so the
   * value survives untouched. The `key` arm stays diagnostic-only: a Solid DOM
   * element does not consume `key`, so its resolution is a deletion that has to
   * take the surrounding whitespace with it.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-react-specific-props.md
   */
  "solid/no-react-specific-props"?: TtscLintRuleSetting;

  /**
   * Restrict namespaced JSX attributes (`ns:name={...}`) to the built-in Solid
   * namespaces recognized by the native rule (`on:`, `oncapture:`, `use:`,
   * `prop:`, `attr:`, `bool:`, `xmlns:`, `xlink:`). Namespaced props on
   * components are reported separately. The native rule does not expose an
   * `allowedNamespaces` option.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-unknown-namespaces.md
   */
  "solid/no-unknown-namespaces"?: TtscLintRuleSetting;

  /**
   * Report `class={cn({ ... })}` / `clsx(...)` / `classnames(...)` calls so
   * callers can use the reactive `classList={{ ... }}` prop. The native rule
   * supplies a diagnostic without an automatic rewrite.
   *
   * Deprecated and off by default upstream.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/prefer-classlist.md
   */
  "solid/prefer-classlist"?: TtscLintRuleSetting;

  /**
   * Report `.map()` calls with a function argument inside JSX expressions,
   * recommending Solid's `<For>` for reactive list rendering. The native rule
   * supplies a diagnostic without an automatic rewrite.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/prefer-for.md
   */
  "solid/prefer-for"?: TtscLintRuleSetting;

  /**
   * Report conditional expressions in JSX and recommend `<Show
   * when={cond}>...</Show>`. This is a style policy; the native rule supplies a
   * diagnostic without an automatic rewrite.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/prefer-show.md
   */
  "solid/prefer-show"?: TtscLintRuleSetting;

  /**
   * Report async tracked callbacks, destructuring a binding named `props`, and
   * signal accessor identifiers rendered without being called in JSX. These are
   * the native subset's source patterns, not complete reactivity analysis.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/reactivity.md
   */
  "solid/reactivity"?: TtscLintRuleSetting;

  /**
   * Report JSX elements with no meaningful children so they can be written in
   * the self-closing form (`<Foo></Foo>` to `<Foo />`). The native rule is
   * diagnostic-only and exposes no per-component or HTML-element mode.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/self-closing-comp.md
   */
  "solid/self-closing-comp"?: TtscLintRuleSetting;

  /**
   * Require `style={{...}}` keys to be valid kebab-case CSS properties
   * (`"font-size"`, not React's `fontSize`) and dimensioned values to be
   * strings — Solid does not append implicit `px`.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/style-prop.md
   */
  "solid/style-prop"?: TtscLintRuleSetting;

  /**
   * Reject JSX nestings that the HTML parser would silently restructure at
   * runtime — `<p>` cannot contain block-level children, `<a>` cannot contain
   * another `<a>`, and `<button>` cannot contain other interactive elements.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/validate-jsx-nesting.md
   */
  "solid/validate-jsx-nesting"?: TtscLintRuleSetting;
}
