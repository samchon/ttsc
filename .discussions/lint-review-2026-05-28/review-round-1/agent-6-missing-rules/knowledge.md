# Agent 6 — missing-rules audit: knowledge base

## Methodology

- Implemented rules were extracted from `packages/lint/linthost/rules_*.go` by
  scanning the `Name() string { return "<id>" }` method on every rule type and
  the list-style `Register(<type>{name: "..."})` patterns in single-file
  families (`rules_react.go`, `rules_solid.go`, `rules_nextjs.go`,
  `rules_jest.go`, `rules_playwright.go`, `rules_cypress.go`,
  `rules_vitest.go`, `rules_storybook.go`, `rules_jsx_a11y.go`,
  `rules_promise.go`, `rules_jsdoc.go`, `rules_regexp.go`, `rules_functional.go`,
  `rules_boundaries.go`, `rules_tanstack_query.go`, `rules_testing_library.go`).
- Upstream rule lists were fetched via the GitHub Contents API (`gh api
  repos/<owner>/<repo>/contents/<rules-dir>`) on **2026-05-28**, against the
  default branch (typically `main`). For React Hooks (which mixes file-system
  rules with React Compiler `LintRules`), the rule list was cross-checked
  against `react.dev/reference/eslint-plugin-react-hooks`.
- Difficulty hints follow the conventions used in `packages/lint/`:
  - **AST-only** — needs nothing beyond the shimast tree.
  - **Type-aware** — needs `ctx.Checker` or `ctx.Type`.
  - **Cross-file** — needs ModuleResolution/Program-wide info.
  - **Token-stream** — needs JSDoc text or regex literal text parsing.
  - **Style/format** — pure layout/whitespace rule; typically a print-engine job.

## Summary table

| Family                 | Upstream | Implemented | Missing |
| ---------------------- | --------:| -----------:| -------:|
| unicorn                |      146 |         146 |       0 |
| react (`react/*`)      |      105 |          20 |      85 |
| react-hooks            |       17 |           8 |       9 |
| react-refresh          |        1 |           1 |       0 |
| react-perf             |        4 |           4 |       0 |
| solid                  |       21 |          21 |       0 |
| nextjs (`@next/next`)  |       22 |          21 |       1 |
| jsx-a11y               |       39 |          37 |       2 |
| jest                   |       71 |          19 |      52 |
| vitest                 |       82 |          13 |      69 |
| testing-library        |       29 |          29 |       0 |
| cypress                |       13 |          13 |       0 |
| playwright             |       58 |          31 |      27 |
| storybook              |       15 |          15 |       0 |
| tanstack-query         |        8 |           8 |       0 |
| promise                |       17 |          17 |       0 |
| jsdoc                  |       66 |          12 |      54 |
| tsdoc-syntax (bridge)  |        1 |           1 |       0 |
| regexp                 |       82 |          22 |      60 |
| functional             |       20 |          20 |       0 |
| boundaries             |        7 |           6 |       1 |
| typescript-eslint      |      134 |          97 |      37 |
| eslint core            |   ~292\* |       \~179 |    ~113\*\* |
| eslint-plugin-import   |       46 |           0 |      46 |
| eslint-comments        |        9 |           0 |       9 |

\* Includes ~80 rules eslint has deprecated as of v9 (formatting rules moved
   to `@stylistic/eslint-plugin`).
\*\* Hard-to-count precisely because the implementation set spans
   `rules_no_*.go`, `rules_prefer_*.go`, `rules_consistent_*.go`,
   `rules_misc.go`, `rules_core_extra.go`, etc. Counting `Name()` returns gives
   179, but several aggregate files register more than one slug per type.
   The missing set is dominated by deprecated formatting rules and a few
   genuinely missing semantic rules.

**Conservative total of "missing rules" across families** (excluding eslint
core deprecated formatting noise and the unverifiable ~113):
`85 + 9 + 1 + 2 + 52 + 69 + 27 + 1 + 54 + 60 + 1 + 37 + 46 + 9 = 453`.

Including the ~113 eslint-core slugs: ~566.

## Per-family breakdown

### unicorn — 146 / 146

Effectively 100% coverage. Single nominal gap: upstream renamed
`prefer-dom-node-dataset` → `dom-node-dataset` (file
`rules/dom-node-dataset.js`); ttsc still exposes the old slug.

- **Suggested follow-up**: add a `dom-node-dataset` alias that points at the
  existing `unicornPreferDomNodeDataset` rule and deprecate the old slug, or
  simply rename to match upstream.
- ttsc-only addition: `prefer-negative-index` is currently present and matches
  upstream — no action needed.

### react (eslint-plugin-react) — 20 / 105

Implemented (`react/...`): `button-has-type`, `display-name`,
`iframe-missing-sandbox`, `jsx-key`, `jsx-no-duplicate-props`,
`jsx-no-script-url`, `jsx-no-target-blank`, `jsx-no-undef`,
`jsx-no-useless-fragment`, `no-array-index-key`, `no-children-prop`,
`no-danger`, `no-danger-with-children`, `no-direct-mutation-state`,
`no-find-dom-node`, `no-is-mounted`, `no-string-refs`, `no-unescaped-entities`,
`style-prop-object`, `void-dom-elements-no-children`.

Missing (85):

- `async-server-action` — flag async functions used as React 19 server actions in unsafe positions. AST-only.
- `boolean-prop-naming` — enforce `is*`/`has*`/etc. for boolean props. AST-only (regex on prop name).
- `checked-requires-onchange-or-readonly` — `<input checked>` needs `onChange` or `readOnly`. AST-only.
- `default-props-match-prop-types` — defaultProps must be subset of propTypes. AST-only.
- `destructuring-assignment` — enforce destructuring of props/state/context. AST-only.
- `forbid-component-props` — block listed props on components. AST-only + config.
- `forbid-dom-props` — block listed props on DOM elements. AST-only + config.
- `forbid-elements` — block listed JSX elements. AST-only + config.
- `forbid-foreign-prop-types` — block accessing `Foo.propTypes`. AST-only.
- `forbid-prop-types` — block specific propTypes (`any`/`array`/`object`). AST-only.
- `forward-ref-uses-ref` — `forwardRef` callback must accept a `ref` parameter. AST-only.
- `function-component-definition` — choose between function declaration / arrow / named function. AST-only (style).
- `hook-use-state` — enforce destructured `[state, setState]` naming on `useState`. AST-only.
- `jsx-boolean-value` — enforce explicit `={true}` or omit. AST-only.
- `jsx-child-element-spacing` — style/whitespace. Style/format.
- `jsx-closing-bracket-location` — style/format. Style/format.
- `jsx-closing-tag-location` — style/format. Style/format.
- `jsx-curly-brace-presence` — enforce/disallow `{...}` around literals. AST-only.
- `jsx-curly-newline` — style/format. Style/format.
- `jsx-curly-spacing` — style/format. Style/format.
- `jsx-equals-spacing` — style/format. Style/format.
- `jsx-filename-extension` — restrict JSX to `.jsx`/`.tsx`. AST-only + filename.
- `jsx-first-prop-new-line` — style/format. Style/format.
- `jsx-fragments` — `<></>` vs `<Fragment>`. AST-only.
- `jsx-handler-names` — `onClick`-style naming. AST-only.
- `jsx-indent`, `jsx-indent-props` — style/format. Style/format.
- `jsx-max-depth` — max nesting depth in JSX. AST-only.
- `jsx-max-props-per-line` — style/format. Style/format.
- `jsx-newline` — style/format. Style/format.
- `jsx-no-bind` — flag `.bind(this)` / arrow-in-JSX. AST-only.
- `jsx-no-comment-textnodes` — `//` accidentally rendered as text. AST-only.
- `jsx-no-constructed-context-values` — context `value={...}` with new object/array literal. AST-only.
- `jsx-no-leaked-render` — `cond && <X/>` where cond may be `0`/`''`. Type-aware (or AST-only conservative).
- `jsx-no-literals` — disallow plain text children. AST-only.
- `jsx-one-expression-per-line` — style/format. Style/format.
- `jsx-pascal-case` — PascalCase user components. AST-only.
- `jsx-props-no-multi-spaces`, `jsx-props-no-spread-multi` — style + AST.
- `jsx-props-no-spreading` — disallow `{...props}` spread. AST-only.
- `jsx-sort-default-props` — sort `defaultProps` keys. AST-only.
- `jsx-sort-props` — sort JSX prop order. AST-only.
- `jsx-space-before-closing` — style/format. Style/format.
- `jsx-tag-spacing` — style/format. Style/format.
- `jsx-uses-react`, `jsx-uses-vars` — mark React/JSX identifiers as used. Coupled to `no-unused-vars`; ttsc would gate via the same scope tracker.
- `jsx-wrap-multilines` — style/format. Style/format.
- `no-access-state-in-setstate` — flag `this.setState({x: this.state.y})`. AST-only.
- `no-adjacent-inline-elements` — discourage neighboring inline JSX without whitespace. AST-only.
- `no-arrow-function-lifecycle` — disallow arrow methods for `componentDidMount` etc. AST-only.
- `no-deprecated` — flag legacy lifecycle hooks per React version. AST-only.
- `no-did-mount-set-state`, `no-did-update-set-state`, `no-will-update-set-state` — flag `setState` in those lifecycles. AST-only.
- `no-invalid-html-attribute` — unknown values for `rel`, `target`, etc. AST-only + table.
- `no-multi-comp` — only one component per file. AST-only.
- `no-namespace` — disallow `<Namespace:Foo/>`. AST-only.
- `no-object-type-as-default-prop` — defaultProps with `{}` / `[]` literal. AST-only.
- `no-redundant-should-component-update` — `shouldComponentUpdate` in `PureComponent`. AST-only (class hierarchy).
- `no-render-return-value` — flag `const x = ReactDOM.render(...)`. AST-only.
- `no-set-state` — disallow `this.setState`. AST-only.
- `no-this-in-sfc` — `this.x` inside stateless function component. AST-only.
- `no-typos` — typo'd lifecycle / static names (`getDeriveStateFromProps`). AST-only.
- `no-unknown-property` — flag invalid DOM attributes (`class`, `for`, etc.). AST-only + table.
- `no-unsafe` — flag `UNSAFE_*` lifecycles. AST-only.
- `no-unstable-nested-components` — components defined inside other components. AST-only.
- `no-unused-class-component-methods` — unused class methods on a component. AST-only.
- `no-unused-prop-types` — propTypes declared but not read. AST-only.
- `no-unused-state` — `this.state.x` declared but unused. AST-only.
- `prefer-es6-class` — class component must be ES6 class, not `createClass`. AST-only.
- `prefer-exact-props` — exact-shape propTypes. AST-only.
- `prefer-read-only-props` — `readonly` prop types in TS. Type-aware.
- `prefer-stateless-function` — recommend FC over Class when possible. AST-only.
- `prop-types` — require `propTypes` declaration. AST-only.
- `react-in-jsx-scope` — `React` import required in JSX scope. AST-only.
- `require-default-props` — every non-required propType must have a default. AST-only.
- `require-optimization` — require `PureComponent`/`shouldComponentUpdate`. AST-only.
- `require-render-return` — class component `render()` must return. AST-only.
- `self-closing-comp` — self-close components without children. AST-only.
- `sort-comp` — sort class-component methods. AST-only.
- `sort-default-props`, `sort-prop-types` — sort property orders. AST-only.
- `state-in-constructor` — `this.state = {}` only in `constructor`. AST-only.
- `static-property-placement` — `static defaultProps` placement. AST-only.

Notes: the bulk of the missing rules are class-component lifecycle and
PropTypes-era rules. Modern React-19-only codebases need only a small subset
(`jsx-fragments`, `jsx-no-bind`, `jsx-no-leaked-render`, `jsx-pascal-case`,
`no-unknown-property`, `no-unstable-nested-components`,
`prefer-stateless-function`, `self-closing-comp`, `react-in-jsx-scope`,
`jsx-no-literals`, `jsx-key` extensions). Recommend triaging the import as two
buckets: "modern React" (~12 rules) vs. "legacy class/PropTypes" (~70 rules).

### react-hooks (eslint-plugin-react-hooks) — 8 / 17

Implemented (also under `react/...` namespace in ttsc):
`component-hook-factories`, `exhaustive-deps`, `immutability`, `refs`,
`rules-of-hooks`, `set-state-in-effect`, `set-state-in-render`, `use-memo`.

Missing (9, all React-Compiler-derived lints — they share the
`react.dev/reference/eslint-plugin-react-hooks/lints/<name>` URL):

- `config` — disallow invalid React Compiler configuration. AST-only on config sites.
- `error-boundaries` — flag patterns that bypass React error boundaries. AST-only.
- `gating` — verify `__DEV__`/feature-flag gates around experimental APIs. AST-only.
- `globals` — disallow mutating known globals from components. AST-only.
- `incompatible-library` — warn on libraries incompatible with React Compiler. AST + import-map.
- `preserve-manual-memoization` — keep manual `useMemo`/`useCallback` when compiler can't auto-memo. AST-only.
- `purity` — components must be pure (no top-level side effects). AST-only.
- `static-components` — components must not be defined inside other components (compiler variant). AST-only.
- `unsupported-syntax` — flag syntax the React Compiler cannot ingest. AST-only.

These come from the React Compiler's internal `LintRules` registry. Port
difficulty depends on whether the compiler's analysis is reproduced; for an
ESLint-style port, a conservative AST check is usually enough.

### react-refresh (eslint-plugin-react-refresh) — 1 / 1

Complete: `only-export-components`.

### react-perf (eslint-plugin-react-perf) — 4 / 4

Complete: `jsx-no-jsx-as-prop`, `jsx-no-new-array-as-prop`,
`jsx-no-new-function-as-prop`, `jsx-no-new-object-as-prop`.

### solid (eslint-plugin-solid) — 21 / 21

Complete. No missing rules.

### nextjs (`@next/eslint-plugin-next`) — 21 / 22

Missing (1):

- `no-location-assign-relative-destination` — `window.location = ...` with relative URL trips Next.js's URL parsing. AST-only.

### jsx-a11y (eslint-plugin-jsx-a11y) — 37 / 39

Missing (2):

- `accessible-emoji` — wrap emoji in `<span role="img" aria-label="..."/>`. **Deprecated upstream**; safe to skip.
- `no-onchange` — discourage `onChange` on `<select>`, prefer `onBlur`. **Deprecated upstream**; safe to skip.

Both are legacy/deprecated; coverage is effectively 100% of the active rule set.

### jest (eslint-plugin-jest) — 19 / 71

Implemented: `expect-expect`, `max-expects`, `no-conditional-expect`,
`no-conditional-in-test`, `no-disabled-tests`, `no-done-callback`,
`no-duplicate-hooks`, `no-export`, `no-focused-tests`, `no-hooks`,
`no-identical-title`, `no-standalone-expect`, `no-test-prefixes`,
`no-test-return-statement`, `prefer-to-have-length`, `require-to-throw-message`,
`valid-describe-callback`, `valid-expect`, `valid-title`.

Missing (52). Grouped:

- Style/consistency: `consistent-test-it`, `max-nested-describe`,
  `no-large-snapshots`, `no-interpolation-in-snapshots`, `no-commented-out-tests`,
  `prefer-lowercase-title`, `prefer-snapshot-hint`,
  `require-top-level-describe`, `valid-expect-in-promise`,
  `valid-expect-with-promise`. AST-only.
- Deprecation guards: `no-alias-methods` (e.g. `toThrowError` → `toThrow`),
  `no-confusing-set-timeout`, `no-deprecated-functions`, `no-error-equal`,
  `no-jasmine-globals`, `no-mocks-import`. AST-only + table.
- Restriction rules (configurable allow-lists): `no-restricted-jest-methods`,
  `no-restricted-matchers`. AST-only.
- Mock/typing: `no-untyped-mock-factory`, `prefer-jest-mocked`,
  `prefer-mock-promise-shorthand`, `prefer-mock-return-shorthand`,
  `prefer-spy-on`, `unbound-method`, `valid-mock-module-path`. AST + Type-aware.
- Better matchers: `prefer-called-with`, `prefer-comparison-matcher`,
  `prefer-each`, `prefer-equality-matcher`, `prefer-expect-assertions`,
  `prefer-expect-resolves`, `prefer-strict-equal`, `prefer-to-be`,
  `prefer-to-contain`, `prefer-to-have-been-called`,
  `prefer-to-have-been-called-times`, `prefer-ending-with-an-expect`,
  `prefer-todo`. AST-only.
- Hook discipline: `prefer-hooks-in-order`, `prefer-hooks-on-top`,
  `require-hook`. AST-only.
- Modern Jest: `prefer-importing-jest-globals`,
  `no-unnecessary-assertion`, `no-unneeded-async-expect-function`. AST-only.
- Padding/whitespace (style): `padding-around-all`,
  `padding-around-after-all-blocks`, `padding-around-after-each-blocks`,
  `padding-around-before-all-blocks`, `padding-around-before-each-blocks`,
  `padding-around-describe-blocks`, `padding-around-expect-groups`,
  `padding-around-test-blocks`. Style/format.

### vitest (eslint-plugin-vitest) — 13 / 82

Implemented: `expect-expect`, `no-conditional-expect`, `no-conditional-tests`,
`no-disabled-tests`, `no-done-callback`, `no-focused-tests`,
`no-identical-title`, `no-standalone-expect`, `no-test-return-statement`,
`prefer-to-have-length`, `valid-describe-callback`, `valid-expect`,
`valid-title`.

Missing (69):

- Naming/consistency: `consistent-each-for`, `consistent-test-filename`,
  `consistent-test-it`, `consistent-vitest-vi`, `hoisted-apis-on-top`,
  `max-expects`, `max-nested-describe`, `no-alias-methods`,
  `no-commented-out-tests`, `no-conditional-in-test`, `no-duplicate-hooks`,
  `no-hooks`, `no-import-node-test`, `no-importing-vitest-globals`,
  `no-interpolation-in-snapshots`, `no-large-snapshots`, `no-mocks-import`,
  `no-restricted-matchers`, `no-restricted-vi-methods`, `no-test-prefixes`,
  `no-unneeded-async-expect-function`. AST-only.
- Padding (8 rules): `padding-around-*`. Style/format.
- Modern matchers: `prefer-called-exactly-once-with`, `prefer-called-once`,
  `prefer-called-times`, `prefer-called-with`, `prefer-comparison-matcher`,
  `prefer-describe-function-title`, `prefer-each`, `prefer-equality-matcher`,
  `prefer-expect-assertions`, `prefer-expect-resolves`, `prefer-expect-type-of`,
  `prefer-hooks-in-order`, `prefer-hooks-on-top`, `prefer-import-in-mock`,
  `prefer-importing-vitest-globals`, `prefer-lowercase-title`,
  `prefer-mock-promise-shorthand`, `prefer-mock-return-shorthand`,
  `prefer-snapshot-hint`, `prefer-spy-on`, `prefer-strict-boolean-matchers`,
  `prefer-strict-equal`, `prefer-to-be`, `prefer-to-be-falsy`,
  `prefer-to-be-object`, `prefer-to-be-truthy`, `prefer-to-contain`,
  `prefer-to-have-been-called-times`, `prefer-todo`, `prefer-vi-mocked`. AST-only.
- Concurrency: `require-awaited-expect-poll`,
  `require-local-test-context-for-concurrent-snapshots`. AST + Type-aware.
- Misc: `require-hook`, `require-mock-type-parameters`, `require-test-timeout`,
  `require-to-throw-message`, `require-top-level-describe`, `unbound-method`,
  `valid-expect-in-promise`, `warn-todo`. AST-only.

The jest/vitest plugins share large rule overlap; many ports can be
mirror-implemented by parameterizing the shared driver.

### testing-library (eslint-plugin-testing-library) — 29 / 29

Complete. No missing rules.

### cypress (eslint-plugin-cypress) — 13 / 13

Complete. No missing rules.

### playwright (eslint-plugin-playwright) — 31 / 58

Implemented: `expect-expect`, `max-expects`, `no-conditional-expect`,
`no-conditional-in-test`, `no-duplicate-hooks`, `no-duplicate-slow`,
`no-element-handle`, `no-eval`, `no-focused-test`, `no-force-option`,
`no-get-by-title`, `no-hooks`, `no-nested-step`, `no-networkidle`,
`no-nth-methods`, `no-page-pause`, `no-skipped-test`, `no-slowed-test`,
`no-standalone-expect`, `no-wait-for-navigation`, `no-wait-for-selector`,
`no-wait-for-timeout`, `prefer-locator`, `prefer-to-have-count`,
`prefer-to-have-length`, `prefer-web-first-assertions`,
`require-to-pass-timeout`, `require-to-throw-message`,
`valid-describe-callback`, `valid-expect`, `valid-title`.

Missing (27):

- `consistent-spacing-between-blocks` — style/format.
- `max-nested-describe` — AST-only.
- `missing-playwright-await` — flag `expect(locator).toBeVisible()` without `await`. AST + Type-aware.
- `no-commented-out-tests` — AST-only.
- `no-raw-locators` — disallow `page.locator('text')`. AST-only + config.
- `no-restricted-locators` / `no-restricted-matchers` / `no-restricted-roles` — configurable allow-lists. AST-only.
- `no-unsafe-references` — flag closure references inside `page.evaluate`. AST-only (scope).
- `no-unused-locators` — declared `Locator` never queried. AST-only.
- `no-useless-await` / `no-useless-not` — AST-only.
- `prefer-comparison-matcher`, `prefer-equality-matcher`,
  `prefer-hooks-in-order`, `prefer-hooks-on-top`, `prefer-lowercase-title`,
  `prefer-native-locators`, `prefer-strict-equal`, `prefer-to-be`,
  `prefer-to-contain` — AST-only.
- `require-hook`, `require-soft-assertions`, `require-tags`,
  `require-top-level-describe` — AST-only.
- `valid-expect-in-promise`, `valid-test-tags` — AST-only.

### storybook (eslint-plugin-storybook) — 15 / 15

Complete. ttsc additionally ships `no-renderer-packages` (Storybook 8/9 rule
that ships in newer plugin versions; double-check parity against the latest
plugin release in case the upstream slug differs).

### tanstack-query (`@tanstack/eslint-plugin-query`) — 8 / 8

Complete.

### promise (eslint-plugin-promise) — 17 / 17

Complete.

### jsdoc (eslint-plugin-jsdoc) — 12 / 66

Implemented (`jsdoc/...`): `check-tag-names`, `check-values`, `empty-tags`,
`no-types`, `reject-any-type`, `reject-function-type`, `require-description`,
`require-param-description`, `require-param-name`,
`require-property-description`, `require-property-name`,
`require-returns-description`. Plus `tsdoc-syntax` (TSDoc bridge — out of
upstream scope).

Missing (54). Grouped:

- Structural: `check-access`, `check-alignment`, `check-indentation`,
  `check-line-alignment`, `check-syntax`, `multiline-blocks`,
  `no-multi-asterisks`, `require-asterisk-prefix`, `tag-lines`,
  `lines-before-block`, `no-bad-blocks`, `no-blank-block-descriptions`,
  `no-blank-blocks`. Token-stream.
- Tag/name checks: `check-examples`, `check-param-names`,
  `check-property-names`, `check-template-names`, `check-types`,
  `match-description`, `match-name`, `no-restricted-syntax`,
  `no-missing-syntax`, `no-undefined-types`, `text-escaping`,
  `escape-inline-tags`. AST + Token-stream.
- Modernization: `convert-to-jsdoc-comments`, `imports-as-dependencies`,
  `prefer-import-tag`. AST + Token-stream.
- Require-presence: `require-description-complete-sentence`,
  `require-example`, `require-file-overview`,
  `require-hyphen-before-param-description`, `require-jsdoc`,
  `require-param`, `require-param-type`, `require-property`,
  `require-property-type`, `require-rejects`, `require-returns`,
  `require-returns-check`, `require-returns-type`, `require-tags`,
  `require-template`, `require-throws`, `require-yields`,
  `require-yields-check`. Token-stream + AST.
- TypeScript-specific: `ts-method-signature-style`,
  `ts-no-empty-object-type`, `ts-no-unnecessary-template-expression`,
  `ts-prefer-function-type`, `type-formatting`, `valid-types`,
  `no-defaults`, `implements-on-classes`, `informative-docs`, `sort-tags`.
  Type-aware.

Notes: `eslint-plugin-jsdoc` is the only family where the gap is mostly
non-trivial because it requires parsing JSDoc bodies (handled today inside
`ast_helpers.go`/`format_jsdoc.go`, but the parser would need extensions for
per-tag validation).

### regexp (eslint-plugin-regexp) — 22 / 82

Implemented: `no-control-character`, `no-dupe-characters-character-class`,
`no-empty-alternative`, `no-empty-capturing-group`, `no-empty-character-class`,
`no-empty-group`, `no-empty-lookarounds-assertion`,
`no-misleading-unicode-character`, `no-useless-character-class`,
`no-useless-escape`, `no-useless-flag`, `no-useless-quantifier`,
`no-useless-two-nums-quantifier`, `no-zero-quantifier`, `prefer-d`,
`prefer-plus-quantifier`, `prefer-question-quantifier`,
`prefer-star-quantifier`, `prefer-w`, `require-unicode-regexp`,
`require-unicode-sets-regexp`, `sort-flags`.

Missing (60):

- Quantifier/assertion semantics: `confusing-quantifier`,
  `no-contradiction-with-assertion`, `no-empty-string-literal`,
  `no-escape-backspace`, `no-extra-lookaround-assertions`,
  `no-invalid-regexp`, `no-lazy-ends`, `no-legacy-features`,
  `no-misleading-capturing-group`, `no-missing-g-flag`,
  `no-non-standard-flag`, `no-obscure-range`, `no-octal`,
  `no-optional-assertion`, `no-potentially-useless-backreference`,
  `no-standalone-backslash`, `no-super-linear-backtracking`,
  `no-super-linear-move`, `no-trivially-nested-assertion`,
  `no-trivially-nested-quantifier`, `no-unused-capturing-group`,
  `no-useless-assertions`, `no-useless-backreference`,
  `no-useless-dollar-replacements`, `no-useless-lazy`,
  `no-useless-non-capturing-group`, `no-useless-range`,
  `no-useless-set-operand`, `no-useless-string-literal`. Token-stream
  (regex literal parser).
- Style/formatting: `control-character-escape`, `grapheme-string-literal`,
  `hexadecimal-escape`, `letter-case`, `match-any`, `negation`,
  `optimal-lookaround-quantifier`, `optimal-quantifier-concatenation`,
  `unicode-escape`, `unicode-property`, `use-ignore-case`. Token-stream + style.
- Preference rules: `prefer-character-class`,
  `prefer-escape-replacement-dollar-char`, `prefer-lookaround`,
  `prefer-named-backreference`, `prefer-named-capture-group`,
  `prefer-named-replacement`, `prefer-predefined-assertion`,
  `prefer-quantifier`, `prefer-range`, `prefer-regexp-exec`,
  `prefer-regexp-test`, `prefer-result-array-groups`, `prefer-set-operation`,
  `prefer-unicode-codepoint-escapes`. Token-stream.
- Ordering/correctness: `no-dupe-disjunctions`, `no-invisible-character`,
  `simplify-set-operations`, `sort-alternatives`,
  `sort-character-class-elements`, `strict`. Token-stream.

`@ttsc/lint` already has a regex-literal parser
(`rules_regexp.go::regexpLiteralParts`); these rules are mostly extensions on
top of it.

### functional (eslint-plugin-functional) — 20 / 20

Complete.

### boundaries (eslint-plugin-boundaries) — 6 / 7

Missing (1):

- `no-ignored` — flag files that match no element/scope and would be silently
  skipped by `boundaries`. AST-only + config.
- `no-unknown-files` — similar but for files not classified by element types.

Implemented set: `dependencies`, `element-types`, `entry-point`, `external`,
`no-private`, `no-unknown`. Note: upstream source files are `Dependencies.ts`
(produces `element-types`), `EntryPoint`, `External`, `NoIgnored`, `NoPrivate`,
`NoUnknown`, `NoUnknownFiles` — ttsc exposes both `dependencies` and
`element-types`, which may be redundant if upstream now consolidates them
under one slug.

### typescript-eslint (`typescript/...`) — 97 / 134

Missing (37):

- `class-methods-use-this`, `consistent-return`, `default-param-last`,
  `dot-notation`, `init-declarations`, `max-params`, `no-array-constructor`,
  `no-dupe-class-members`, `no-empty-function`, `no-implied-eval`,
  `no-invalid-this`, `no-loop-func`, `no-loss-of-precision`,
  `no-redeclare`, `no-restricted-imports`, `no-shadow`,
  `no-unused-expressions`, `no-unused-vars`, `no-use-before-define`,
  `prefer-destructuring` — the typescript-eslint extension variants of core
  ESLint rules. ttsc already implements the core rule for several of these
  (under the bare slug); the TS-aware variants would mostly add
  type-aware refinement.
- `explicit-module-boundary-types`, `member-ordering`, `naming-convention`,
  `no-duplicate-type-constituents`, `no-type-alias`,
  `no-unnecessary-type-conversion`, `no-unnecessary-type-parameters`,
  `no-unsafe-type-assertion`, `no-unused-private-class-members`,
  `no-useless-default-assignment`, `no-var-requires`, `prefer-for-of`,
  `prefer-readonly-parameter-types`, `prefer-ts-expect-error`,
  `strict-void-return`, `typedef`, `unified-signatures`. Type-aware.

### eslint core — ~179 / ~292

Implemented set spans `rules_no_*.go`, `rules_prefer_*.go`,
`rules_consistent_*.go`, `rules_misc.go`, `rules_core_extra.go`,
`rules_complexity.go`, `rules_max_*.go`, `rules_format_*.go`,
`rules_no_magic_numbers.go`, etc.

The missing list is dominated by:

- **Deprecated formatting rules** (~80) moved to `@stylistic/eslint-plugin` —
  `array-bracket-newline`, `array-bracket-spacing`, `arrow-parens`,
  `arrow-spacing`, `block-spacing`, `brace-style`, `comma-dangle`,
  `comma-spacing`, `comma-style`, `computed-property-spacing`, `dot-location`,
  `eol-last`, `func-call-spacing`, `function-call-argument-newline`,
  `function-paren-newline`, `generator-star-spacing`, `implicit-arrow-linebreak`,
  `indent`, `indent-legacy`, `jsx-quotes`, `key-spacing`, `keyword-spacing`,
  `line-comment-position`, `linebreak-style`, `lines-around-comment`,
  `lines-around-directive`, `lines-between-class-members`,
  `max-statements-per-line`, `multiline-comment-style`, `multiline-ternary`,
  `new-parens`, `newline-after-var`, `newline-before-return`,
  `newline-per-chained-call`, `no-confusing-arrow`, `no-extra-parens`,
  `no-extra-semi`, `no-floating-decimal`, `no-inline-comments`,
  `no-mixed-spaces-and-tabs`, `no-multi-spaces`, `no-multiple-empty-lines`,
  `no-spaced-func`, `no-tabs`, `no-trailing-spaces`,
  `no-unexpected-multiline`, `no-whitespace-before-property`,
  `nonblock-statement-body-position`, `object-curly-newline`,
  `object-curly-spacing`, `object-property-newline`, `one-var-declaration-per-line`,
  `operator-linebreak`, `padded-blocks`, `padding-line-between-statements`,
  `quote-props`, `quotes`, `rest-spread-spacing`, `semi`, `semi-spacing`,
  `semi-style`, `space-before-blocks`, `space-before-function-paren`,
  `space-in-parens`, `space-infix-ops`, `space-unary-ops`, `spaced-comment`,
  `switch-colon-spacing`, `template-curly-spacing`, `template-tag-spacing`,
  `unicode-bom`, `wrap-iife`, `wrap-regex`, `yield-star-spacing`, `max-len`.

  Most of these are subsumed by ttsc's `rules_format_*.go` (`format/quotes`,
  `format/semi`, `format/trailing-comma`, `format/print-width`, etc.) — the
  ESLint rules are *intentionally* not ported.

- **Genuinely missing semantic rules** (~30):
  - `accessor-pairs` — `set` without `get`. AST-only.
  - `array-callback-return` — `.map`/`.filter`/etc. must return. AST + Type-aware.
  - `arrow-body-style` — concise vs. block body. AST-only.
  - `block-scoped-var` — `var` outside scope. AST-only.
  - `callback-return` — Node-style callback discipline. AST-only.
  - `capitalized-comments` — comment must start uppercase. Token-stream.
  - `class-methods-use-this` — non-static method without `this`. AST-only.
  - `consistent-this` — alias `this` consistently. AST-only.
  - `constructor-super` — derived constructor must call `super`. AST-only (already covered by tsc?).
  - `func-name-matching`, `func-names`, `func-style` — function declaration style. AST-only.
  - `global-require`, `handle-callback-err`, `no-buffer-constructor`,
    `no-catch-shadow`, `no-mixed-requires`, `no-native-reassign`,
    `no-new-object`, `no-new-require`, `no-path-concat`, `no-process-env`,
    `no-process-exit`, `no-restricted-modules`, `no-sync` — legacy
    Node-environment lints; mostly deprecated.
  - `no-const-assign` — assigning to `const`. Covered by tsc?
  - `no-constant-binary-expression` — `x === NaN`, `x | 0`. AST-only.
  - `no-div-regex` — `/=foo/`. AST-only.
  - `no-extra-label`, `no-label-var` — labels. AST-only.
  - `no-global-assign`, `no-implicit-globals` — global writes. AST-only.
  - `no-implied-eval` — `setTimeout("...")`. AST-only.
  - `no-invalid-regexp` — already covered by regexp parser; could expose at core too.
  - `no-negated-in-lhs` — `!(a) in b`. AST-only.
  - `no-new-native-nonconstructor`, `no-nonoctal-decimal-escape` — AST-only.
  - `no-restricted-exports`, `no-restricted-globals`,
    `no-restricted-properties` — configurable AST-only.
  - `no-return-await` — implicit await. AST-only.
  - `no-ternary`, `no-underscore-dangle`, `no-void`,
    `no-warning-comments` — AST-only.
  - `no-unmodified-loop-condition` — `while (x)` where `x` never changes. AST + scope.
  - `no-unreachable-loop` — loop that always exits. AST-only.
  - `no-undef`, `no-unused-vars`, `no-use-before-define`,
    `no-unused-private-class-members` — scope checks; partially handled by tsc.
  - `no-unassigned-vars`, `no-useless-backreference` — AST/regex.
  - `preserve-caught-error` — re-throw with `cause`. AST-only.
  - `prefer-promise-reject-errors` — `Promise.reject(...)` must be `Error`. AST + Type-aware.
  - `prefer-reflect`, `prefer-regex-literals` — AST-only.
  - `require-atomic-updates`, `require-await`,
    `require-unicode-regexp` — AST-only.
  - `sort-vars`, `strict`, `symbol-description`,
    `id-blacklist`, `id-denylist`, `id-match`, `new-cap` — AST-only.

### eslint-plugin-import — 0 / 46

Nothing in the `import/...` namespace is currently ported. Missing rules:

- Static analysis (cross-file resolution required): `default`, `named`,
  `namespace`, `no-cycle`, `no-deprecated`, `no-extraneous-dependencies`,
  `no-internal-modules`, `no-named-as-default`, `no-named-as-default-member`,
  `no-relative-packages`, `no-relative-parent-imports`, `no-restricted-paths`,
  `no-self-import`, `no-unresolved`, `no-unused-modules`,
  `no-useless-path-segments`, `no-webpack-loader-syntax`.
- Module-shape: `consistent-type-specifier-style`, `enforce-node-protocol-usage`,
  `exports-last`, `export`, `extensions`, `first`, `imports-first`,
  `max-dependencies`, `newline-after-import`, `no-absolute-path`, `no-amd`,
  `no-anonymous-default-export`, `no-commonjs`, `no-default-export`,
  `no-duplicates`, `no-dynamic-require`, `no-empty-named-blocks`,
  `no-import-module-exports`, `no-mutable-exports`, `no-named-default`,
  `no-named-export`, `no-namespace`, `no-nodejs-modules`,
  `no-unassigned-import`, `order`, `prefer-default-export`, `unambiguous`,
  `group-exports`, `dynamic-import-chunkname`.

These are all eligible because ttsc has a real `TypeChecker` (`ctx.Checker`)
and `Program` (`ctx.Program`) at hand — eslint-plugin-import's main weakness
(needing eslint-import-resolver-typescript) is a non-issue here.

### eslint-comments (`eslint-community/eslint-plugin-eslint-comments`) — 0 / 9

Missing all 9: `disable-enable-pair`, `no-aggregating-enable`,
`no-duplicate-disable`, `no-restricted-disable`, `no-unlimited-disable`,
`no-unused-disable`, `no-unused-enable`, `no-use`, `require-description`.

ttsc parses ESLint-style disable comments today (`directives.go`), so most
of these would just be additional checks on the parsed directive set.

## Candidate proposals (to surface in discussion)

1. **Add the missing 1-rule deltas first** (cheap, finishes the family
   coverage story): nextjs `no-location-assign-relative-destination`,
   jsx-a11y `accessible-emoji` + `no-onchange` (or formally mark them
   `deprecated`), boundaries `no-ignored` + `no-unknown-files`, unicorn
   `dom-node-dataset` alias.

2. **Finish React Hooks (React Compiler lints)**. Nine rules, all
   AST-only, share infrastructure (component detection, hook detection)
   with the existing eight implementations. Batch.

3. **React (`eslint-plugin-react`) — modern subset, one PR**.
   Triage the 85 missing rules into two buckets; ship the ~12 "modern
   React" rules first (`jsx-fragments`, `jsx-no-bind`, `jsx-no-leaked-render`,
   `jsx-pascal-case`, `no-unknown-property`, `no-unstable-nested-components`,
   `prefer-stateless-function`, `self-closing-comp`, `react-in-jsx-scope`,
   `jsx-no-literals`, `jsx-max-depth`, `jsx-handler-names`). Defer the
   class-component / PropTypes-era rules to a separate "legacy" PR or skip
   entirely.

4. **Mirror jest → vitest**. Of the 52 missing jest rules and 69 missing
   vitest rules, ~45 are mechanically identical (just differ in the
   `vi`/`jest` identifier and `.mock`/`.spyOn` shape). A shared
   `rules_test_framework.go` driver registered twice (once per family
   prefix) would close ~90 missing slugs at once.

5. **Playwright catch-up**. 27 missing rules; the test/expect ones
   (`prefer-comparison-matcher`, `prefer-equality-matcher`,
   `prefer-hooks-in-order`, `prefer-hooks-on-top`, `prefer-lowercase-title`,
   `prefer-strict-equal`, `prefer-to-be`, `prefer-to-contain`,
   `require-hook`, `require-top-level-describe`,
   `valid-expect-in-promise`) can reuse the jest/vitest driver from
   proposal (4). Playwright-specific lints
   (`missing-playwright-await`, `no-raw-locators`, `no-unsafe-references`,
   `no-unused-locators`, `no-useless-await`, `no-useless-not`,
   `prefer-native-locators`, `require-soft-assertions`,
   `require-tags`, `valid-test-tags`) are the unique value-add.

6. **eslint-plugin-import is a green field**. Zero coverage today and
   46 missing rules. Recommend a dedicated `rules_import_*.go` family
   leveraging `ctx.Program` for resolution. Highest-value picks:
   `no-cycle`, `no-default-export`, `no-duplicates`, `no-extraneous-dependencies`,
   `no-unresolved`, `no-useless-path-segments`, `order`,
   `consistent-type-specifier-style`, `first`, `newline-after-import`,
   `no-relative-packages`, `extensions`, `enforce-node-protocol-usage`.

7. **eslint-comments**. Nine rules, low effort, slots into the existing
   directive parser. Recommend doing them as one PR.

8. **jsdoc**. 54 missing rules; the largest single backlog after react/
   vitest/jest. Strongly recommend deferring or carving into "must-have"
   (`require-jsdoc`, `require-param`, `require-returns`,
   `require-returns-check`, `require-throws`, `require-yields`,
   `check-param-names`, `check-property-names`, `check-types`,
   `no-undefined-types`, `multiline-blocks`, `require-asterisk-prefix`,
   `tag-lines`, `no-blank-blocks`) vs. "later".

9. **regexp**. 60 missing rules, mostly token-stream extensions of the
   existing `regexpLiteralParts` parser. Bulk port plausible. Highest
   value: `no-super-linear-backtracking`, `no-super-linear-move`,
   `no-misleading-capturing-group`, `no-useless-backreference`,
   `no-octal`, `no-obscure-range`, `no-missing-g-flag`,
   `prefer-named-capture-group`, `prefer-character-class`,
   `prefer-lookaround`, `prefer-quantifier`.

10. **Do not port** the ~80 eslint core formatting rules that have been
    moved to `@stylistic/eslint-plugin`; ttsc's `rules_format_*.go`
    family is the canonical home for layout decisions. Surface this as
    a documentation note in the README's coverage matrix rather than as
    missing-rule work.
