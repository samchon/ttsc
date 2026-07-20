import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Security-focused TypeScript source rules from `eslint-plugin-security`.
 *
 * Reports likely security smells — non-literal sinks for eval, file I/O, regex
 * construction, child-process spawning, cryptographic primitives — that warrant
 * human review even if no exploit is statically provable.
 *
 * Treat findings as _hints_, not proofs.
 *
 * @reference https://github.com/eslint-community/eslint-plugin-security
 */
export interface ITtscLintSecurityRules {
  /**
   * Detect Trojan-Source bidi control characters (U+202A, U+202E, ...) hidden
   * inside source.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-bidi-characters.md
   */
  "security/detect-bidi-characters"?: TtscLintRuleSetting;

  /**
   * Detect Buffer reads/writes called with `noAssert = true`, which skips
   * Node's offset/length bounds checks.
   *
   * The flag lets the offset slide past the buffer end and read unrelated
   * memory, so production code should never set it.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-buffer-noassert.md
   */
  "security/detect-buffer-noassert"?: TtscLintRuleSetting;

  /**
   * Detect any import of `child_process` and any `exec`/`execSync` call whose
   * command argument is not a string literal.
   *
   * Non-literal commands are the canonical shell-injection sink in Node
   * services.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-child-process.md
   */
  "security/detect-child-process"?: TtscLintRuleSetting;

  /**
   * Detect assignments setting `escapeMarkup = false` (or the equivalent option
   * on Handlebars/Mustache-style engines), which turns off HTML entity escaping
   * in template output.
   *
   * Result: an unguarded XSS sink for caller-controlled strings.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-disable-mustache-escape.md
   */
  "security/detect-disable-mustache-escape"?: TtscLintRuleSetting;

  /**
   * Detect `eval(...)` calls whose argument is not a string literal.
   *
   * Any expression argument means caller-controlled data can reach a
   * code-execution sink. The rule flags the call shape, not proven taint.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-eval-with-expression.md
   */
  "security/detect-eval-with-expression"?: TtscLintRuleSetting;

  /**
   * Detect `new Buffer(input)` constructions with non-literal input —
   * historical source of allocation-disclosure bugs.
   *
   * The three successors — `Buffer.from`, `Buffer.alloc`, `Buffer.allocUnsafe`
   * — are offered as editor suggestions and none is applied automatically:
   * which one is correct depends on the argument, which this rule fires
   * precisely because it cannot read. The rule stays untagged because its
   * upstream-compatible name match also admits a user-defined constructor named
   * `Buffer`.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-new-buffer.md
   */
  "security/detect-new-buffer"?: TtscLintRuleSetting;

  /**
   * Detect Express applications mounting `csrf` middleware before
   * `methodOverride`, which lets the CSRF token be bypassed.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-no-csrf-before-method-override.md
   */
  "security/detect-no-csrf-before-method-override"?: TtscLintRuleSetting;

  /**
   * Detect `fs` calls (`readFile`, `writeFile`, `createReadStream`, ...) whose
   * filename argument is not a string literal.
   *
   * Dynamic filenames are the standard path-traversal sink; sanitise or
   * allow-list before the call.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-non-literal-fs-filename.md
   */
  "security/detect-non-literal-fs-filename"?: TtscLintRuleSetting;

  /**
   * Detect `new RegExp(...)` construction whose pattern argument is not a
   * string literal.
   *
   * Caller-controlled patterns can both trigger catastrophic backtracking and
   * let an attacker reshape the matcher to bypass intended validation.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-non-literal-regexp.md
   */
  "security/detect-non-literal-regexp"?: TtscLintRuleSetting;

  /**
   * Detect `require(...)` calls whose specifier is computed at runtime.
   *
   * A dynamic specifier lets caller-controlled data choose the module to load,
   * bypassing any module allow-list on Node.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-non-literal-require.md
   */
  "security/detect-non-literal-require"?: TtscLintRuleSetting;

  /**
   * Detect dynamic bracket-access such as `obj[req.body.x] = ...`, which can
   * let caller-controlled keys overwrite prototype-shaped properties or pull
   * out unintended fields.
   *
   * Fires on virtually any computed property access; expect a high
   * false-positive rate in normal application code.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-object-injection.md
   */
  "security/detect-object-injection"?: TtscLintRuleSetting;

  /**
   * Detect direct equality comparisons involving secret-like identifiers (`if
   * (token === expected)`) — use `crypto.timingSafeEqual` instead.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-possible-timing-attacks.md
   */
  "security/detect-possible-timing-attacks"?: TtscLintRuleSetting;

  /**
   * Detect `crypto.pseudoRandomBytes`, which produces values that are not
   * cryptographically secure.
   *
   * Tokens, session ids, and key material must use `crypto.randomBytes` (or Web
   * Crypto's `getRandomValues`) instead.
   *
   * Type-aware via the Checker, which resolves the object at the use site so an
   * automatic rewrite is never applied to a shadowed binding. Enabling this
   * rule therefore puts the whole run on the checker path. The diagnostic
   * itself stays name-based, so it still reports without one.
   *
   * The member name alone is rewritten to `randomBytes`. The edit is automatic
   * when the object is proven to be an import or require of Node `crypto`, and
   * an editor suggestion otherwise, because a local application object can also
   * be named `crypto`. That name-based diagnostic surface also keeps the rule
   * untagged.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-pseudoRandomBytes.md
   */
  "security/detect-pseudoRandomBytes"?: TtscLintRuleSetting;

  /**
   * Detect regex literals with catastrophic backtracking potential (ReDoS) —
   * typically nested or overlapping quantifiers over the same character set.
   *
   * Matching caller-controlled input against such a pattern can block the event
   * loop for seconds.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/rules/detect-unsafe-regex.md
   */
  "security/detect-unsafe-regex"?: TtscLintRuleSetting;
}
