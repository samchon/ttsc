import type {
  ITtscLintBoundariesElementTypesRuleOptions,
  ITtscLintBoundariesEntryPointRuleOptions,
  ITtscLintBoundariesExternalRuleOptions,
  ITtscLintBoundariesNoPrivateRuleOptions,
  ITtscLintBoundariesNoUnknownRuleOptions,
  ITtscLintCypressUnsafeToChainCommandRuleOptions,
  ITtscLintDisableEnablePairRuleOptions,
  ITtscLintFunctionalEmptyRuleOptions,
  ITtscLintFunctionalImmutableDataRuleOptions,
  ITtscLintFunctionalNoConditionalStatementsRuleOptions,
  ITtscLintFunctionalNoLetRuleOptions,
  ITtscLintFunctionalNoMixedTypesRuleOptions,
  ITtscLintFunctionalNoReturnVoidRuleOptions,
  ITtscLintFunctionalNoThrowStatementsRuleOptions,
  ITtscLintFunctionalNoTryStatementsRuleOptions,
  ITtscLintFunctionalParametersRuleOptions,
  ITtscLintFunctionalPreferImmutableTypesRuleOptions,
  ITtscLintFunctionalPreferReadonlyTypeRuleOptions,
  ITtscLintFunctionalPreferTacitRuleOptions,
  ITtscLintFunctionalReadonlyTypeRuleOptions,
  ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions,
  ITtscLintJsdocRuleOptions,
  ITtscLintNoRestrictedDisableRuleOptions,
  ITtscLintNoUseRuleOptions,
  ITtscLintPrintWidthRuleOptions,
  ITtscLintQuotesRuleOptions,
  ITtscLintReactPerfRuleOptions,
  ITtscLintReactRefreshOnlyExportComponentsRuleOptions,
  ITtscLintSemiRuleOptions,
  ITtscLintSortImportsRuleOptions,
  ITtscLintStorybookNoUninstalledAddonsRuleOptions,
  ITtscLintTestingLibraryConsistentDataTestIdRuleOptions,
  ITtscLintTrailingCommaRuleOptions,
} from "./TtscLintRuleOptions";
import type { TtscLintSeverity } from "./TtscLintSeverity";

/** Severity-only rule setting. */
export type TtscLintRuleSetting =
  | TtscLintSeverity
  | readonly [TtscLintSeverity];

/** Rule setting that accepts a typed options object in tuple form. */
export type TtscLintRuleOptionsSetting<TOptions> =
  | TtscLintRuleSetting
  | readonly [TtscLintSeverity, TOptions];

/**
 * Rule severity map accepted by `ITtscLintConfig.rules`.
 *
 * Built-in rule families are exposed as separate interfaces so users can import
 * a narrow family type when composing configs. `ITtscLintRules` is the
 * intersection of every built-in family plus contributor plugin rules. Built-in
 * rule names intentionally mirror ESLint-style kebab-case IDs; contributor
 * rules keep their namespace with a slash, for example `demo/no-demo`.
 */
export type ITtscLintRules = ITtscLintCoreRules &
  ITtscLintBoundariesRules &
  ITtscLintCypressRules &
  ITtscLintEslintCommentsRules &
  ITtscLintFunctionalRules &
  ITtscLintJestRules &
  ITtscLintJsdocRules &
  ITtscLintJsxA11yRules &
  ITtscLintNextjsRules &
  ITtscLintPlaywrightRules &
  ITtscLintPromiseRules &
  ITtscLintReactRules &
  ITtscLintReactHooksRules &
  ITtscLintReactPerfRules &
  ITtscLintReactRefreshRules &
  ITtscLintRegexpRules &
  ITtscLintSecurityRules &
  ITtscLintSolidRules &
  ITtscLintStorybookRules &
  ITtscLintTanstackQueryRules &
  ITtscLintTestingLibraryRules &
  ITtscLintTsdocRules &
  ITtscLintVitestRules &
  ITtscLintFormatRules &
  ITtscLintContributorRules;

/** Unnamespaced ESLint and TypeScript-ESLint-compatible rules. */
export interface ITtscLintCoreRules {
  /** Keeps overload declarations for the same member adjacent. */
  "adjacent-overload-signatures"?: TtscLintRuleSetting;

  /** Prefers `T[]` and `readonly T[]` over array helper types. */
  "array-type"?: TtscLintRuleSetting;

  /**
   * Reject `await` on non-thenable operands. **Type-aware** — uses the Checker.
   * Autofixable (drops the `await`).
   */
  "await-thenable"?: TtscLintRuleSetting;

  /** Rejects TypeScript suppression comments such as `@ts-ignore`. */
  "ban-ts-comment"?: TtscLintRuleSetting;

  /** Rejects obsolete `tslint:` comments. */
  "ban-tslint-comment"?: TtscLintRuleSetting;

  /** Prefers `Record` for single index-signature object types. */
  "consistent-indexed-object-style"?: TtscLintRuleSetting;

  /** Prefers `as` type assertions over angle-bracket assertions. */
  "consistent-type-assertions"?: TtscLintRuleSetting;

  /** Prefers interfaces for object-shaped type definitions. */
  "consistent-type-definitions"?: TtscLintRuleSetting;

  /** Prefer `import type {}` when imports are types-only. */
  "consistent-type-imports"?: TtscLintRuleSetting;

  /** `(req, opt = 1, req2)` → fail. */
  "default-param-last"?: TtscLintRuleSetting;

  /**
   * Prefers dot property access when a string-literal key is a valid
   * identifier.
   */
  "dot-notation"?: TtscLintRuleSetting;

  /** Requires strict equality operators. */
  eqeqeq?: TtscLintRuleSetting;

  /** `for (i = 0; i < 10; i--)` → fail. */
  "for-direction"?: TtscLintRuleSetting;

  /** Prefers function-property signatures over method shorthand signatures. */
  "method-signature-style"?: TtscLintRuleSetting;

  /** Rejects `alert`, `confirm`, and `prompt`. */
  "no-alert"?: TtscLintRuleSetting;

  /** Rejects `Array` constructor calls. */
  "no-array-constructor"?: TtscLintRuleSetting;

  /** Rejects `delete` on array elements. */
  "no-array-delete"?: TtscLintRuleSetting;

  /** Reject `new Promise(async (...) => ...)`. */
  "no-async-promise-executor"?: TtscLintRuleSetting;

  /** Rejects bitwise operators. */
  "no-bitwise"?: TtscLintRuleSetting;

  /** Rejects `arguments.caller` and `arguments.callee`. */
  "no-caller"?: TtscLintRuleSetting;

  /** Rejects lexical declarations directly inside `case` clauses. */
  "no-case-declarations"?: TtscLintRuleSetting;

  /** Rejects reassignment of class declarations. */
  "no-class-assign"?: TtscLintRuleSetting;

  /** Rejects comparisons against `-0`. */
  "no-compare-neg-zero"?: TtscLintRuleSetting;

  /** Rejects assignments inside conditions. */
  "no-cond-assign"?: TtscLintRuleSetting;

  /** Rejects confusing non-null assertions next to equality checks. */
  "no-confusing-non-null-assertion"?: TtscLintRuleSetting;

  /** Rejects `console` calls. */
  "no-console"?: TtscLintRuleSetting;

  /** Reject `while (true)` and other constant test expressions. */
  "no-constant-condition"?: TtscLintRuleSetting;

  /** Rejects `continue` statements. */
  "no-continue"?: TtscLintRuleSetting;

  /** Rejects control characters in regular expressions. */
  "no-control-regex"?: TtscLintRuleSetting;

  /** Reject `debugger`. */
  "no-debugger"?: TtscLintRuleSetting;

  /** Rejects deleting variables. */
  "no-delete-var"?: TtscLintRuleSetting;

  /** Function declared with two parameters of the same name. */
  "no-dupe-args"?: TtscLintRuleSetting;

  /** `if (a) ... else if (a) ...`. */
  "no-dupe-else-if"?: TtscLintRuleSetting;

  /** `{ a: 1, a: 2 }`. */
  "no-dupe-keys"?: TtscLintRuleSetting;

  /** Same case label twice in a `switch`. */
  "no-duplicate-case"?: TtscLintRuleSetting;

  /** Rejects duplicate enum member values. */
  "no-duplicate-enum-values"?: TtscLintRuleSetting;

  /** Rejects `delete` on dynamically computed property keys. */
  "no-dynamic-delete"?: TtscLintRuleSetting;

  /** Reject `if (x) {}`, `while (x) {}`, etc. */
  "no-empty"?: TtscLintRuleSetting;

  /** Rejects empty regex character classes. */
  "no-empty-character-class"?: TtscLintRuleSetting;

  /** Reject `function f() {}`. */
  "no-empty-function"?: TtscLintRuleSetting;

  /** Rejects empty interfaces. */
  "no-empty-interface"?: TtscLintRuleSetting;

  /** Rejects empty object type literals. */
  "no-empty-object-type"?: TtscLintRuleSetting;

  /** Rejects empty destructuring patterns. */
  "no-empty-pattern"?: TtscLintRuleSetting;

  /** Rejects empty class static blocks. */
  "no-empty-static-block"?: TtscLintRuleSetting;

  /** Rejects loose null comparisons. */
  "no-eq-null"?: TtscLintRuleSetting;

  /** Rejects `eval`. */
  "no-eval"?: TtscLintRuleSetting;

  /** Rejects reassignment of caught exceptions. */
  "no-ex-assign"?: TtscLintRuleSetting;

  /** Reject `any` annotations. Typically `"warning"` during migrations. */
  "no-explicit-any"?: TtscLintRuleSetting;

  /** Rejects unnecessary `.bind()` calls. */
  "no-extra-bind"?: TtscLintRuleSetting;

  /** Rejects redundant boolean casts. */
  "no-extra-boolean-cast"?: TtscLintRuleSetting;

  /** Reject `x!!`. Autofixable. */
  "no-extra-non-null-assertion"?: TtscLintRuleSetting;

  /** Reject `switch` case fall-through without an explicit comment. */
  "no-fallthrough"?: TtscLintRuleSetting;

  /** Rejects reassignment of function declarations. */
  "no-func-assign"?: TtscLintRuleSetting;

  /** Hoist inline `type` modifiers into a single `import type {}`. Autofixable. */
  "no-import-type-side-effects"?: TtscLintRuleSetting;

  /** Rejects type annotations TypeScript can infer. */
  "no-inferrable-types"?: TtscLintRuleSetting;

  /** Rejects function declarations nested in blocks. */
  "no-inner-declarations"?: TtscLintRuleSetting;

  /** Rejects irregular whitespace. */
  "no-irregular-whitespace"?: TtscLintRuleSetting;

  /** Rejects `__iterator__`. */
  "no-iterator"?: TtscLintRuleSetting;

  /** Rejects labels. */
  "no-labels"?: TtscLintRuleSetting;

  /** Rejects unnecessary standalone blocks. */
  "no-lone-blocks"?: TtscLintRuleSetting;

  /** Rejects `if` as the only statement in an `else`. */
  "no-lonely-if"?: TtscLintRuleSetting;

  /**
   * Reject decimal integer literals whose source text cannot round-trip as a
   * JavaScript Number, including overflow-scale values.
   */
  "no-loss-of-precision"?: TtscLintRuleSetting;

  /** Rejects misleading regex character classes. */
  "no-misleading-character-class"?: TtscLintRuleSetting;

  /** Rejects constructor-like signatures in interfaces. */
  "no-misused-new"?: TtscLintRuleSetting;

  /** Rejects enums that mix numeric and string members. */
  "no-mixed-enums"?: TtscLintRuleSetting;

  /** Reject `a = b = 0` chains. */
  "no-multi-assign"?: TtscLintRuleSetting;

  /** Rejects multiline string escapes. */
  "no-multi-str"?: TtscLintRuleSetting;

  /** Rejects non-ambient namespaces. */
  "no-namespace"?: TtscLintRuleSetting;

  /** Rejects negated conditions with an `else`. */
  "no-negated-condition"?: TtscLintRuleSetting;

  /** Rejects nested ternary expressions. */
  "no-nested-ternary"?: TtscLintRuleSetting;

  /** Rejects `new` expressions used only for side effects. */
  "no-new"?: TtscLintRuleSetting;

  /** Rejects `Function` constructors. */
  "no-new-func"?: TtscLintRuleSetting;

  /** Rejects primitive wrapper constructors. */
  "no-new-wrappers"?: TtscLintRuleSetting;

  /** Rejects non-null assertions next to `??`. */
  "no-non-null-asserted-nullish-coalescing"?: TtscLintRuleSetting;

  /** Rejects non-null assertions on optional chains. */
  "no-non-null-asserted-optional-chain"?: TtscLintRuleSetting;

  /** Rejects postfix non-null assertions. */
  "no-non-null-assertion"?: TtscLintRuleSetting;

  /** Rejects calling global objects as functions. */
  "no-obj-calls"?: TtscLintRuleSetting;

  /** Rejects `new Object()`. */
  "no-object-constructor"?: TtscLintRuleSetting;

  /** Reject octal literals. */
  "no-octal"?: TtscLintRuleSetting;

  /** Reject `\08`-style escapes. */
  "no-octal-escape"?: TtscLintRuleSetting;

  /** Rejects `++` and `--`. */
  "no-plusplus"?: TtscLintRuleSetting;

  /** Reject `return` inside a Promise executor. */
  "no-promise-executor-return"?: TtscLintRuleSetting;

  /** Reject `obj.__proto__`. */
  "no-proto"?: TtscLintRuleSetting;

  /**
   * Reject `obj.hasOwnProperty(...)`; use
   * `Object.prototype.hasOwnProperty.call`.
   */
  "no-prototype-builtins"?: TtscLintRuleSetting;

  /** Rejects repeated literal spaces in regexes. */
  "no-regex-spaces"?: TtscLintRuleSetting;

  /** Reject `require(...)` outside CommonJS modules. */
  "no-require-imports"?: TtscLintRuleSetting;

  /** Rejects assignments in `return`. */
  "no-return-assign"?: TtscLintRuleSetting;

  /** Rejects `javascript:` URLs. */
  "no-script-url"?: TtscLintRuleSetting;

  /** Reject `x = x`, including destructured forms. */
  "no-self-assign"?: TtscLintRuleSetting;

  /** Reject `x === x` and friends. */
  "no-self-compare"?: TtscLintRuleSetting;

  /** Rejects comma expressions. */
  "no-sequences"?: TtscLintRuleSetting;

  /** Rejects returned values from setters. */
  "no-setter-return"?: TtscLintRuleSetting;

  /** Rejects shadowing restricted globals. */
  "no-shadow-restricted-names"?: TtscLintRuleSetting;

  /** Rejects sparse arrays. */
  "no-sparse-arrays"?: TtscLintRuleSetting;

  /** Reject `${}` inside non-template strings (probably a bug). */
  "no-template-curly-in-string"?: TtscLintRuleSetting;

  /** Rejects aliasing `this` to locals. */
  "no-this-alias"?: TtscLintRuleSetting;

  /** `throw "boom"` → fail. Use `throw new Error(...)`. */
  "no-throw-literal"?: TtscLintRuleSetting;

  /** Rejects initializing to `undefined`. */
  "no-undef-init"?: TtscLintRuleSetting;

  /** Rejects constructor assignments already handled by parameter properties. */
  "no-unnecessary-parameter-property-assignment"?: TtscLintRuleSetting;

  /** Rejects the global `undefined` identifier. */
  "no-undefined"?: TtscLintRuleSetting;

  /** Reject `<T extends unknown>` and similar. Autofixable. */
  "no-unnecessary-type-constraint"?: TtscLintRuleSetting;

  /** Rejects redundant ternary expressions. */
  "no-unneeded-ternary"?: TtscLintRuleSetting;

  /** Rejects unsafe class/interface declaration merging. */
  "no-unsafe-declaration-merging"?: TtscLintRuleSetting;

  /** Reject `return` / `throw` inside a `finally`. */
  "no-unsafe-finally"?: TtscLintRuleSetting;

  /** Rejects the unsafe `Function` type. */
  "no-unsafe-function-type"?: TtscLintRuleSetting;

  /** Rejects unsafe negation before relational checks. */
  "no-unsafe-negation"?: TtscLintRuleSetting;

  /** Rejects expression statements with no effect. */
  "no-unused-expressions"?: TtscLintRuleSetting;

  /** Rejects labels that no `break` or `continue` targets. */
  "no-unused-labels"?: TtscLintRuleSetting;

  /** Rejects unnecessary `.call()` and `.apply()`. */
  "no-useless-call"?: TtscLintRuleSetting;

  /** Rejects catch blocks that only rethrow. */
  "no-useless-catch"?: TtscLintRuleSetting;

  /** Rejects unnecessary computed property keys. */
  "no-useless-computed-key"?: TtscLintRuleSetting;

  /** Rejects unnecessary string concatenation. */
  "no-useless-concat"?: TtscLintRuleSetting;

  /** Rejects empty constructors with no parameters. */
  "no-useless-constructor"?: TtscLintRuleSetting;

  /** Rejects redundant empty `export {}` declarations in module files. */
  "no-useless-empty-export"?: TtscLintRuleSetting;

  /** Reject `\.` and friends when not required. Autofixable. */
  "no-useless-escape"?: TtscLintRuleSetting;

  /** Reject `{ x: x }` in destructuring. Autofixable. */
  "no-useless-rename"?: TtscLintRuleSetting;

  /** Reject `var`. Use `let` or `const`. Autofixable. */
  "no-var"?: TtscLintRuleSetting;

  /** Reject `with (...)`. */
  "no-with"?: TtscLintRuleSetting;

  /**
   * Reject `String` / `Number` / `Boolean` / `Symbol` / `BigInt`. Autofixable.
   * `Object` stays detection-only.
   */
  "no-wrapper-object-types"?: TtscLintRuleSetting;

  /** Reject `{ foo: foo }`. Autofixable. */
  "object-shorthand"?: TtscLintRuleSetting;

  /** Prefers compound assignment operators. */
  "operator-assignment"?: TtscLintRuleSetting;

  /** Reject `as Literal` when `as const` would do. Autofixable. */
  "prefer-as-const"?: TtscLintRuleSetting;

  /**
   * When a `let` is never reassigned, demand `const`. Autofixable for single
   * declarations.
   */
  "prefer-const"?: TtscLintRuleSetting;

  /** Requires explicit enum member initializers. */
  "prefer-enum-initializers"?: TtscLintRuleSetting;

  /** Prefers `**` over `Math.pow`. */
  "prefer-exponentiation-operator"?: TtscLintRuleSetting;

  /** Prefer `for..of` when the index is unused. */
  "prefer-for-of"?: TtscLintRuleSetting;

  /** Prefers function type aliases over single-call interfaces. */
  "prefer-function-type"?: TtscLintRuleSetting;

  /** Prefers literal enum member initializers over computed expressions. */
  "prefer-literal-enum-member"?: TtscLintRuleSetting;

  /** Use `namespace` not `module`. Autofixable. */
  "prefer-namespace-keyword"?: TtscLintRuleSetting;

  /** Prefers spread arguments over `.apply`. */
  "prefer-spread"?: TtscLintRuleSetting;

  /** Prefers template literals over string concatenation. */
  "prefer-template"?: TtscLintRuleSetting;

  /** Requires a radix argument for `parseInt`. */
  radix?: TtscLintRuleSetting;

  /** Requires generator functions to contain `yield`. */
  "require-yield"?: TtscLintRuleSetting;

  /** Rejects triple-slash reference directives. */
  "triple-slash-reference"?: TtscLintRuleSetting;

  /** Requires `Number.isNaN`/`isNaN` for `NaN` checks. */
  "use-isnan"?: TtscLintRuleSetting;

  /** Restricts `typeof` comparisons to valid strings. */
  "valid-typeof"?: TtscLintRuleSetting;

  /** Requires `var` declarations at the top of their scope. */
  "vars-on-top"?: TtscLintRuleSetting;

  /** Rejects literal-first comparisons. */
  yoda?: TtscLintRuleSetting;
}

/** Architecture-boundary rules for TypeScript source imports. */
export interface ITtscLintBoundariesRules {
  /**
   * Enforce allowed dependency directions between configured source-path
   * element types.
   */
  "boundaries/element-types"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesElementTypesRuleOptions>;

  /**
   * Require cross-element imports to target the element's configured public
   * entry files.
   */
  "boundaries/entry-point"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesEntryPointRuleOptions>;

  /** Restrict external package imports by package/specifier pattern. */
  "boundaries/external"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesExternalRuleOptions>;

  /**
   * Reject imports of configured private files from outside their source-path
   * element.
   */
  "boundaries/no-private"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesNoPrivateRuleOptions>;

  /**
   * Reject relative imports whose resolved source file matches no configured
   * element.
   */
  "boundaries/no-unknown"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesNoUnknownRuleOptions>;
}

/** Cypress and Mocha-shaped test rules. */
export interface ITtscLintCypressRules {
  /** Requires a Cypress assertion before `cy.screenshot()`. */
  "cypress/assertion-before-screenshot"?: TtscLintRuleSetting;

  /** Prefers `.should()` over `.and()` when starting Cypress assertion chains. */
  "cypress/no-and"?: TtscLintRuleSetting;

  /** Rejects assigning the return value of Cypress commands. */
  "cypress/no-assigning-return-values"?: TtscLintRuleSetting;

  /** Rejects async `before` and `beforeEach` callbacks in Cypress specs. */
  "cypress/no-async-before"?: TtscLintRuleSetting;

  /** Rejects async Cypress test callbacks. */
  "cypress/no-async-tests"?: TtscLintRuleSetting;

  /** Rejects chained `.get()` calls. */
  "cypress/no-chained-get"?: TtscLintRuleSetting;

  /** Rejects `cy.debug()` and chained `.debug()` commands. */
  "cypress/no-debug"?: TtscLintRuleSetting;

  /** Rejects `{ force: true }` on Cypress action commands. */
  "cypress/no-force"?: TtscLintRuleSetting;

  /** Rejects `cy.pause()` and chained `.pause()` commands. */
  "cypress/no-pause"?: TtscLintRuleSetting;

  /** Rejects numeric `cy.wait(...)` sleeps. */
  "cypress/no-unnecessary-waiting"?: TtscLintRuleSetting;

  /** Rejects deprecated `cy.xpath()` selectors. */
  "cypress/no-xpath"?: TtscLintRuleSetting;

  /**
   * Requires `cy.get()` selectors to target `data-*` attributes when statically
   * known.
   */
  "cypress/require-data-selectors"?: TtscLintRuleSetting;

  /** Rejects chaining more commands after Cypress action commands. */
  "cypress/unsafe-to-chain-command"?: TtscLintRuleOptionsSetting<ITtscLintCypressUnsafeToChainCommandRuleOptions>;
}

/** Lint directive comment rules. */
export interface ITtscLintEslintCommentsRules {
  /**
   * Requires range `eslint-disable` directives to be paired with
   * `eslint-enable`.
   */
  "eslint-comments/disable-enable-pair"?: TtscLintRuleOptionsSetting<ITtscLintDisableEnablePairRuleOptions>;

  /**
   * Rejects bare `eslint-enable` comments that re-enable named disables at
   * once.
   */
  "eslint-comments/no-aggregating-enable"?: TtscLintRuleSetting;

  /** Rejects disable directives that repeat an already active disable. */
  "eslint-comments/no-duplicate-disable"?: TtscLintRuleSetting;

  /** Rejects disable directives for configured protected rules. */
  "eslint-comments/no-restricted-disable"?: TtscLintRuleOptionsSetting<ITtscLintNoRestrictedDisableRuleOptions>;

  /** Rejects disable directives with no explicit rule list. */
  "eslint-comments/no-unlimited-disable"?: TtscLintRuleSetting;

  /** Rejects disable directives that suppress no finding. */
  "eslint-comments/no-unused-disable"?: TtscLintRuleSetting;

  /** Rejects enable directives that do not re-enable anything. */
  "eslint-comments/no-unused-enable"?: TtscLintRuleSetting;

  /** Rejects inline lint directive comments. */
  "eslint-comments/no-use"?: TtscLintRuleOptionsSetting<ITtscLintNoUseRuleOptions>;

  /** Requires lint directive comments to include a `--` description. */
  "eslint-comments/require-description"?: TtscLintRuleSetting;
}

/** Functional-programming policy rules. */
export interface ITtscLintFunctionalRules {
  /**
   * Enforce functional parameter style: no rest args/`arguments`, and optional
   * parameter-count policy.
   */
  "functional/functional-parameters"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalParametersRuleOptions>;

  /** Reject property, element, array, Map, and Set mutation. */
  "functional/immutable-data"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalImmutableDataRuleOptions>;

  /** Reject abstract classes and class inheritance. */
  "functional/no-class-inheritance"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /** Reject class declarations and class expressions. */
  "functional/no-classes"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /** Reject `if` and `switch` statements. */
  "functional/no-conditional-statements"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoConditionalStatementsRuleOptions>;

  /** Reject expression statements that exist only for side effects. */
  "functional/no-expression-statements"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /** Reject `let` declarations. */
  "functional/no-let"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoLetRuleOptions>;

  /** Reject imperative loop statements. */
  "functional/no-loop-statements"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /**
   * Reject interfaces/type literals that mix property, method, call, and index
   * member kinds.
   */
  "functional/no-mixed-types"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoMixedTypesRuleOptions>;

  /** Reject `Promise.reject(...)`. */
  "functional/no-promise-reject"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /** Reject void returns and functions explicitly typed as `void`. */
  "functional/no-return-void"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoReturnVoidRuleOptions>;

  /** Reject `this` expressions. */
  "functional/no-this-expressions"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /** Reject `throw` statements. */
  "functional/no-throw-statements"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoThrowStatementsRuleOptions>;

  /** Reject `try/catch` and `try/finally` statements. */
  "functional/no-try-statements"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoTryStatementsRuleOptions>;

  /**
   * Require declared variable, parameter, and property types to be
   * readonly/immutable.
   */
  "functional/prefer-immutable-types"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalPreferImmutableTypesRuleOptions>;

  /** Prefer property signatures over method signatures. */
  "functional/prefer-property-signatures"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /** Prefer readonly array, tuple, collection, and property types. */
  "functional/prefer-readonly-type"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalPreferReadonlyTypeRuleOptions>;

  /** Reject trivial wrappers such as `x => f(x)`. */
  "functional/prefer-tacit"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalPreferTacitRuleOptions>;

  /** Enforce one readonly type spelling. */
  "functional/readonly-type"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalReadonlyTypeRuleOptions>;

  /** Enforce readonly/immutable type declarations by declaration-name policy. */
  "functional/type-declaration-immutability"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions>;
}

/** Jest test-source rules. */
export interface ITtscLintJestRules {
  /** Requires Jest tests to contain at least one assertion. */
  "jest/expect-expect"?: TtscLintRuleSetting;

  /** Limits assertion count in a Jest test body. */
  "jest/max-expects"?: TtscLintRuleSetting;

  /** Rejects expect calls under conditional branches in Jest tests. */
  "jest/no-conditional-expect"?: TtscLintRuleSetting;

  /** Rejects conditional logic in Jest test bodies. */
  "jest/no-conditional-in-test"?: TtscLintRuleSetting;

  /** Rejects skipped or disabled Jest tests. */
  "jest/no-disabled-tests"?: TtscLintRuleSetting;

  /** Rejects done callback parameters in Jest tests and hooks. */
  "jest/no-done-callback"?: TtscLintRuleSetting;

  /** Rejects duplicate Jest setup and teardown hooks. */
  "jest/no-duplicate-hooks"?: TtscLintRuleSetting;

  /** Rejects exports from Jest test files. */
  "jest/no-export"?: TtscLintRuleSetting;

  /** Rejects focused Jest tests. */
  "jest/no-focused-tests"?: TtscLintRuleSetting;

  /** Rejects Jest hooks. */
  "jest/no-hooks"?: TtscLintRuleSetting;

  /** Rejects duplicate Jest test and describe titles at the same suite level. */
  "jest/no-identical-title"?: TtscLintRuleSetting;

  /** Rejects expect calls outside Jest tests. */
  "jest/no-standalone-expect"?: TtscLintRuleSetting;

  /** Rejects xit, fit, and related Jest test prefix aliases. */
  "jest/no-test-prefixes"?: TtscLintRuleSetting;

  /** Rejects return statements from Jest tests. */
  "jest/no-test-return-statement"?: TtscLintRuleSetting;

  /** Prefers toHaveLength for length checks. */
  "jest/prefer-to-have-length"?: TtscLintRuleSetting;

  /** Requires a message on toThrow assertions. */
  "jest/require-to-throw-message"?: TtscLintRuleSetting;

  /** Validates Jest describe callbacks. */
  "jest/valid-describe-callback"?: TtscLintRuleSetting;

  /** Validates Jest expect call shape. */
  "jest/valid-expect"?: TtscLintRuleSetting;

  /** Validates Jest test and describe titles. */
  "jest/valid-title"?: TtscLintRuleSetting;
}

/** JSDoc comment lint rules. */
export interface ITtscLintJsdocRules {
  /** Rejects unknown JSDoc block tag names. */
  "jsdoc/check-tag-names"?: TtscLintRuleSetting;

  /** Validates closed-set JSDoc tag values such as `@access`. */
  "jsdoc/check-values"?: TtscLintRuleSetting;

  /** Rejects content on marker-only JSDoc tags such as `@async`. */
  "jsdoc/empty-tags"?: TtscLintRuleSetting;

  /** Rejects redundant JSDoc type braces in TypeScript source comments. */
  "jsdoc/no-types"?: TtscLintRuleSetting;

  /** Rejects `any` and `*` inside JSDoc type braces. */
  "jsdoc/reject-any-type"?: TtscLintRuleSetting;

  /** Rejects the unsafe `Function` type inside JSDoc type braces. */
  "jsdoc/reject-function-type"?: TtscLintRuleSetting;

  /** Requires JSDoc blocks to include block-level description text. */
  "jsdoc/require-description"?: TtscLintRuleSetting;

  /** Requires every `@param` tag with a name to include a description. */
  "jsdoc/require-param-description"?: TtscLintRuleSetting;

  /** Requires every `@param` tag to include a parameter name. */
  "jsdoc/require-param-name"?: TtscLintRuleSetting;

  /** Requires every `@property` tag with a name to include a description. */
  "jsdoc/require-property-description"?: TtscLintRuleSetting;

  /** Requires every `@property` tag to include a property name. */
  "jsdoc/require-property-name"?: TtscLintRuleSetting;

  /** Requires every `@returns` tag to include a description. */
  "jsdoc/require-returns-description"?: TtscLintRuleSetting;
}

/** JSX accessibility rules for TSX source. */
export interface ITtscLintJsxA11yRules {
  /** Requires image-like JSX elements to expose alt text or an ARIA label. */
  "jsx-a11y/alt-text"?: TtscLintRuleSetting;

  /** Rejects empty JSX anchors with no accessible content. */
  "jsx-a11y/anchor-has-content"?: TtscLintRuleSetting;

  /** Rejects missing, hash-only, empty, and javascript: anchor href values. */
  "jsx-a11y/anchor-is-valid"?: TtscLintRuleSetting;

  /** Requires tabIndex when aria-activedescendant is present. */
  "jsx-a11y/aria-activedescendant-has-tabindex"?: TtscLintRuleSetting;

  /** Rejects unknown aria-* JSX attributes. */
  "jsx-a11y/aria-props"?: TtscLintRuleSetting;

  /** Validates known literal ARIA property values. */
  "jsx-a11y/aria-proptypes"?: TtscLintRuleSetting;

  /** Rejects unknown ARIA role tokens. */
  "jsx-a11y/aria-role"?: TtscLintRuleSetting;

  /** Rejects ARIA roles and attributes on elements that cannot expose them. */
  "jsx-a11y/aria-unsupported-elements"?: TtscLintRuleSetting;

  /** Rejects unknown literal autocomplete tokens. */
  "jsx-a11y/autocomplete-valid"?: TtscLintRuleSetting;

  /**
   * Requires keyboard handlers alongside clicks on non-interactive JSX
   * elements.
   */
  "jsx-a11y/click-events-have-key-events"?: TtscLintRuleSetting;

  /** Requires interactive controls to have an accessible label. */
  "jsx-a11y/control-has-associated-label"?: TtscLintRuleSetting;

  /** Rejects empty JSX headings with no accessible content. */
  "jsx-a11y/heading-has-content"?: TtscLintRuleSetting;

  /** Requires JSX html elements to declare lang. */
  "jsx-a11y/html-has-lang"?: TtscLintRuleSetting;

  /** Requires iframes to have a non-empty title. */
  "jsx-a11y/iframe-has-title"?: TtscLintRuleSetting;

  /** Rejects redundant words such as image, photo, and picture in img alt text. */
  "jsx-a11y/img-redundant-alt"?: TtscLintRuleSetting;

  /** Requires elements with interactive roles to be focusable. */
  "jsx-a11y/interactive-supports-focus"?: TtscLintRuleSetting;

  /** Requires labels to reference or wrap a form control. */
  "jsx-a11y/label-has-associated-control"?: TtscLintRuleSetting;

  /** Compatibility alias for label association checks. */
  "jsx-a11y/label-has-for"?: TtscLintRuleSetting;

  /** Validates statically known lang attribute values. */
  "jsx-a11y/lang"?: TtscLintRuleSetting;

  /** Requires audio and video elements to provide caption tracks. */
  "jsx-a11y/media-has-caption"?: TtscLintRuleSetting;

  /** Requires mouseover/mouseout handlers to have focus/blur parity. */
  "jsx-a11y/mouse-events-have-key-events"?: TtscLintRuleSetting;

  /** Rejects accessKey on JSX elements. */
  "jsx-a11y/no-access-key"?: TtscLintRuleSetting;

  /** Rejects aria-hidden on focusable JSX elements. */
  "jsx-a11y/no-aria-hidden-on-focusable"?: TtscLintRuleSetting;

  /** Rejects autoFocus/autofocus JSX attributes. */
  "jsx-a11y/no-autofocus"?: TtscLintRuleSetting;

  /** Rejects distracting blink and marquee elements. */
  "jsx-a11y/no-distracting-elements"?: TtscLintRuleSetting;

  /** Rejects non-interactive roles on native interactive elements. */
  "jsx-a11y/no-interactive-element-to-noninteractive-role"?: TtscLintRuleSetting;

  /** Rejects interaction handlers on known non-interactive JSX elements. */
  "jsx-a11y/no-noninteractive-element-interactions"?: TtscLintRuleSetting;

  /** Rejects interactive roles on known non-interactive JSX elements. */
  "jsx-a11y/no-noninteractive-element-to-interactive-role"?: TtscLintRuleSetting;

  /** Rejects tabIndex on non-interactive JSX elements. */
  "jsx-a11y/no-noninteractive-tabindex"?: TtscLintRuleSetting;

  /** Rejects explicit roles that duplicate native JSX element semantics. */
  "jsx-a11y/no-redundant-roles"?: TtscLintRuleSetting;

  /** Requires static elements with interaction handlers to declare a role. */
  "jsx-a11y/no-static-element-interactions"?: TtscLintRuleSetting;

  /** Prefers native JSX tags over div/span plus an equivalent role. */
  "jsx-a11y/prefer-tag-over-role"?: TtscLintRuleSetting;

  /** Requires ARIA properties mandated by the element role. */
  "jsx-a11y/role-has-required-aria-props"?: TtscLintRuleSetting;

  /** Rejects ARIA properties unsupported by the element role. */
  "jsx-a11y/role-supports-aria-props"?: TtscLintRuleSetting;

  /** Restricts scope to table header cells. */
  "jsx-a11y/scope"?: TtscLintRuleSetting;

  /** Rejects positive tabIndex values. */
  "jsx-a11y/tabindex-no-positive"?: TtscLintRuleSetting;
}

/** Next.js TS/TSX source rules. */
export interface ITtscLintNextjsRules {
  /** Requires a supported `display` query on Google Fonts stylesheet links. */
  "nextjs/google-font-display"?: TtscLintRuleSetting;

  /** Requires `rel="preconnect"` for fonts.gstatic.com links. */
  "nextjs/google-font-preconnect"?: TtscLintRuleSetting;

  /** Requires an `id` on inline `next/script` blocks. */
  "nextjs/inline-script-id"?: TtscLintRuleSetting;

  /** Prefers Next.js Google Analytics helpers over handwritten gtag scripts. */
  "nextjs/next-script-for-ga"?: TtscLintRuleSetting;

  /** Rejects local declarations named `module`. */
  "nextjs/no-assign-module-variable"?: TtscLintRuleSetting;

  /** Rejects async React client components. */
  "nextjs/no-async-client-component"?: TtscLintRuleSetting;

  /** Restricts `beforeInteractive` scripts to pages/_document. */
  "nextjs/no-before-interactive-script-outside-document"?: TtscLintRuleSetting;

  /** Rejects raw stylesheet `<link>` tags. */
  "nextjs/no-css-tags"?: TtscLintRuleSetting;

  /** Restricts `next/document` imports to pages/_document. */
  "nextjs/no-document-import-in-page"?: TtscLintRuleSetting;

  /** Rejects multiple `Head` elements from `next/document` in pages/_document. */
  "nextjs/no-duplicate-head"?: TtscLintRuleSetting;

  /** Rejects raw `<head>` elements outside the app directory. */
  "nextjs/no-head-element"?: TtscLintRuleSetting;

  /** Rejects `next/head` imports inside pages/_document. */
  "nextjs/no-head-import-in-document"?: TtscLintRuleSetting;

  /** Prefers `next/link` for static internal anchor hrefs. */
  "nextjs/no-html-link-for-pages"?: TtscLintRuleSetting;

  /** Prefers `next/image` over raw `<img>` elements. */
  "nextjs/no-img-element"?: TtscLintRuleSetting;

  /** Rejects Google font links in regular pages files. */
  "nextjs/no-page-custom-font"?: TtscLintRuleSetting;

  /** Rejects `next/script` inside `next/head`. */
  "nextjs/no-script-component-in-head"?: TtscLintRuleSetting;

  /** Rejects styled-jsx tags inside pages/_document. */
  "nextjs/no-styled-jsx-in-document"?: TtscLintRuleSetting;

  /** Requires `async` or `defer` on external raw script tags. */
  "nextjs/no-sync-scripts"?: TtscLintRuleSetting;

  /** Rejects `<title>` inside `Head` from `next/document`. */
  "nextjs/no-title-in-document-head"?: TtscLintRuleSetting;

  /** Catches one-edit typos in Next.js data-fetching export names. */
  "nextjs/no-typos"?: TtscLintRuleSetting;

  /** Rejects Polyfill.io script URLs. */
  "nextjs/no-unwanted-polyfillio"?: TtscLintRuleSetting;
}

/** Playwright test-source rules. */
export interface ITtscLintPlaywrightRules {
  /** Requires Playwright tests to contain at least one assertion. */
  "playwright/expect-expect"?: TtscLintRuleSetting;

  /** Limits assertion count in a Playwright test body. */
  "playwright/max-expects"?: TtscLintRuleSetting;

  /** Rejects expect calls under conditional branches in Playwright tests. */
  "playwright/no-conditional-expect"?: TtscLintRuleSetting;

  /** Rejects conditional logic in Playwright test bodies. */
  "playwright/no-conditional-in-test"?: TtscLintRuleSetting;

  /** Rejects duplicate Playwright setup and teardown hooks. */
  "playwright/no-duplicate-hooks"?: TtscLintRuleSetting;

  /** Rejects repeated test.slow calls inside the same Playwright test. */
  "playwright/no-duplicate-slow"?: TtscLintRuleSetting;

  /** Rejects ElementHandle-style Playwright APIs. */
  "playwright/no-element-handle"?: TtscLintRuleSetting;

  /** Rejects page.$eval and page.$$eval. */
  "playwright/no-eval"?: TtscLintRuleSetting;

  /** Rejects focused Playwright tests. */
  "playwright/no-focused-test"?: TtscLintRuleSetting;

  /** Rejects Playwright force options. */
  "playwright/no-force-option"?: TtscLintRuleSetting;

  /** Rejects getByTitle locators. */
  "playwright/no-get-by-title"?: TtscLintRuleSetting;

  /** Rejects Playwright hooks. */
  "playwright/no-hooks"?: TtscLintRuleSetting;

  /** Rejects nested test.step calls. */
  "playwright/no-nested-step"?: TtscLintRuleSetting;

  /** Rejects networkidle load state and waitUntil options. */
  "playwright/no-networkidle"?: TtscLintRuleSetting;

  /** Rejects first, last, and nth locator methods. */
  "playwright/no-nth-methods"?: TtscLintRuleSetting;

  /** Rejects page.pause debugging calls. */
  "playwright/no-page-pause"?: TtscLintRuleSetting;

  /** Rejects skipped Playwright tests. */
  "playwright/no-skipped-test"?: TtscLintRuleSetting;

  /** Rejects slowed Playwright tests. */
  "playwright/no-slowed-test"?: TtscLintRuleSetting;

  /** Rejects expect calls outside Playwright test blocks. */
  "playwright/no-standalone-expect"?: TtscLintRuleSetting;

  /** Rejects page.waitForNavigation calls. */
  "playwright/no-wait-for-navigation"?: TtscLintRuleSetting;

  /** Rejects page.waitForSelector calls. */
  "playwright/no-wait-for-selector"?: TtscLintRuleSetting;

  /** Rejects page.waitForTimeout calls. */
  "playwright/no-wait-for-timeout"?: TtscLintRuleSetting;

  /** Prefers locator-based Playwright APIs over page methods. */
  "playwright/prefer-locator"?: TtscLintRuleSetting;

  /** Prefers toHaveCount for awaited count checks. */
  "playwright/prefer-to-have-count"?: TtscLintRuleSetting;

  /** Prefers toHaveLength for awaited length checks. */
  "playwright/prefer-to-have-length"?: TtscLintRuleSetting;

  /** Prefers Playwright web-first assertions. */
  "playwright/prefer-web-first-assertions"?: TtscLintRuleSetting;

  /** Requires timeout options on toPass assertions. */
  "playwright/require-to-pass-timeout"?: TtscLintRuleSetting;

  /** Requires a message on toThrow assertions. */
  "playwright/require-to-throw-message"?: TtscLintRuleSetting;

  /** Validates Playwright describe callbacks. */
  "playwright/valid-describe-callback"?: TtscLintRuleSetting;

  /** Validates Playwright expect call arity. */
  "playwright/valid-expect"?: TtscLintRuleSetting;

  /** Validates Playwright test and describe titles. */
  "playwright/valid-title"?: TtscLintRuleSetting;
}

/** Promise correctness and style rules. */
export interface ITtscLintPromiseRules {
  /** Requires every `then()` callback to return or throw. */
  "promise/always-return"?: TtscLintRuleSetting;

  /** Discourages direct `new Promise(...)` construction outside adapters. */
  "promise/avoid-new"?: TtscLintRuleSetting;

  /** Requires unreturned promise chains to end with `catch()`. */
  "promise/catch-or-return"?: TtscLintRuleSetting;

  /** Rejects callback invocations inside `then()`/`catch()` handlers. */
  "promise/no-callback-in-promise"?: TtscLintRuleSetting;

  /** Detects Promise executors that resolve or reject more than once. */
  "promise/no-multiple-resolved"?: TtscLintRuleSetting;

  /** Rejects implicit use of the native global `Promise`. */
  "promise/no-native"?: TtscLintRuleSetting;

  /** Rejects nested `then()`/`catch()` calls inside promise callbacks. */
  "promise/no-nesting"?: TtscLintRuleSetting;

  /** Rejects `new Promise.resolve()` and other constructed Promise statics. */
  "promise/no-new-statics"?: TtscLintRuleSetting;

  /** Rejects promise chains inside error-first callbacks. */
  "promise/no-promise-in-callback"?: TtscLintRuleSetting;

  /** Rejects returning a value from a promise `finally()` callback. */
  "promise/no-return-in-finally"?: TtscLintRuleSetting;

  /**
   * Rejects `return Promise.resolve(...)` and `Promise.reject(...)` from
   * promise callbacks.
   */
  "promise/no-return-wrap"?: TtscLintRuleSetting;

  /** Enforces `resolve`/`reject` executor parameter names. */
  "promise/param-names"?: TtscLintRuleSetting;

  /** Prefers async/await to callback-shaped APIs. */
  "promise/prefer-await-to-callbacks"?: TtscLintRuleSetting;

  /** Prefers `await` over `then()`/`catch()`/`finally()` chains. */
  "promise/prefer-await-to-then"?: TtscLintRuleSetting;

  /** Prefers `catch()` over the second argument to `then()`. */
  "promise/prefer-catch"?: TtscLintRuleSetting;

  /** Rejects non-standard `Promise` static and prototype methods. */
  "promise/spec-only"?: TtscLintRuleSetting;

  /** Enforces argument counts for Promise statics and chain methods. */
  "promise/valid-params"?: TtscLintRuleSetting;
}

/** React TSX rules. */
export interface ITtscLintReactRules {
  /** Requires explicit valid `type` values on JSX `button` elements. */
  "react/button-has-type"?: TtscLintRuleSetting;

  /** Requires JSX `iframe` elements to include a sandbox attribute. */
  "react/iframe-missing-sandbox"?: TtscLintRuleSetting;

  /** Requires `key` props for JSX elements produced by arrays or `.map()`. */
  "react/jsx-key"?: TtscLintRuleSetting;

  /** Rejects duplicate JSX prop names on the same element. */
  "react/jsx-no-duplicate-props"?: TtscLintRuleSetting;

  /** Rejects `javascript:` URLs in JSX URL-like props. */
  "react/jsx-no-script-url"?: TtscLintRuleSetting;

  /** Rejects `key={index}` in JSX lists. */
  "react/no-array-index-key"?: TtscLintRuleSetting;

  /** Rejects passing children through a JSX `children` prop. */
  "react/no-children-prop"?: TtscLintRuleSetting;

  /** Rejects `dangerouslySetInnerHTML`. */
  "react/no-danger"?: TtscLintRuleSetting;

  /** Rejects combining `dangerouslySetInnerHTML` with children. */
  "react/no-danger-with-children"?: TtscLintRuleSetting;

  /** Rejects direct writes to `this.state` outside constructor initialization. */
  "react/no-direct-mutation-state"?: TtscLintRuleSetting;

  /** Rejects `findDOMNode` calls. */
  "react/no-find-dom-node"?: TtscLintRuleSetting;

  /** Rejects `isMounted` calls. */
  "react/no-is-mounted"?: TtscLintRuleSetting;

  /** Rejects string JSX refs. */
  "react/no-string-refs"?: TtscLintRuleSetting;

  /** Rejects unescaped `>`, `"`, `'`, and `}` in JSX text. */
  "react/no-unescaped-entities"?: TtscLintRuleSetting;

  /** Rejects string literal JSX `style` prop values. */
  "react/style-prop-object"?: TtscLintRuleSetting;

  /** Rejects children and HTML injection props on void DOM elements. */
  "react/void-dom-elements-no-children"?: TtscLintRuleSetting;
}

/** React Hooks rules. */
export interface ITtscLintReactHooksRules {
  /** Enforces the Rules of Hooks in components and custom Hooks. */
  "react-hooks/rules-of-hooks"?: TtscLintRuleSetting;

  /** Checks high-confidence missing identifiers in React Hook dependency arrays. */
  "react-hooks/exhaustive-deps"?: TtscLintRuleSetting;

  /** Rejects nested component/Hook factories with local Hook calls. */
  "react-hooks/component-hook-factories"?: TtscLintRuleSetting;

  /** Rejects local prop mutations in React components and Hooks. */
  "react-hooks/immutability"?: TtscLintRuleSetting;

  /** Rejects reading or writing `ref.current` during render. */
  "react-hooks/refs"?: TtscLintRuleSetting;

  /** Rejects synchronous state setter calls inside effects. */
  "react-hooks/set-state-in-effect"?: TtscLintRuleSetting;

  /** Rejects state setter calls during render. */
  "react-hooks/set-state-in-render"?: TtscLintRuleSetting;

  /** Rejects block-bodied `useMemo` callbacks that do not return a value. */
  "react-hooks/use-memo"?: TtscLintRuleSetting;
}

/** React JSX performance rules. */
export interface ITtscLintReactPerfRules {
  /** Rejects freshly-created arrays passed as JSX props in TSX files. */
  "react-perf/jsx-no-new-array-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /** Rejects freshly-created functions passed as JSX props in TSX files. */
  "react-perf/jsx-no-new-function-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /** Rejects freshly-created objects passed as JSX props in TSX files. */
  "react-perf/jsx-no-new-object-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /**
   * Rejects freshly-created JSX elements/fragments passed as JSX props in TSX
   * files.
   */
  "react-perf/jsx-no-jsx-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;
}

/** React Fast Refresh rules. */
export interface ITtscLintReactRefreshRules {
  /** Keeps React Fast Refresh component modules from exporting non-components. */
  "react-refresh/only-export-components"?: TtscLintRuleOptionsSetting<ITtscLintReactRefreshOnlyExportComponentsRuleOptions>;
}

/** Regular-expression rules. */
export interface ITtscLintRegexpRules {
  /**
   * Rejects control characters in regular expression literals. Alias of the
   * bare regex check.
   */
  "regexp/no-control-character"?: TtscLintRuleSetting;

  /** Rejects duplicate literal characters inside simple regex character classes. */
  "regexp/no-dupe-characters-character-class"?: TtscLintRuleSetting;

  /** Rejects empty alternatives such as `/a||b/`. */
  "regexp/no-empty-alternative"?: TtscLintRuleSetting;

  /** Rejects empty capturing groups such as `/()/`. */
  "regexp/no-empty-capturing-group"?: TtscLintRuleSetting;

  /** Rejects empty regex character classes. Alias of `no-empty-character-class`. */
  "regexp/no-empty-character-class"?: TtscLintRuleSetting;

  /** Rejects empty non-capturing groups such as `/(?:)/`. */
  "regexp/no-empty-group"?: TtscLintRuleSetting;

  /** Rejects empty lookaround assertions such as `/(?=)/`. */
  "regexp/no-empty-lookarounds-assertion"?: TtscLintRuleSetting;

  /**
   * Rejects misleading Unicode characters in regex classes. Alias of the bare
   * misleading-character check.
   */
  "regexp/no-misleading-unicode-character"?: TtscLintRuleSetting;

  /** Rejects single literal character classes such as `/[x]/`. */
  "regexp/no-useless-character-class"?: TtscLintRuleSetting;

  /**
   * Rejects unnecessary regex escapes. Alias of `no-useless-escape` for regex
   * literals.
   */
  "regexp/no-useless-escape"?: TtscLintRuleSetting;

  /** Rejects flags that do not affect the regex literal. */
  "regexp/no-useless-flag"?: TtscLintRuleSetting;

  /** Rejects exact-one quantifiers such as `/a{1}/`. */
  "regexp/no-useless-quantifier"?: TtscLintRuleSetting;

  /** Rejects equal min/max quantifiers such as `/a{2,2}/`. */
  "regexp/no-useless-two-nums-quantifier"?: TtscLintRuleSetting;

  /** Rejects zero-repeat quantifiers such as `/a{0}/`. */
  "regexp/no-zero-quantifier"?: TtscLintRuleSetting;

  /** Prefers `\d` over `[0-9]` in regex literals. */
  "regexp/prefer-d"?: TtscLintRuleSetting;

  /** Prefers `+` over `{1,}` in regex literals. */
  "regexp/prefer-plus-quantifier"?: TtscLintRuleSetting;

  /** Prefers `?` over `{0,1}` in regex literals. */
  "regexp/prefer-question-quantifier"?: TtscLintRuleSetting;

  /** Prefers `*` over `{0,}` in regex literals. */
  "regexp/prefer-star-quantifier"?: TtscLintRuleSetting;

  /** Prefers `\w` over `[A-Za-z0-9_]` in regex literals. */
  "regexp/prefer-w"?: TtscLintRuleSetting;

  /** Requires regex literals to use the `u` or `v` flag. */
  "regexp/require-unicode-regexp"?: TtscLintRuleSetting;

  /** Requires regex literals to use the `v` flag. */
  "regexp/require-unicode-sets-regexp"?: TtscLintRuleSetting;

  /** Requires regex flags to follow canonical order. */
  "regexp/sort-flags"?: TtscLintRuleSetting;
}

/** Security-focused TypeScript source rules. */
export interface ITtscLintSecurityRules {
  /** Detects Trojan Source bidi control characters. */
  "security/detect-bidi-characters"?: TtscLintRuleSetting;

  /** Detects Buffer reads/writes with `noAssert` set to true. */
  "security/detect-buffer-noassert"?: TtscLintRuleSetting;

  /** Detects child_process imports and non-literal exec commands. */
  "security/detect-child-process"?: TtscLintRuleSetting;

  /** Detects disabling mustache-style escaping through `escapeMarkup = false`. */
  "security/detect-disable-mustache-escape"?: TtscLintRuleSetting;

  /** Detects `eval` calls fed by non-literal expressions. */
  "security/detect-eval-with-expression"?: TtscLintRuleSetting;

  /** Detects `new Buffer` with non-literal input. */
  "security/detect-new-buffer"?: TtscLintRuleSetting;

  /** Detects Express csrf middleware configured before methodOverride. */
  "security/detect-no-csrf-before-method-override"?: TtscLintRuleSetting;

  /** Detects filesystem calls with non-literal filename arguments. */
  "security/detect-non-literal-fs-filename"?: TtscLintRuleSetting;

  /** Detects RegExp construction from non-literal patterns. */
  "security/detect-non-literal-regexp"?: TtscLintRuleSetting;

  /** Detects `require` calls with non-literal module specifiers. */
  "security/detect-non-literal-require"?: TtscLintRuleSetting;

  /** Detects dynamic bracket access that can hide object injection sinks. */
  "security/detect-object-injection"?: TtscLintRuleSetting;

  /** Detects direct equality comparisons involving secret-like identifiers. */
  "security/detect-possible-timing-attacks"?: TtscLintRuleSetting;

  /** Detects use of `crypto.pseudoRandomBytes`. */
  "security/detect-pseudoRandomBytes"?: TtscLintRuleSetting;

  /**
   * Detects regular expressions with high-confidence catastrophic backtracking
   * shapes.
   */
  "security/detect-unsafe-regex"?: TtscLintRuleSetting;
}

/** Solid TSX rules. */
export interface ITtscLintSolidRules {
  /** Reject early and conditional returns from Solid components. */
  "solid/components-return-once"?: TtscLintRuleSetting;

  /** Enforce Solid DOM event handler naming. */
  "solid/event-handlers"?: TtscLintRuleSetting;

  /**
   * Enforce canonical imports from `solid-js`, `solid-js/web`, and
   * `solid-js/store`.
   */
  "solid/imports"?: TtscLintRuleSetting;

  /** Reject duplicate JSX props. */
  "solid/jsx-no-duplicate-props"?: TtscLintRuleSetting;

  /** Reject `javascript:` URLs in JSX attributes. */
  "solid/jsx-no-script-url"?: TtscLintRuleSetting;

  /** Reject JSX component names that are not declared or imported. */
  "solid/jsx-no-undef"?: TtscLintRuleSetting;

  /** Scope-marker compatibility rule; the native engine emits no diagnostics. */
  "solid/jsx-uses-vars"?: TtscLintRuleSetting;

  /** Reject array values passed as Solid event handlers. */
  "solid/no-array-handlers"?: TtscLintRuleSetting;

  /** Reject destructured component props. */
  "solid/no-destructure"?: TtscLintRuleSetting;

  /** Reject `innerHTML` and `dangerouslySetInnerHTML`. */
  "solid/no-innerhtml"?: TtscLintRuleSetting;

  /** Reject Proxy-backed Solid APIs for proxy-free targets. */
  "solid/no-proxy-apis"?: TtscLintRuleSetting;

  /** Reject React-style dependency arrays in Solid tracked scopes. */
  "solid/no-react-deps"?: TtscLintRuleSetting;

  /** Reject React-specific JSX props such as `className` and `htmlFor`. */
  "solid/no-react-specific-props"?: TtscLintRuleSetting;

  /** Reject unknown or component-level JSX namespaces. */
  "solid/no-unknown-namespaces"?: TtscLintRuleSetting;

  /** Prefer Solid `classList` over classnames helpers. */
  "solid/prefer-classlist"?: TtscLintRuleSetting;

  /** Prefer `<For>` over array `.map()` inside JSX. */
  "solid/prefer-for"?: TtscLintRuleSetting;

  /** Prefer `<Show>` over conditional JSX expressions. */
  "solid/prefer-show"?: TtscLintRuleSetting;

  /** Reject common Solid reactivity breakages. */
  "solid/reactivity"?: TtscLintRuleSetting;

  /** Reject empty non-self-closing JSX elements. */
  "solid/self-closing-comp"?: TtscLintRuleSetting;

  /** Enforce Solid style prop object and kebab-case conventions. */
  "solid/style-prop"?: TtscLintRuleSetting;
}

/** Storybook CSF and config rules. */
export interface ITtscLintStorybookRules {
  /** Requires awaited Storybook interaction helpers in play functions. */
  "storybook/await-interactions"?: TtscLintRuleSetting;

  /** Requires forwarding context when composing another story's play function. */
  "storybook/context-in-play-function"?: TtscLintRuleSetting;

  /** Requires CSF default meta to declare a component. */
  "storybook/csf-component"?: TtscLintRuleSetting;

  /** Requires story files to export default CSF metadata. */
  "storybook/default-exports"?: TtscLintRuleSetting;

  /** Rejects deprecated `|` separators in Storybook title metadata. */
  "storybook/hierarchy-separator"?: TtscLintRuleSetting;

  /** Requires statically inline `title` and `args` meta properties. */
  "storybook/meta-inline-properties"?: TtscLintRuleSetting;

  /** Requires CSF meta objects to use TypeScript `satisfies`. */
  "storybook/meta-satisfies-type"?: TtscLintRuleSetting;

  /** Rejects story name metadata that duplicates the export-derived name. */
  "storybook/no-redundant-story-name"?: TtscLintRuleSetting;

  /** Rejects direct imports from Storybook renderer packages. */
  "storybook/no-renderer-packages"?: TtscLintRuleSetting;

  /** Rejects deprecated `storiesOf` usage. */
  "storybook/no-stories-of"?: TtscLintRuleSetting;

  /** Rejects explicit `title` in CSF strict meta. */
  "storybook/no-title-property-in-meta"?: TtscLintRuleSetting;

  /** Validates Storybook addon names against package dependencies. */
  "storybook/no-uninstalled-addons"?: TtscLintRuleOptionsSetting<ITtscLintStorybookNoUninstalledAddonsRuleOptions>;

  /** Requires PascalCase named story exports. */
  "storybook/prefer-pascal-case"?: TtscLintRuleSetting;

  /** Requires at least one usable named story export. */
  "storybook/story-exports"?: TtscLintRuleSetting;

  /** Requires Storybook's expect helper in play assertions. */
  "storybook/use-storybook-expect"?: TtscLintRuleSetting;

  /** Rejects direct Testing Library imports in story files. */
  "storybook/use-storybook-testing-library"?: TtscLintRuleSetting;
}

/** TanStack Query rules. */
export interface ITtscLintTanstackQueryRules {
  /** Requires TanStack Query keys to include variables read by queryFn. */
  "@tanstack/query/exhaustive-deps"?: TtscLintRuleSetting;

  /** Requires infinite query page-param callbacks to appear after queryFn. */
  "@tanstack/query/infinite-query-property-order"?: TtscLintRuleSetting;

  /**
   * Requires mutation lifecycle callbacks to keep onMutate before error/settled
   * handlers.
   */
  "@tanstack/query/mutation-property-order"?: TtscLintRuleSetting;

  /** Rejects object rest destructuring over TanStack Query hook results. */
  "@tanstack/query/no-rest-destructuring"?: TtscLintRuleSetting;

  /**
   * Rejects passing whole TanStack Query hook results to React dependency
   * arrays.
   */
  "@tanstack/query/no-unstable-deps"?: TtscLintRuleSetting;

  /** Rejects queryFn callbacks that return no data in AST-local cases. */
  "@tanstack/query/no-void-query-fn"?: TtscLintRuleSetting;

  /**
   * Prefers extracted TanStack Query options over inline queryKey/queryFn
   * objects.
   */
  "@tanstack/query/prefer-query-options"?: TtscLintRuleSetting;

  /** Rejects creating QueryClient inside React component or hook bodies. */
  "@tanstack/query/stable-query-client"?: TtscLintRuleSetting;
}

/** Testing Library test-source rules. */
export interface ITtscLintTestingLibraryRules {
  /** Require awaiting async user-event methods. */
  "testing-library/await-async-events"?: TtscLintRuleSetting;

  /** Require awaiting `findBy*` and `findAllBy*` queries. */
  "testing-library/await-async-queries"?: TtscLintRuleSetting;

  /** Require awaiting `waitFor` and other async Testing Library utilities. */
  "testing-library/await-async-utils"?: TtscLintRuleSetting;

  /** Validate configured JSX test-id attribute values. */
  "testing-library/consistent-data-testid"?: TtscLintRuleOptionsSetting<ITtscLintTestingLibraryConsistentDataTestIdRuleOptions>;

  /** Reject unnecessary `await` before synchronous event helpers. */
  "testing-library/no-await-sync-events"?: TtscLintRuleSetting;

  /** Reject unnecessary `await` before synchronous queries. */
  "testing-library/no-await-sync-queries"?: TtscLintRuleSetting;

  /** Reject `container` destructuring and DOM query methods. */
  "testing-library/no-container"?: TtscLintRuleSetting;

  /** Reject `debug`, `prettyDOM`, and related debugging utilities. */
  "testing-library/no-debugging-utils"?: TtscLintRuleSetting;

  /** Reject direct `@testing-library/dom` imports in framework tests. */
  "testing-library/no-dom-import"?: TtscLintRuleSetting;

  /** Reject global RegExp flags in query text matchers. */
  "testing-library/no-global-regexp-flag-in-query"?: TtscLintRuleSetting;

  /** Reject manual `cleanup()` calls. */
  "testing-library/no-manual-cleanup"?: TtscLintRuleSetting;

  /** Reject direct DOM node traversal from query results. */
  "testing-library/no-node-access"?: TtscLintRuleSetting;

  /** Reject Promise-producing expressions passed to `fireEvent`. */
  "testing-library/no-promise-in-fire-event"?: TtscLintRuleSetting;

  /** Reject `render()` inside lifecycle hooks. */
  "testing-library/no-render-in-lifecycle"?: TtscLintRuleSetting;

  /** Reject `*ByTestId` queries. */
  "testing-library/no-test-id-queries"?: TtscLintRuleSetting;

  /** Reject `act()` wrappers around Testing Library helpers. */
  "testing-library/no-unnecessary-act"?: TtscLintRuleSetting;

  /** Reject multiple assertions inside one `waitFor`. */
  "testing-library/no-wait-for-multiple-assertions"?: TtscLintRuleSetting;

  /** Reject side effects inside `waitFor`. */
  "testing-library/no-wait-for-side-effects"?: TtscLintRuleSetting;

  /** Reject snapshots inside `waitFor`. */
  "testing-library/no-wait-for-snapshot"?: TtscLintRuleSetting;

  /** Require explicit assertions for standalone queries. */
  "testing-library/prefer-explicit-assert"?: TtscLintRuleSetting;

  /** Prefer `findBy*` over `waitFor` plus `getBy*`. */
  "testing-library/prefer-find-by"?: TtscLintRuleSetting;

  /** Avoid redundant `toBeInTheDocument` around throwing queries. */
  "testing-library/prefer-implicit-assert"?: TtscLintRuleSetting;

  /** Match presence and absence assertions to `getBy*` or `queryBy*`. */
  "testing-library/prefer-presence-queries"?: TtscLintRuleSetting;

  /** Prefer `queryBy*` when waiting for disappearance. */
  "testing-library/prefer-query-by-disappearance"?: TtscLintRuleSetting;

  /** Prefer jest-dom document matchers for Testing Library queries. */
  "testing-library/prefer-query-matchers"?: TtscLintRuleSetting;

  /** Prefer `screen.*` over render-result queries. */
  "testing-library/prefer-screen-queries"?: TtscLintRuleSetting;

  /** Prefer `userEvent` over `fireEvent`. */
  "testing-library/prefer-user-event"?: TtscLintRuleSetting;

  /** Prefer `userEvent.setup()` over direct `userEvent.*` calls. */
  "testing-library/prefer-user-event-setup"?: TtscLintRuleSetting;

  /** Require conventional names for variables assigned from `render()`. */
  "testing-library/render-result-naming-convention"?: TtscLintRuleSetting;
}

/** TSDoc comment syntax rules. */
export interface ITtscLintTsdocRules {
  /** Validates basic TSDoc syntax in documentation comments. */
  "tsdoc/syntax"?: TtscLintRuleSetting;
}

/** Vitest test-source rules. */
export interface ITtscLintVitestRules {
  /** Requires every Vitest test body to contain an assertion. */
  "vitest/expect-expect"?: TtscLintRuleSetting;

  /** Rejects Vitest assertions inside conditional control flow. */
  "vitest/no-conditional-expect"?: TtscLintRuleSetting;

  /** Rejects Vitest test declarations inside conditional control flow. */
  "vitest/no-conditional-tests"?: TtscLintRuleSetting;

  /** Rejects skipped or todo Vitest tests. */
  "vitest/no-disabled-tests"?: TtscLintRuleSetting;

  /** Rejects done-callback parameters in Vitest tests and hooks. */
  "vitest/no-done-callback"?: TtscLintRuleSetting;

  /** Rejects focused Vitest tests such as `test.only`. */
  "vitest/no-focused-tests"?: TtscLintRuleSetting;

  /** Rejects duplicate Vitest titles within the same suite scope. */
  "vitest/no-identical-title"?: TtscLintRuleSetting;

  /** Rejects `expect` calls outside Vitest tests and hooks. */
  "vitest/no-standalone-expect"?: TtscLintRuleSetting;

  /** Rejects return statements directly inside Vitest test callbacks. */
  "vitest/no-test-return-statement"?: TtscLintRuleSetting;

  /** Prefers `toHaveLength` over asserting on `.length`. */
  "vitest/prefer-to-have-length"?: TtscLintRuleSetting;

  /** Requires synchronous function callbacks for `describe`. */
  "vitest/valid-describe-callback"?: TtscLintRuleSetting;

  /** Requires `expect(...)` to receive an argument and reach a matcher. */
  "vitest/valid-expect"?: TtscLintRuleSetting;

  /** Requires non-empty static Vitest titles. */
  "vitest/valid-title"?: TtscLintRuleSetting;
}

/**
 * Format-command rules configured by the top-level `format` block or explicit
 * rule entries.
 */
export interface ITtscLintFormatRules {
  /** Insert or remove trailing semicolons on ASI-terminated statements. */
  "format/semi"?: TtscLintRuleOptionsSetting<ITtscLintSemiRuleOptions>;

  /** Convert quoted string literals to the configured quote style. */
  "format/quotes"?: TtscLintRuleOptionsSetting<ITtscLintQuotesRuleOptions>;

  /** Add or remove trailing commas in multi-line lists. */
  "format/trailing-comma"?: TtscLintRuleOptionsSetting<ITtscLintTrailingCommaRuleOptions>;

  /** Reorder and group import declarations. */
  "format/sort-imports"?: TtscLintRuleOptionsSetting<ITtscLintSortImportsRuleOptions>;

  /** Normalize JSDoc spacing, tag names, and tag layout. */
  "format/jsdoc"?: TtscLintRuleOptionsSetting<ITtscLintJsdocRuleOptions>;

  /** Reflow supported list-shaped syntax when its flat form exceeds print width. */
  "format/print-width"?: TtscLintRuleOptionsSetting<ITtscLintPrintWidthRuleOptions>;
}

/** Contributor plugin rules keyed by namespace, for example `demo/no-demo`. */
export interface ITtscLintContributorRules {
  [ruleName: `${string}/${string}`]:
    | TtscLintRuleSetting
    | readonly [TtscLintSeverity, unknown]
    | undefined;
}
