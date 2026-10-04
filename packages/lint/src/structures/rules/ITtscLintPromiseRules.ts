import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Promise correctness and style rules from `eslint-plugin-promise`.
 *
 * Checks the chain shape of Promise-using code: every chain ends with `catch`,
 * no callback inside a `then`, no nested `.then().then()`, and so on.
 *
 * AST-local only — type-aware Promise checks belong with `typescript/*` checker
 * rules.
 *
 * @reference https://github.com/eslint-community/eslint-plugin-promise
 *
 * @evidence contracts/common.md#principled-implementation Optional promise keys express AST-based chain policies through severity-only settings, keeping their representation distinct from checker-based typescript rules.
 * @evidence contracts/common.md#clear-and-simple-design The family groups promise-chain configuration and shares severity construction; it does not introduce asynchronous execution behavior into the type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit policy keys and a closed setting union provide the configuration boundary without monkey patching Promise or adding test-only forms.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the AST scope and the no-multiple-resolved limitation, while member comments explain failure channels; paragraph and member separation follow documentation guidance.
 */
export interface ITtscLintPromiseRules {
  /**
   * Require recognized block-bodied `then()` callbacks to satisfy the native
   * return-or-throw statement analysis. A bare return counts; expression-bodied
   * callbacks are skipped rather than checked for a non-undefined value.
   *
   * The policy checks termination syntax, not the resolved value's type.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/always-return.md
   */
  "promise/always-return"?: TtscLintRuleSetting;

  /**
   * Reject every `new Promise(...)` construction. Most modern code can use
   * `async`/`await` or existing Promise-returning APIs.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/avoid-new.md
   */
  "promise/avoid-new"?: TtscLintRuleSetting;

  /**
   * Require unreturned promise chains to terminate with `catch()` so unhandled
   * rejections cannot escape.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/catch-or-return.md
   */
  "promise/catch-or-return"?: TtscLintRuleSetting;

  /**
   * Reject direct invocation of an error-first callback inside a `then()` or
   * `catch()` handler.
   *
   * Synchronously calling the callback from a promise handler can re-enter it
   * on both the fulfilled and rejected paths. Upstream guidance: defer via
   * `setImmediate`/`process.nextTick` if a callback bridge is genuinely
   * required.
   *
   * Also flags `.then(callback)` / `.catch(callback)` calls whose handler
   * argument is a bare callback-shaped identifier (`callback`, `cb`, `next`,
   * `done`).
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/no-callback-in-promise.md
   */
  "promise/no-callback-in-promise"?: TtscLintRuleSetting;

  /**
   * Detect Promise executor bodies with more than one resolve/reject call. The
   * native rule does not yet model branch exclusivity — bodies whose calls are
   * split across mutually exclusive branches will be flagged too.
   *
   * The second call is silently ignored, but the surrounding logic almost
   * always assumed short-circuit.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/no-multiple-resolved.md
   */
  "promise/no-multiple-resolved"?: TtscLintRuleSetting;

  /**
   * Report a `new Promise` or `Promise.*` use when no collected import or
   * declaration is named `Promise` anywhere in the file. Native recognition
   * is file-wide and does not resolve lexical scope or runtime implementation.
   *
   * Useful for projects that substitute Bluebird or another library and want
   * the choice grep-visible per file.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/no-native.md
   */
  "promise/no-native"?: TtscLintRuleSetting;

  /**
   * Reject nested `then()`/`catch()` calls inside the body of a Promise
   * callback. Use chained `.then()` instead.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/no-nesting.md
   */
  "promise/no-nesting"?: TtscLintRuleSetting;

  /**
   * Reject `new` applied to Promise statics such as `new Promise.resolve(x)`,
   * `new Promise.all([...])`, or `new Promise.race([...])`.
   *
   * The statics are plain functions, so `new` throws a `TypeError` at runtime —
   * caught here before the call ships.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/no-new-statics.md
   */
  "promise/no-new-statics"?: TtscLintRuleSetting;

  /**
   * Reject building a promise chain inside the body of an error-first callback.
   *
   * The callback already owns an error channel, so layering
   * `.then()`/`.catch()` on top creates two incompatible failure pipelines.
   * Upstream advice: promisify the outer API instead.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/no-promise-in-callback.md
   */
  "promise/no-promise-in-callback"?: TtscLintRuleSetting;

  /**
   * Reject `return` from inside a `finally()` callback.
   *
   * This is a source policy, not proof that evaluating the returned expression
   * has no effect: a thrown error or returned rejection can change the outcome.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/no-return-in-finally.md
   */
  "promise/no-return-in-finally"?: TtscLintRuleSetting;

  /**
   * Reject `return Promise.resolve(x)` and `return Promise.reject(x)` inside
   * promise callbacks; return the bare value or `throw` instead.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/no-return-wrap.md
   */
  "promise/no-return-wrap"?: TtscLintRuleSetting;

  /**
   * Enforce `resolve` / `_resolve` and `reject` / `_reject` names on the first
   * two identifier parameters of recognized Promise executor functions.
   *
   * Consistent names make executor bodies greppable and prevent accidental
   * shadowing of the outer `resolve` symbol.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/param-names.md
   */
  "promise/param-names"?: TtscLintRuleSetting;

  /**
   * Flag callback-shaped call names, eligible last-argument functions beginning
   * with `err`/`error`, and functions whose last parameter is named `callback`
   * or `cb`. These are source-name heuristics, not invocation type analysis.
   *
   * Intended for codebases that have already migrated their I/O surface to
   * promises and want to keep callers consistent.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/prefer-await-to-callbacks.md
   */
  "promise/prefer-await-to-callbacks"?: TtscLintRuleSetting;

  /**
   * Prefer `await` over explicit `.then()`/`.catch()`/`.finally()` chains
   * wherever their member-call shapes occur, including outside async functions.
   *
   * Sequential awaits compose more naturally with try/catch and avoid the
   * indentation creep of deeply nested handlers.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/prefer-await-to-then.md
   */
  "promise/prefer-await-to-then"?: TtscLintRuleSetting;

  /**
   * Prefer `.catch(handler)` over the two-argument form `.then(onFulfilled,
   * onRejected)`.
   *
   * The two-argument shape skips rejections raised inside `onFulfilled`, which
   * surprises readers and hides errors from logging middleware.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/prefer-catch.md
   */
  "promise/prefer-catch"?: TtscLintRuleSetting;

  /**
   * Reject non-standard `Promise` statics such as `Promise.done`,
   * `Promise.spread`, or library-specific extensions shimmed onto the global.
   *
   * Sticking to spec methods keeps code portable across Promise
   * implementations.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/spec-only.md
   */
  "promise/spec-only"?: TtscLintRuleSetting;

  /**
   * Enforce the native argument-count policy for recognized method names:
   * `Promise.all`/`Promise.race` take exactly one argument,
   * `Promise.resolve`/`Promise.reject` take zero or one, `.then` takes one or
   * two, `.catch`/`.finally` take exactly one.
   *
   * Extra or missing arguments usually indicate a misread of the API.
   *
   * @reference https://github.com/eslint-community/eslint-plugin-promise/blob/main/docs/rules/valid-params.md
   */
  "promise/valid-params"?: TtscLintRuleSetting;
}
