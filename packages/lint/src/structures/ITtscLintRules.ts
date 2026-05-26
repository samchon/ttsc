import type {
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
  ITtscLintBoundariesElementTypesRuleOptions,
  ITtscLintBoundariesEntryPointRuleOptions,
  ITtscLintBoundariesExternalRuleOptions,
  ITtscLintBoundariesNoPrivateRuleOptions,
  ITtscLintBoundariesNoUnknownRuleOptions,
  ITtscLintCypressUnsafeToChainCommandRuleOptions,
  ITtscLintDisableEnablePairRuleOptions,
  ITtscLintJsdocRuleOptions,
  ITtscLintNoRestrictedDisableRuleOptions,
  ITtscLintNoUseRuleOptions,
  ITtscLintPrintWidthRuleOptions,
  ITtscLintQuotesRuleOptions,
  ITtscLintReactRefreshOnlyExportComponentsRuleOptions,
  ITtscLintSemiRuleOptions,
  ITtscLintSortImportsRuleOptions,
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
 * Built-in rules are listed as concrete optional properties so TypeScript can
 * autocomplete rule names and reject typos. Built-in rule names intentionally
 * mirror ESLint-style kebab-case IDs; contributor rules keep their namespace
 * with a slash, for example `demo/no-demo`.
 */
export interface ITtscLintRules {
  /** keeps overload declarations for the same member adjacent. */
  "adjacent-overload-signatures"?: TtscLintRuleSetting;

  /** prefers `T[]` and `readonly T[]` over array helper types. */
  "array-type"?: TtscLintRuleSetting;

  /** Reject `await` on non-thenable operands. **Type-aware** — uses the Checker. Autofixable (drops the `await`). */
  "await-thenable"?: TtscLintRuleSetting;

  /** rejects TypeScript suppression comments such as `@ts-ignore`. */
  "ban-ts-comment"?: TtscLintRuleSetting;

  /** rejects obsolete `tslint:` comments. */
  "ban-tslint-comment"?: TtscLintRuleSetting;

  /** Enforce allowed dependency directions between configured source-path element types. */
  "boundaries/element-types"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesElementTypesRuleOptions>;

  /** Require cross-element imports to target the element's configured public entry files. */
  "boundaries/entry-point"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesEntryPointRuleOptions>;

  /** Restrict external package imports by package/specifier pattern. */
  "boundaries/external"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesExternalRuleOptions>;

  /** Reject imports of configured private files from outside their source-path element. */
  "boundaries/no-private"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesNoPrivateRuleOptions>;

  /** Reject relative imports whose resolved source file matches no configured element. */
  "boundaries/no-unknown"?: TtscLintRuleOptionsSetting<ITtscLintBoundariesNoUnknownRuleOptions>;

  /** requires a Cypress assertion before `cy.screenshot()`. */
  "cypress/assertion-before-screenshot"?: TtscLintRuleSetting;

  /** prefers `.should()` over `.and()` when starting Cypress assertion chains. */
  "cypress/no-and"?: TtscLintRuleSetting;

  /** rejects assigning the return value of Cypress commands. */
  "cypress/no-assigning-return-values"?: TtscLintRuleSetting;

  /** rejects async `before` and `beforeEach` callbacks in Cypress specs. */
  "cypress/no-async-before"?: TtscLintRuleSetting;

  /** rejects async Cypress test callbacks. */
  "cypress/no-async-tests"?: TtscLintRuleSetting;

  /** rejects chained `.get()` calls. */
  "cypress/no-chained-get"?: TtscLintRuleSetting;

  /** rejects `cy.debug()` and chained `.debug()` commands. */
  "cypress/no-debug"?: TtscLintRuleSetting;

  /** rejects `{ force: true }` on Cypress action commands. */
  "cypress/no-force"?: TtscLintRuleSetting;

  /** rejects `cy.pause()` and chained `.pause()` commands. */
  "cypress/no-pause"?: TtscLintRuleSetting;

  /** rejects numeric `cy.wait(...)` sleeps. */
  "cypress/no-unnecessary-waiting"?: TtscLintRuleSetting;

  /** rejects deprecated `cy.xpath()` selectors. */
  "cypress/no-xpath"?: TtscLintRuleSetting;

  /** requires `cy.get()` selectors to target `data-*` attributes when statically known. */
  "cypress/require-data-selectors"?: TtscLintRuleSetting;

  /** rejects chaining more commands after Cypress action commands. */
  "cypress/unsafe-to-chain-command"?: TtscLintRuleOptionsSetting<ITtscLintCypressUnsafeToChainCommandRuleOptions>;

  /** requires range `eslint-disable` directives to be paired with `eslint-enable`. */
  "eslint-comments/disable-enable-pair"?: TtscLintRuleOptionsSetting<ITtscLintDisableEnablePairRuleOptions>;

  /** rejects bare `eslint-enable` comments that re-enable named disables at once. */
  "eslint-comments/no-aggregating-enable"?: TtscLintRuleSetting;

  /** rejects disable directives that repeat an already active disable. */
  "eslint-comments/no-duplicate-disable"?: TtscLintRuleSetting;

  /** rejects disable directives for configured protected rules. */
  "eslint-comments/no-restricted-disable"?: TtscLintRuleOptionsSetting<ITtscLintNoRestrictedDisableRuleOptions>;

  /** rejects disable directives with no explicit rule list. */
  "eslint-comments/no-unlimited-disable"?: TtscLintRuleSetting;

  /** rejects disable directives that suppress no finding. */
  "eslint-comments/no-unused-disable"?: TtscLintRuleSetting;

  /** rejects enable directives that do not re-enable anything. */
  "eslint-comments/no-unused-enable"?: TtscLintRuleSetting;

  /** rejects inline lint directive comments. */
  "eslint-comments/no-use"?: TtscLintRuleOptionsSetting<ITtscLintNoUseRuleOptions>;

  /** requires lint directive comments to include a `--` description. */
  "eslint-comments/require-description"?: TtscLintRuleSetting;

  /** prefers `Record` for single index-signature object types. */
  "consistent-indexed-object-style"?: TtscLintRuleSetting;

  /** prefers `as` type assertions over angle-bracket assertions. */
  "consistent-type-assertions"?: TtscLintRuleSetting;

  /** prefers interfaces for object-shaped type definitions. */
  "consistent-type-definitions"?: TtscLintRuleSetting;

  /** Prefer `import type {}` when imports are types-only. */
  "consistent-type-imports"?: TtscLintRuleSetting;

  /** `(req, opt = 1, req2)` → fail. */
  "default-param-last"?: TtscLintRuleSetting;

  /** prefers dot property access when a string-literal key is a valid identifier. */
  "dot-notation"?: TtscLintRuleSetting;

  /** requires strict equality operators. */
  eqeqeq?: TtscLintRuleSetting;

  /** `for (i = 0; i < 10; i--)` → fail. */
  "for-direction"?: TtscLintRuleSetting;

  /** Enforce functional parameter style: no rest args/`arguments`, and optional parameter-count policy. */
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

  /** Reject interfaces/type literals that mix property, method, call, and index member kinds. */
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

  /** Require declared variable, parameter, and property types to be readonly/immutable. */
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

  /** prefers function-property signatures over method shorthand signatures. */
  "method-signature-style"?: TtscLintRuleSetting;

  /** rejects `alert`, `confirm`, and `prompt`. */
  "no-alert"?: TtscLintRuleSetting;

  /** rejects `Array` constructor calls. */
  "no-array-constructor"?: TtscLintRuleSetting;

  /** rejects `delete` on array elements. */
  "no-array-delete"?: TtscLintRuleSetting;

  /** Reject `new Promise(async (...) => ...)`. */
  "no-async-promise-executor"?: TtscLintRuleSetting;

  /** rejects bitwise operators. */
  "no-bitwise"?: TtscLintRuleSetting;

  /** rejects `arguments.caller` and `arguments.callee`. */
  "no-caller"?: TtscLintRuleSetting;

  /** rejects lexical declarations directly inside `case` clauses. */
  "no-case-declarations"?: TtscLintRuleSetting;

  /** rejects reassignment of class declarations. */
  "no-class-assign"?: TtscLintRuleSetting;

  /** rejects comparisons against `-0`. */
  "no-compare-neg-zero"?: TtscLintRuleSetting;

  /** rejects assignments inside conditions. */
  "no-cond-assign"?: TtscLintRuleSetting;

  /** rejects confusing non-null assertions next to equality checks. */
  "no-confusing-non-null-assertion"?: TtscLintRuleSetting;

  /** rejects `console` calls. */
  "no-console"?: TtscLintRuleSetting;

  /** Reject `while (true)` and other constant test expressions. */
  "no-constant-condition"?: TtscLintRuleSetting;

  /** rejects `continue` statements. */
  "no-continue"?: TtscLintRuleSetting;

  /** rejects control characters in regular expressions. */
  "no-control-regex"?: TtscLintRuleSetting;

  /** Reject `debugger`. */
  "no-debugger"?: TtscLintRuleSetting;

  /** rejects deleting variables. */
  "no-delete-var"?: TtscLintRuleSetting;

  /** Function declared with two parameters of the same name. */
  "no-dupe-args"?: TtscLintRuleSetting;

  /** `if (a) ... else if (a) ...`. */
  "no-dupe-else-if"?: TtscLintRuleSetting;

  /** `{ a: 1, a: 2 }`. */
  "no-dupe-keys"?: TtscLintRuleSetting;

  /** Same case label twice in a `switch`. */
  "no-duplicate-case"?: TtscLintRuleSetting;

  /** rejects duplicate enum member values. */
  "no-duplicate-enum-values"?: TtscLintRuleSetting;

  /** rejects `delete` on dynamically computed property keys. */
  "no-dynamic-delete"?: TtscLintRuleSetting;

  /** Reject `if (x) {}`, `while (x) {}`, etc. */
  "no-empty"?: TtscLintRuleSetting;

  /** rejects empty regex character classes. */
  "no-empty-character-class"?: TtscLintRuleSetting;

  /** Reject `function f() {}`. */
  "no-empty-function"?: TtscLintRuleSetting;

  /** rejects empty interfaces. */
  "no-empty-interface"?: TtscLintRuleSetting;

  /** rejects empty object type literals. */
  "no-empty-object-type"?: TtscLintRuleSetting;

  /** rejects empty destructuring patterns. */
  "no-empty-pattern"?: TtscLintRuleSetting;

  /** rejects empty class static blocks. */
  "no-empty-static-block"?: TtscLintRuleSetting;

  /** rejects loose null comparisons. */
  "no-eq-null"?: TtscLintRuleSetting;

  /** rejects `eval`. */
  "no-eval"?: TtscLintRuleSetting;

  /** rejects reassignment of caught exceptions. */
  "no-ex-assign"?: TtscLintRuleSetting;

  /** Reject `any` annotations. Typically `"warning"` during migrations. */
  "no-explicit-any"?: TtscLintRuleSetting;

  /** rejects unnecessary `.bind()` calls. */
  "no-extra-bind"?: TtscLintRuleSetting;

  /** rejects redundant boolean casts. */
  "no-extra-boolean-cast"?: TtscLintRuleSetting;

  /** Reject `x!!`. Autofixable. */
  "no-extra-non-null-assertion"?: TtscLintRuleSetting;

  /** Reject `switch` case fall-through without an explicit comment. */
  "no-fallthrough"?: TtscLintRuleSetting;

  /** rejects reassignment of function declarations. */
  "no-func-assign"?: TtscLintRuleSetting;

  /** Hoist inline `type` modifiers into a single `import type {}`. Autofixable. */
  "no-import-type-side-effects"?: TtscLintRuleSetting;

  /** rejects type annotations TypeScript can infer. */
  "no-inferrable-types"?: TtscLintRuleSetting;

  /** rejects function declarations nested in blocks. */
  "no-inner-declarations"?: TtscLintRuleSetting;

  /** rejects irregular whitespace. */
  "no-irregular-whitespace"?: TtscLintRuleSetting;

  /** rejects `__iterator__`. */
  "no-iterator"?: TtscLintRuleSetting;

  /** rejects labels. */
  "no-labels"?: TtscLintRuleSetting;

  /** rejects unnecessary standalone blocks. */
  "no-lone-blocks"?: TtscLintRuleSetting;

  /** rejects `if` as the only statement in an `else`. */
  "no-lonely-if"?: TtscLintRuleSetting;

  /** Reject decimal integer literals whose source text cannot round-trip as a JavaScript Number, including overflow-scale values. */
  "no-loss-of-precision"?: TtscLintRuleSetting;

  /** rejects misleading regex character classes. */
  "no-misleading-character-class"?: TtscLintRuleSetting;

  /** rejects constructor-like signatures in interfaces. */
  "no-misused-new"?: TtscLintRuleSetting;

  /** rejects enums that mix numeric and string members. */
  "no-mixed-enums"?: TtscLintRuleSetting;

  /** Reject `a = b = 0` chains. */
  "no-multi-assign"?: TtscLintRuleSetting;

  /** rejects multiline string escapes. */
  "no-multi-str"?: TtscLintRuleSetting;

  /** rejects non-ambient namespaces. */
  "no-namespace"?: TtscLintRuleSetting;

  /** rejects negated conditions with an `else`. */
  "no-negated-condition"?: TtscLintRuleSetting;

  /** rejects nested ternary expressions. */
  "no-nested-ternary"?: TtscLintRuleSetting;

  /** rejects `new` expressions used only for side effects. */
  "no-new"?: TtscLintRuleSetting;

  /** rejects `Function` constructors. */
  "no-new-func"?: TtscLintRuleSetting;

  /** rejects primitive wrapper constructors. */
  "no-new-wrappers"?: TtscLintRuleSetting;

  /** rejects non-null assertions next to `??`. */
  "no-non-null-asserted-nullish-coalescing"?: TtscLintRuleSetting;

  /** rejects non-null assertions on optional chains. */
  "no-non-null-asserted-optional-chain"?: TtscLintRuleSetting;

  /** rejects postfix non-null assertions. */
  "no-non-null-assertion"?: TtscLintRuleSetting;

  /** rejects calling global objects as functions. */
  "no-obj-calls"?: TtscLintRuleSetting;

  /** rejects `new Object()`. */
  "no-object-constructor"?: TtscLintRuleSetting;

  /** Reject octal literals. */
  "no-octal"?: TtscLintRuleSetting;

  /** Reject `\08`-style escapes. */
  "no-octal-escape"?: TtscLintRuleSetting;

  /** rejects `++` and `--`. */
  "no-plusplus"?: TtscLintRuleSetting;

  /** Reject `return` inside a Promise executor. */
  "no-promise-executor-return"?: TtscLintRuleSetting;

  /** Reject `obj.__proto__`. */
  "no-proto"?: TtscLintRuleSetting;

  /** Reject `obj.hasOwnProperty(...)`; use `Object.prototype.hasOwnProperty.call`. */
  "no-prototype-builtins"?: TtscLintRuleSetting;

  /** rejects repeated literal spaces in regexes. */
  "no-regex-spaces"?: TtscLintRuleSetting;

  /** Reject `require(...)` outside CommonJS modules. */
  "no-require-imports"?: TtscLintRuleSetting;

  /** rejects assignments in `return`. */
  "no-return-assign"?: TtscLintRuleSetting;

  /** rejects `javascript:` URLs. */
  "no-script-url"?: TtscLintRuleSetting;

  /** Reject `x = x`, including destructured forms. */
  "no-self-assign"?: TtscLintRuleSetting;

  /** Reject `x === x` and friends. */
  "no-self-compare"?: TtscLintRuleSetting;

  /** rejects comma expressions. */
  "no-sequences"?: TtscLintRuleSetting;

  /** rejects returned values from setters. */
  "no-setter-return"?: TtscLintRuleSetting;

  /** rejects shadowing restricted globals. */
  "no-shadow-restricted-names"?: TtscLintRuleSetting;

  /** rejects sparse arrays. */
  "no-sparse-arrays"?: TtscLintRuleSetting;

  /** Reject `${}` inside non-template strings (probably a bug). */
  "no-template-curly-in-string"?: TtscLintRuleSetting;

  /** rejects aliasing `this` to locals. */
  "no-this-alias"?: TtscLintRuleSetting;

  /** `throw "boom"` → fail. Use `throw new Error(...)`. */
  "no-throw-literal"?: TtscLintRuleSetting;

  /** rejects initializing to `undefined`. */
  "no-undef-init"?: TtscLintRuleSetting;

  /** rejects constructor assignments already handled by parameter properties. */
  "no-unnecessary-parameter-property-assignment"?: TtscLintRuleSetting;

  /** rejects the global `undefined` identifier. */
  "no-undefined"?: TtscLintRuleSetting;

  /** Reject `<T extends unknown>` and similar. Autofixable. */
  "no-unnecessary-type-constraint"?: TtscLintRuleSetting;

  /** rejects redundant ternary expressions. */
  "no-unneeded-ternary"?: TtscLintRuleSetting;

  /** rejects unsafe class/interface declaration merging. */
  "no-unsafe-declaration-merging"?: TtscLintRuleSetting;

  /** Reject `return` / `throw` inside a `finally`. */
  "no-unsafe-finally"?: TtscLintRuleSetting;

  /** rejects the unsafe `Function` type. */
  "no-unsafe-function-type"?: TtscLintRuleSetting;

  /** rejects unsafe negation before relational checks. */
  "no-unsafe-negation"?: TtscLintRuleSetting;

  /** rejects expression statements with no effect. */
  "no-unused-expressions"?: TtscLintRuleSetting;

  /** rejects labels that no `break` or `continue` targets. */
  "no-unused-labels"?: TtscLintRuleSetting;

  /** rejects unnecessary `.call()` and `.apply()`. */
  "no-useless-call"?: TtscLintRuleSetting;

  /** rejects catch blocks that only rethrow. */
  "no-useless-catch"?: TtscLintRuleSetting;

  /** rejects unnecessary computed property keys. */
  "no-useless-computed-key"?: TtscLintRuleSetting;

  /** rejects unnecessary string concatenation. */
  "no-useless-concat"?: TtscLintRuleSetting;

  /** rejects empty constructors with no parameters. */
  "no-useless-constructor"?: TtscLintRuleSetting;

  /** rejects redundant empty `export {}` declarations in module files. */
  "no-useless-empty-export"?: TtscLintRuleSetting;

  /** Reject `\.` and friends when not required. Autofixable. */
  "no-useless-escape"?: TtscLintRuleSetting;

  /** Reject `{ x: x }` in destructuring. Autofixable. */
  "no-useless-rename"?: TtscLintRuleSetting;

  /** Reject `var`. Use `let` or `const`. Autofixable. */
  "no-var"?: TtscLintRuleSetting;

  /** Reject `with (...)`. */
  "no-with"?: TtscLintRuleSetting;

  /** Reject `String` / `Number` / `Boolean` / `Symbol` / `BigInt`. Autofixable. `Object` stays detection-only. */
  "no-wrapper-object-types"?: TtscLintRuleSetting;

  /** Reject `{ foo: foo }`. Autofixable. */
  "object-shorthand"?: TtscLintRuleSetting;

  /** prefers compound assignment operators. */
  "operator-assignment"?: TtscLintRuleSetting;

  /** Reject `as Literal` when `as const` would do. Autofixable. */
  "prefer-as-const"?: TtscLintRuleSetting;

  /** When a `let` is never reassigned, demand `const`. Autofixable for single declarations. */
  "prefer-const"?: TtscLintRuleSetting;

  /** requires explicit enum member initializers. */
  "prefer-enum-initializers"?: TtscLintRuleSetting;

  /** prefers `**` over `Math.pow`. */
  "prefer-exponentiation-operator"?: TtscLintRuleSetting;

  /** Prefer `for..of` when the index is unused. */
  "prefer-for-of"?: TtscLintRuleSetting;

  /** prefers function type aliases over single-call interfaces. */
  "prefer-function-type"?: TtscLintRuleSetting;

  /** prefers literal enum member initializers over computed expressions. */
  "prefer-literal-enum-member"?: TtscLintRuleSetting;

  /** Use `namespace` not `module`. Autofixable. */
  "prefer-namespace-keyword"?: TtscLintRuleSetting;

  /** prefers spread arguments over `.apply`. */
  "prefer-spread"?: TtscLintRuleSetting;

  /** prefers template literals over string concatenation. */
  "prefer-template"?: TtscLintRuleSetting;

  /** requires a radix argument for `parseInt`. */
  radix?: TtscLintRuleSetting;

  /** rejects control characters in regular expression literals. Alias of the bare regex check. */
  "regexp/no-control-character"?: TtscLintRuleSetting;

  /** rejects duplicate literal characters inside simple regex character classes. */
  "regexp/no-dupe-characters-character-class"?: TtscLintRuleSetting;

  /** rejects empty alternatives such as `/a||b/`. */
  "regexp/no-empty-alternative"?: TtscLintRuleSetting;

  /** rejects empty capturing groups such as `/()/`. */
  "regexp/no-empty-capturing-group"?: TtscLintRuleSetting;

  /** rejects empty regex character classes. Alias of `no-empty-character-class`. */
  "regexp/no-empty-character-class"?: TtscLintRuleSetting;

  /** rejects empty non-capturing groups such as `/(?:)/`. */
  "regexp/no-empty-group"?: TtscLintRuleSetting;

  /** rejects empty lookaround assertions such as `/(?=)/`. */
  "regexp/no-empty-lookarounds-assertion"?: TtscLintRuleSetting;

  /** rejects misleading Unicode characters in regex classes. Alias of the bare misleading-character check. */
  "regexp/no-misleading-unicode-character"?: TtscLintRuleSetting;

  /** rejects single literal character classes such as `/[x]/`. */
  "regexp/no-useless-character-class"?: TtscLintRuleSetting;

  /** rejects unnecessary regex escapes. Alias of `no-useless-escape` for regex literals. */
  "regexp/no-useless-escape"?: TtscLintRuleSetting;

  /** rejects flags that do not affect the regex literal. */
  "regexp/no-useless-flag"?: TtscLintRuleSetting;

  /** rejects exact-one quantifiers such as `/a{1}/`. */
  "regexp/no-useless-quantifier"?: TtscLintRuleSetting;

  /** rejects equal min/max quantifiers such as `/a{2,2}/`. */
  "regexp/no-useless-two-nums-quantifier"?: TtscLintRuleSetting;

  /** rejects zero-repeat quantifiers such as `/a{0}/`. */
  "regexp/no-zero-quantifier"?: TtscLintRuleSetting;

  /** prefers `\d` over `[0-9]` in regex literals. */
  "regexp/prefer-d"?: TtscLintRuleSetting;

  /** prefers `+` over `{1,}` in regex literals. */
  "regexp/prefer-plus-quantifier"?: TtscLintRuleSetting;

  /** prefers `?` over `{0,1}` in regex literals. */
  "regexp/prefer-question-quantifier"?: TtscLintRuleSetting;

  /** prefers `*` over `{0,}` in regex literals. */
  "regexp/prefer-star-quantifier"?: TtscLintRuleSetting;

  /** prefers `\w` over `[A-Za-z0-9_]` in regex literals. */
  "regexp/prefer-w"?: TtscLintRuleSetting;

  /** requires regex literals to use the `u` or `v` flag. */
  "regexp/require-unicode-regexp"?: TtscLintRuleSetting;

  /** requires regex literals to use the `v` flag. */
  "regexp/require-unicode-sets-regexp"?: TtscLintRuleSetting;

  /** requires regex flags to follow canonical order. */
  "regexp/sort-flags"?: TtscLintRuleSetting;

  /** requires generator functions to contain `yield`. */
  "require-yield"?: TtscLintRuleSetting;

  /** requires TanStack Query keys to include variables read by queryFn. */
  "@tanstack/query/exhaustive-deps"?: TtscLintRuleSetting;

  /** requires infinite query page-param callbacks to appear after queryFn. */
  "@tanstack/query/infinite-query-property-order"?: TtscLintRuleSetting;

  /** requires mutation lifecycle callbacks to keep onMutate before error/settled handlers. */
  "@tanstack/query/mutation-property-order"?: TtscLintRuleSetting;

  /** rejects object rest destructuring over TanStack Query hook results. */
  "@tanstack/query/no-rest-destructuring"?: TtscLintRuleSetting;

  /** rejects passing whole TanStack Query hook results to React dependency arrays. */
  "@tanstack/query/no-unstable-deps"?: TtscLintRuleSetting;

  /** rejects queryFn callbacks that return no data in AST-local cases. */
  "@tanstack/query/no-void-query-fn"?: TtscLintRuleSetting;

  /** prefers extracted TanStack Query options over inline queryKey/queryFn objects. */
  "@tanstack/query/prefer-query-options"?: TtscLintRuleSetting;

  /** rejects creating QueryClient inside React component or hook bodies. */
  "@tanstack/query/stable-query-client"?: TtscLintRuleSetting;

  /** keeps React Fast Refresh component modules from exporting non-components. */
  "react-refresh/only-export-components"?: TtscLintRuleOptionsSetting<ITtscLintReactRefreshOnlyExportComponentsRuleOptions>;

  /** requires Playwright tests to contain at least one assertion. */
  "playwright/expect-expect"?: TtscLintRuleSetting;

  /** limits assertion count in a Playwright test body. */
  "playwright/max-expects"?: TtscLintRuleSetting;

  /** rejects expect calls under conditional branches in Playwright tests. */
  "playwright/no-conditional-expect"?: TtscLintRuleSetting;

  /** rejects conditional logic in Playwright test bodies. */
  "playwright/no-conditional-in-test"?: TtscLintRuleSetting;

  /** rejects duplicate Playwright setup and teardown hooks. */
  "playwright/no-duplicate-hooks"?: TtscLintRuleSetting;

  /** rejects repeated test.slow calls inside the same Playwright test. */
  "playwright/no-duplicate-slow"?: TtscLintRuleSetting;

  /** rejects ElementHandle-style Playwright APIs. */
  "playwright/no-element-handle"?: TtscLintRuleSetting;

  /** rejects page.$eval and page.$$eval. */
  "playwright/no-eval"?: TtscLintRuleSetting;

  /** rejects focused Playwright tests. */
  "playwright/no-focused-test"?: TtscLintRuleSetting;

  /** rejects Playwright force options. */
  "playwright/no-force-option"?: TtscLintRuleSetting;

  /** rejects getByTitle locators. */
  "playwright/no-get-by-title"?: TtscLintRuleSetting;

  /** rejects Playwright hooks. */
  "playwright/no-hooks"?: TtscLintRuleSetting;

  /** rejects nested test.step calls. */
  "playwright/no-nested-step"?: TtscLintRuleSetting;

  /** rejects networkidle load state and waitUntil options. */
  "playwright/no-networkidle"?: TtscLintRuleSetting;

  /** rejects first, last, and nth locator methods. */
  "playwright/no-nth-methods"?: TtscLintRuleSetting;

  /** rejects page.pause debugging calls. */
  "playwright/no-page-pause"?: TtscLintRuleSetting;

  /** rejects skipped Playwright tests. */
  "playwright/no-skipped-test"?: TtscLintRuleSetting;

  /** rejects slowed Playwright tests. */
  "playwright/no-slowed-test"?: TtscLintRuleSetting;

  /** rejects expect calls outside Playwright test blocks. */
  "playwright/no-standalone-expect"?: TtscLintRuleSetting;

  /** rejects page.waitForNavigation calls. */
  "playwright/no-wait-for-navigation"?: TtscLintRuleSetting;

  /** rejects page.waitForSelector calls. */
  "playwright/no-wait-for-selector"?: TtscLintRuleSetting;

  /** rejects page.waitForTimeout calls. */
  "playwright/no-wait-for-timeout"?: TtscLintRuleSetting;

  /** prefers locator-based Playwright APIs over page methods. */
  "playwright/prefer-locator"?: TtscLintRuleSetting;

  /** prefers toHaveCount for awaited count checks. */
  "playwright/prefer-to-have-count"?: TtscLintRuleSetting;

  /** prefers toHaveLength for awaited length checks. */
  "playwright/prefer-to-have-length"?: TtscLintRuleSetting;

  /** prefers Playwright web-first assertions. */
  "playwright/prefer-web-first-assertions"?: TtscLintRuleSetting;

  /** requires timeout options on toPass assertions. */
  "playwright/require-to-pass-timeout"?: TtscLintRuleSetting;

  /** requires a message on toThrow assertions. */
  "playwright/require-to-throw-message"?: TtscLintRuleSetting;

  /** validates Playwright describe callbacks. */
  "playwright/valid-describe-callback"?: TtscLintRuleSetting;

  /** validates Playwright expect call arity. */
  "playwright/valid-expect"?: TtscLintRuleSetting;

  /** validates Playwright test and describe titles. */
  "playwright/valid-title"?: TtscLintRuleSetting;

  /** rejects triple-slash reference directives. */
  "triple-slash-reference"?: TtscLintRuleSetting;

  /** validates basic TSDoc syntax in documentation comments. */
  "tsdoc/syntax"?: TtscLintRuleSetting;

  /** requires `Number.isNaN`/`isNaN` for `NaN` checks. */
  "use-isnan"?: TtscLintRuleSetting;

  /** restricts `typeof` comparisons to valid strings. */
  "valid-typeof"?: TtscLintRuleSetting;

  /** requires `var` declarations at the top of their scope. */
  "vars-on-top"?: TtscLintRuleSetting;

  /** rejects literal-first comparisons. */
  yoda?: TtscLintRuleSetting;

  /** detects Trojan Source bidi control characters. */
  "security/detect-bidi-characters"?: TtscLintRuleSetting;

  /** detects Buffer reads/writes with `noAssert` set to true. */
  "security/detect-buffer-noassert"?: TtscLintRuleSetting;

  /** detects child_process imports and non-literal exec commands. */
  "security/detect-child-process"?: TtscLintRuleSetting;

  /** detects disabling mustache-style escaping through `escapeMarkup = false`. */
  "security/detect-disable-mustache-escape"?: TtscLintRuleSetting;

  /** detects `eval` calls fed by non-literal expressions. */
  "security/detect-eval-with-expression"?: TtscLintRuleSetting;

  /** detects `new Buffer` with non-literal input. */
  "security/detect-new-buffer"?: TtscLintRuleSetting;

  /** detects Express csrf middleware configured before methodOverride. */
  "security/detect-no-csrf-before-method-override"?: TtscLintRuleSetting;

  /** detects filesystem calls with non-literal filename arguments. */
  "security/detect-non-literal-fs-filename"?: TtscLintRuleSetting;

  /** detects RegExp construction from non-literal patterns. */
  "security/detect-non-literal-regexp"?: TtscLintRuleSetting;

  /** detects `require` calls with non-literal module specifiers. */
  "security/detect-non-literal-require"?: TtscLintRuleSetting;

  /** detects dynamic bracket access that can hide object injection sinks. */
  "security/detect-object-injection"?: TtscLintRuleSetting;

  /** detects direct equality comparisons involving secret-like identifiers. */
  "security/detect-possible-timing-attacks"?: TtscLintRuleSetting;

  /** detects use of `crypto.pseudoRandomBytes`. */
  "security/detect-pseudoRandomBytes"?: TtscLintRuleSetting;

  /**
   * detects regular expressions with high-confidence catastrophic backtracking
   * shapes.
   */
  "security/detect-unsafe-regex"?: TtscLintRuleSetting;

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

  /** Contributor plugin rules keyed by namespace, for example `demo/no-demo`. */
  [ruleName: `${string}/${string}`]:
    | TtscLintRuleSetting
    | readonly [TtscLintSeverity, unknown]
    | undefined;
}
