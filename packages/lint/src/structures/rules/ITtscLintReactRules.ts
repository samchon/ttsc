import type { ITtscLintReactOnlyExportComponentsRuleOptions } from "./ITtscLintReactRuleOptions";
import type {
  TtscLintRuleOptionsSetting,
  TtscLintRuleSetting,
} from "../TtscLintRuleSetting";

/**
 * React TSX rules.
 *
 * Bundles rules from `eslint-plugin-react`, `eslint-plugin-react-hooks`,
 * and `eslint-plugin-react-refresh` under one namespace, matching
 * Oxlint's `react/*` plugin layout. Performance-only rules live in a
 * separate {@link ITtscLintReactPerfRules} family because they are
 * opt-in toggles rather than correctness checks.
 *
 * @reference https://github.com/jsx-eslint/eslint-plugin-react
 */
export interface ITtscLintReactRules {
  /**
   * Require explicit, valid `type` values on JSX `<button>` elements
   * (`"button"`, `"submit"`, `"reset"`) — the HTML default of
   * `"submit"` causes accidental form submissions.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/button-has-type.md
   */
  "react/button-has-type"?: TtscLintRuleSetting;

  /**
   * Detect high-confidence missing identifiers in React Hook
   * dependency arrays (`useEffect`, `useLayoutEffect`,
   * `useInsertionEffect`, `useMemo`, `useCallback`).
   *
   * @reference https://react.dev/reference/react/useEffect#specifying-reactive-dependencies
   */
  "react/exhaustive-deps"?: TtscLintRuleSetting;

  /**
   * Reject declaring a component or custom Hook inside another
   * component or Hook body.
   *
   * Each render rebuilds the inner function, giving it a new
   * identity that discards its state and breaks memoization.
   *
   * @reference https://react.dev/reference/rules/components-and-hooks-must-be-pure
   */
  "react/component-hook-factories"?: TtscLintRuleSetting;

  /**
   * Require JSX `<iframe>` elements to declare a `sandbox` attribute,
   * which restricts what embedded content can do (scripts, forms,
   * navigation).
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/iframe-missing-sandbox.md
   */
  "react/iframe-missing-sandbox"?: TtscLintRuleSetting;

  /**
   * Reject mutating props, state, or Hook return values inside a
   * component or Hook.
   *
   * React treats these as read-only; mutating a memoized value can
   * desync renders from the dependencies React tracked it under.
   *
   * @reference https://react.dev/reference/rules/components-and-hooks-must-be-pure
   */
  "react/immutability"?: TtscLintRuleSetting;

  /**
   * Require `key` props on JSX elements produced from arrays or
   * `.map(...)` calls — React uses the key to track list identity
   * across renders.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-key.md
   */
  "react/jsx-key"?: TtscLintRuleSetting;

  /**
   * Reject duplicate JSX prop names on the same element — later
   * occurrences silently overwrite earlier ones.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-duplicate-props.md
   */
  "react/jsx-no-duplicate-props"?: TtscLintRuleSetting;

  /**
   * Reject `javascript:` URLs in JSX URL-like props such as `href`
   * and `src`.
   *
   * Such URLs evaluate the URL body as script — the same
   * code-execution surface as `eval`, and a common XSS vector when
   * the value is user-controlled.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-script-url.md
   */
  "react/jsx-no-script-url"?: TtscLintRuleSetting;

  /**
   * Reject `key={index}` patterns inside JSX lists — array index
   * keys reorder incorrectly on insertion.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-array-index-key.md
   */
  "react/no-array-index-key"?: TtscLintRuleSetting;

  /**
   * Reject passing children through an explicit `children` JSX prop.
   *
   * The nested-tag form is shorter, mirrors HTML, and avoids the
   * double-children footgun where a `children` prop and nested JSX
   * both target the same slot.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-children-prop.md
   */
  "react/no-children-prop"?: TtscLintRuleSetting;

  /**
   * Reject `dangerouslySetInnerHTML` altogether.
   *
   * The prop bypasses React's escaping and injects raw HTML into the
   * DOM — a common XSS vector when the input is not sanitized
   * upstream.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-danger.md
   */
  "react/no-danger"?: TtscLintRuleSetting;

  /**
   * Reject combining `dangerouslySetInnerHTML` with JSX children
   * — React throws at runtime in this case.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-danger-with-children.md
   */
  "react/no-danger-with-children"?: TtscLintRuleSetting;

  /**
   * Reject direct writes to `this.state` outside constructor
   * initialization. Use `this.setState(...)` instead.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-direct-mutation-state.md
   */
  "react/no-direct-mutation-state"?: TtscLintRuleSetting;

  /**
   * Reject `findDOMNode(...)` calls.
   *
   * The API is deprecated, blocks future React internals work, and
   * breaks component abstraction by reaching across composition
   * boundaries; attach a `ref` to the target element instead.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-find-dom-node.md
   */
  "react/no-find-dom-node"?: TtscLintRuleSetting;

  /**
   * Reject `this.isMounted()` calls on class components.
   *
   * The API is deprecated, and anti-patterns around it usually hide
   * a memory leak in async callbacks; cancel the work in
   * `componentWillUnmount` instead.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-is-mounted.md
   */
  "react/no-is-mounted"?: TtscLintRuleSetting;

  /**
   * Reject string-form JSX refs (`ref="myInput"`).
   *
   * The API is legacy, slated for removal, and has well-known issues
   * with static typing, owner tracking, and stale references; use
   * `useRef` or a callback ref instead.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-string-refs.md
   */
  "react/no-string-refs"?: TtscLintRuleSetting;

  /**
   * Reject unescaped `>`, `"`, `'`, and `}` characters in JSX
   * text content — they render literally and almost always come
   * from forgotten HTML escaping.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unescaped-entities.md
   */
  "react/no-unescaped-entities"?: TtscLintRuleSetting;

  /**
   * Keep React Fast Refresh component modules from exporting
   * non-component values. Mixing a component export with a
   * constant or hook in the same file invalidates HMR.
   *
   * @reference https://github.com/ArnaudBarre/eslint-plugin-react-refresh/blob/main/README.md
   */
  "react/only-export-components"?: TtscLintRuleOptionsSetting<ITtscLintReactOnlyExportComponentsRuleOptions>;

  /**
   * Reject reading or writing `ref.current` during render.
   *
   * Refs persist mutably across renders without re-rendering, so
   * touching them in render breaks the pure-render contract and
   * produces inconsistent output between render passes.
   *
   * @reference https://react.dev/reference/rules/components-and-hooks-must-be-pure
   */
  "react/refs"?: TtscLintRuleSetting;

  /**
   * Enforce the Rules of Hooks: only call Hooks at the top level
   * of a component or custom Hook, never inside conditionals,
   * loops, or nested functions.
   *
   * @reference https://react.dev/reference/rules/rules-of-hooks
   */
  "react/rules-of-hooks"?: TtscLintRuleSetting;

  /**
   * Reject unconditional `setState` calls in `useEffect` bodies.
   *
   * The state update schedules another render and re-runs the
   * effect, which usually loops forever; the value almost always
   * belongs in `useMemo` or derived state instead.
   *
   * @reference https://react.dev/learn/you-might-not-need-an-effect
   */
  "react/set-state-in-effect"?: TtscLintRuleSetting;

  /**
   * Reject calling `setState` during render.
   *
   * Render must stay pure; queuing an update from the render body
   * schedules another render that queues another update, producing
   * an infinite render loop unless guarded by an explicit equality
   * check.
   *
   * @reference https://react.dev/reference/rules/components-and-hooks-must-be-pure
   */
  "react/set-state-in-render"?: TtscLintRuleSetting;

  /**
   * Reject string-form `style` values such as `style="color: red"` or
   * `style={\`...\`}`.
   *
   * React expects a `{ camelCaseProp: value }` object, not the
   * HTML-style CSS string, and the latter is silently coerced and
   * never applied.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/style-prop-object.md
   */
  "react/style-prop-object"?: TtscLintRuleSetting;

  /**
   * Reject `useMemo` calculation callbacks that do not return a
   * value.
   *
   * A block-bodied callback without `return` memoizes `undefined`,
   * silently discarding the intended computation — a common mistake
   * when wrapping an object literal in `{ ... }` instead of
   * `({ ... })`.
   *
   * @reference https://react.dev/reference/react/useMemo
   */
  "react/use-memo"?: TtscLintRuleSetting;

  /**
   * Reject `children` or `dangerouslySetInnerHTML` on void DOM
   * elements (`<img>`, `<br>`, `<input>`, etc.).
   *
   * Void elements have no content model, so React throws at render
   * time when you try to give them any.
   *
   * @reference https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/void-dom-elements-no-children.md
   */
  "react/void-dom-elements-no-children"?: TtscLintRuleSetting;
}
