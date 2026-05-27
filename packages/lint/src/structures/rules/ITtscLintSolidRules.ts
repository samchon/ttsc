import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Solid TSX rules from `eslint-plugin-solid`.
 *
 * Solid components compile to fine-grained reactivity, so patterns
 * that look correct in React (destructuring props, calling
 * `useEffect`-style hooks with array deps) silently break reactivity
 * in Solid. This family captures the common Solid-only pitfalls.
 *
 * @reference https://github.com/solidjs-community/eslint-plugin-solid
 */
export interface ITtscLintSolidRules {
  /**
   * Reject early and conditional `return` from a Solid component
   * — Solid components must return exactly once at the top level.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/components-return-once.md
   */
  "solid/components-return-once"?: TtscLintRuleSetting;

  /**
   * Require DOM event handler props to use canonical Solid casing
   * (`onClick`, not `onclick` / `onClIcK`) so the compiler recognizes
   * them as events. Also flags `on*`-named props bound to non-function
   * values, which look like handlers but are not.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/event-handlers.md
   */
  "solid/event-handlers"?: TtscLintRuleSetting;

  /**
   * Route each Solid export to the correct entry point (`solid-js`,
   * `solid-js/web`, or `solid-js/store`) and merge duplicate imports
   * from the same entry.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/imports.md
   */
  "solid/imports"?: TtscLintRuleSetting;

  /**
   * Reject duplicate JSX props on the same Solid element. Unlike
   * React, Solid silently keeps the first value, so the duplicate is
   * dead code and almost always a typo.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-no-duplicate-props.md
   */
  "solid/jsx-no-duplicate-props"?: TtscLintRuleSetting;

  /**
   * Reject `javascript:` URLs in Solid JSX attributes (`href`, `src`,
   * ...) — they evaluate the suffix as code in the page context and
   * are a long-standing XSS vector.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-no-script-url.md
   */
  "solid/jsx-no-script-url"?: TtscLintRuleSetting;

  /**
   * Reject Solid JSX component names that are not declared or
   * imported in scope.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-no-undef.md
   */
  "solid/jsx-no-undef"?: TtscLintRuleSetting;

  /**
   * Scope-marker compatibility rule (mirrors ESLint's
   * `react/jsx-uses-vars`).
   *
   * The native engine emits no diagnostics for this id.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-uses-vars.md
   */
  "solid/jsx-uses-vars"?: TtscLintRuleSetting;

  /**
   * Reject array values passed as Solid event handlers — Solid
   * does not unwrap the array form React supports.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-array-handlers.md
   */
  "solid/no-array-handlers"?: TtscLintRuleSetting;

  /**
   * Reject destructured Solid component props — destructuring breaks
   * reactivity by reading the property eagerly.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-destructure.md
   */
  "solid/no-destructure"?: TtscLintRuleSetting;

  /**
   * Reject `innerHTML` JSX attributes because they bypass sanitization
   * and are a common XSS sink. A static string literal is still
   * allowed by default; flip `allowStatic` off to ban that form too.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-innerhtml.md
   */
  "solid/no-innerhtml"?: TtscLintRuleSetting;

  /**
   * Reject Solid APIs that rely on ES6 `Proxy` (including `new Proxy`,
   * `Proxy.revocable`, imports from `solid-js/store`, and dynamic
   * spread shapes through `mergeProps`). For shipping to runtimes
   * without `Proxy` support; off by default.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-proxy-apis.md
   */
  "solid/no-proxy-apis"?: TtscLintRuleSetting;

  /**
   * Reject React-style dependency arrays in Solid tracked scopes
   * (`createEffect(() => ..., [deps])`).
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-react-deps.md
   */
  "solid/no-react-deps"?: TtscLintRuleSetting;

  /**
   * Reject React-specific JSX props such as `className` and
   * `htmlFor` — Solid uses `class` and `for`.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-react-specific-props.md
   */
  "solid/no-react-specific-props"?: TtscLintRuleSetting;

  /**
   * Restrict namespaced JSX attributes (`ns:name={...}`) to the
   * built-in Solid namespaces (`on:`, `oncapture:`, `use:`, `prop:`,
   * `attr:`, `bool:`, `style:`, `class:`). Extra names can be allowed
   * through the `allowedNamespaces` option.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-unknown-namespaces.md
   */
  "solid/no-unknown-namespaces"?: TtscLintRuleSetting;

  /**
   * Rewrite `class={cn({ ... })}` / `clsx(...)` / `classnames(...)`
   * calls to the reactive `classlist={{ ... }}` prop.
   *
   * Deprecated and off by default upstream.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/prefer-classlist.md
   */
  "solid/prefer-classlist"?: TtscLintRuleSetting;

  /**
   * Replace inline `array.map(item => <JSX />)` with Solid's `<For>`
   * component so the iteration stays keyed and reactive instead of
   * re-creating every child on each update.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/prefer-for.md
   */
  "solid/prefer-for"?: TtscLintRuleSetting;

  /**
   * Rewrite `{cond && <JSX />}` short-circuits in JSX to `<Show
   * when={cond}>...</Show>`. Stylistic only — Solid's compiler
   * already handles the boolean form — so it is off by default.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/prefer-show.md
   */
  "solid/prefer-show"?: TtscLintRuleSetting;

  /**
   * Reject common Solid reactivity breakages — reading a signal
   * outside a tracking scope, destructuring a `Store`, etc.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/reactivity.md
   */
  "solid/reactivity"?: TtscLintRuleSetting;

  /**
   * Collapse JSX elements with no children to the self-closing form
   * (`<Foo></Foo>` to `<Foo />`). Configurable per component vs HTML
   * element, including a `"void"` mode that only enforces it for void
   * tags.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/self-closing-comp.md
   */
  "solid/self-closing-comp"?: TtscLintRuleSetting;

  /**
   * Require `style={{...}}` keys to be valid kebab-case CSS properties
   * (`"font-size"`, not React's `fontSize`) and dimensioned values to
   * be strings — Solid does not append implicit `px`.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/style-prop.md
   */
  "solid/style-prop"?: TtscLintRuleSetting;

  /**
   * Reject JSX nestings that the HTML parser would silently restructure
   * at runtime — `<p>` cannot contain block-level children, `<a>` cannot
   * contain another `<a>`, and `<button>` cannot contain other
   * interactive elements.
   *
   * @reference https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/validate-jsx-nesting.md
   */
  "solid/validate-jsx-nesting"?: TtscLintRuleSetting;
}
