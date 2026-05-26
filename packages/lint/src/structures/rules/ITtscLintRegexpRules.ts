import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Regular-expression rules from `eslint-plugin-regexp`.
 *
 * These rules check the structure of regex literals — emptiness,
 * uselessness, flag ordering, shorthand classes, Unicode support.
 *
 * Some rules duplicate (and supersede) the regex-related rules in
 * {@link ITtscLintCoreRules}; both ids exist so projects can keep
 * the legacy ESLint names alongside the regexp-plugin variants.
 *
 * @reference https://github.com/ota-meshi/eslint-plugin-regexp
 */
export interface ITtscLintRegexpRules {
  /**
   * Reject ASCII control characters in regex literals. Alias of
   * the bare core check.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-control-character.html
   */
  "regexp/no-control-character"?: TtscLintRuleSetting;

  /**
   * Reject duplicate literal characters inside simple regex
   * character classes (`/[aa]/`).
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-dupe-characters-character-class.html
   */
  "regexp/no-dupe-characters-character-class"?: TtscLintRuleSetting;

  /**
   * Reject empty alternatives in a disjunction (`/a||b/`), which
   * silently match the empty string.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-empty-alternative.html
   */
  "regexp/no-empty-alternative"?: TtscLintRuleSetting;

  /**
   * Reject empty capturing groups such as `/()/`.
   *
   * The group shifts the numbering of every later backreference and
   * capture slot while only ever capturing the empty string — almost
   * always a leftover from an unfinished edit.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-empty-capturing-group.html
   */
  "regexp/no-empty-capturing-group"?: TtscLintRuleSetting;

  /**
   * Reject empty regex character classes (`[]`). Alias of the
   * bare core check.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-empty-character-class.html
   */
  "regexp/no-empty-character-class"?: TtscLintRuleSetting;

  /**
   * Reject empty non-capturing groups such as `/(?:)/`.
   *
   * The group contributes nothing to the match and is virtually always
   * a leftover from a deleted inner pattern.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-empty-group.html
   */
  "regexp/no-empty-group"?: TtscLintRuleSetting;

  /**
   * Reject empty lookaround assertions such as `/(?=)/` or `/(?!)/`.
   *
   * An empty positive lookaround always matches; an empty negative
   * lookaround never matches. The assertion either collapses to a
   * no-op or breaks the surrounding pattern.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-empty-lookarounds-assertion.html
   */
  "regexp/no-empty-lookarounds-assertion"?: TtscLintRuleSetting;

  /**
   * Reject misleading Unicode characters in regex classes. Alias
   * of the bare misleading-character check.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-misleading-unicode-character.html
   */
  "regexp/no-misleading-unicode-character"?: TtscLintRuleSetting;

  /**
   * Reject single-character character classes such as `/[x]/`
   * — `/x/` is equivalent.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-useless-character-class.html
   */
  "regexp/no-useless-character-class"?: TtscLintRuleSetting;

  /**
   * Reject unnecessary escapes inside regex literals. Alias of
   * core `no-useless-escape` for regex contexts.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-useless-escape.html
   */
  "regexp/no-useless-escape"?: TtscLintRuleSetting;

  /**
   * Reject regex flags that the literal does not exercise — `i` on
   * a pattern without case-variable characters, `m` without `^`/`$`,
   * `s` without `.`, and similar dead flags on `g`/`y`.
   *
   * Cleans up flag combos that suggest behavior the pattern can never
   * trigger.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-useless-flag.html
   */
  "regexp/no-useless-flag"?: TtscLintRuleSetting;

  /**
   * Reject quantifiers that do not change the match — constant-one
   * counts (`/a{1}/`), `?` on patterns already matching the empty
   * string (`/(?:a+|b*)?/`), and quantifiers on non-consuming
   * atoms (`/(?:\b)+/`).
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-useless-quantifier.html
   */
  "regexp/no-useless-quantifier"?: TtscLintRuleSetting;

  /**
   * Reject equal min/max quantifiers (`/a{2,2}/`) in favor of
   * `/a{2}/`.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-useless-two-nums-quantifier.html
   */
  "regexp/no-useless-two-nums-quantifier"?: TtscLintRuleSetting;

  /**
   * Reject zero-repeat quantifiers (`/a{0}/`, `/a{0,0}/`) — the atom
   * never matches, so the quantifier is either dead code or a typo
   * for `{1,…}`.
   *
   * The fix is normally to delete the atom or correct the upper
   * bound.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-zero-quantifier.html
   */
  "regexp/no-zero-quantifier"?: TtscLintRuleSetting;

  /**
   * Prefer `\d` over `[0-9]` in regex literals.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/prefer-d.html
   */
  "regexp/prefer-d"?: TtscLintRuleSetting;

  /**
   * Prefer `+` over `{1,}` in regex literals.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/prefer-plus-quantifier.html
   */
  "regexp/prefer-plus-quantifier"?: TtscLintRuleSetting;

  /**
   * Prefer `?` over `{0,1}` in regex literals.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/prefer-question-quantifier.html
   */
  "regexp/prefer-question-quantifier"?: TtscLintRuleSetting;

  /**
   * Prefer `*` over `{0,}` in regex literals.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/prefer-star-quantifier.html
   */
  "regexp/prefer-star-quantifier"?: TtscLintRuleSetting;

  /**
   * Prefer `\w` over `[A-Za-z0-9_]` in regex literals.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/prefer-w.html
   */
  "regexp/prefer-w"?: TtscLintRuleSetting;

  /**
   * Require regex literals to use the `u` or `v` flag, so
   * Unicode-property escapes and surrogate-pair handling stay
   * predictable.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/require-unicode-regexp.html
   */
  "regexp/require-unicode-regexp"?: TtscLintRuleSetting;

  /**
   * Require regex literals to use the `v` flag specifically — the
   * stricter Unicode-sets mode that enables set notation, string
   * properties, and stricter escape rules on top of `u`.
   *
   * Choose this over `require-unicode-regexp` only on engines that
   * ship ES2024-era regex.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/require-unicode-sets-regexp.html
   */
  "regexp/require-unicode-sets-regexp"?: TtscLintRuleSetting;

  /**
   * Require regex flags to appear in canonical alphabetical order
   * (`dgimsuvy`).
   *
   * Stable ordering keeps diffs small and lets readers compare flag
   * sets at a glance.
   *
   * @reference https://ota-meshi.github.io/eslint-plugin-regexp/rules/sort-flags.html
   */
  "regexp/sort-flags"?: TtscLintRuleSetting;
}
