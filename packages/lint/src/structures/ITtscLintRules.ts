import type {
  ITtscLintJsdocRuleOptions,
  ITtscLintPrintWidthRuleOptions,
  ITtscLintQuotesRuleOptions,
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
 * Camel-case rule severity map accepted by `ITtscLintConfig.rules`.
 *
 * Built-in rules are listed as concrete optional properties so TypeScript can
 * autocomplete rule names and reject typos. Contributor rules keep their
 * ESLint-style namespace with a slash, for example `demo/no-demo`.
 */
export interface ITtscLintRules {
  /** keeps overload declarations for the same member adjacent. */
  adjacentOverloadSignatures?: TtscLintRuleSetting;

  /** prefers `T[]` and `readonly T[]` over array helper types. */
  arrayType?: TtscLintRuleSetting;

  /** Reject `await` on non-thenable operands. **Type-aware** — uses the Checker. Autofixable (drops the `await`). */
  awaitThenable?: TtscLintRuleSetting;

  /** rejects TypeScript suppression comments such as `@ts-ignore`. */
  banTsComment?: TtscLintRuleSetting;

  /** rejects obsolete `tslint:` comments. */
  banTslintComment?: TtscLintRuleSetting;

  /** prefers `Record` for single index-signature object types. */
  consistentIndexedObjectStyle?: TtscLintRuleSetting;

  /** prefers `as` type assertions over angle-bracket assertions. */
  consistentTypeAssertions?: TtscLintRuleSetting;

  /** prefers interfaces for object-shaped type definitions. */
  consistentTypeDefinitions?: TtscLintRuleSetting;

  /** Prefer `import type {}` when imports are types-only. */
  consistentTypeImports?: TtscLintRuleSetting;

  /** `(req, opt = 1, req2)` → fail. */
  defaultParamLast?: TtscLintRuleSetting;

  /** prefers dot property access when a string-literal key is a valid identifier. */
  dotNotation?: TtscLintRuleSetting;

  /** requires strict equality operators. */
  eqeqeq?: TtscLintRuleSetting;

  /** `for (i = 0; i < 10; i--)` → fail. */
  forDirection?: TtscLintRuleSetting;

  /** prefers function-property signatures over method shorthand signatures. */
  methodSignatureStyle?: TtscLintRuleSetting;

  /** rejects `alert`, `confirm`, and `prompt`. */
  noAlert?: TtscLintRuleSetting;

  /** rejects `Array` constructor calls. */
  noArrayConstructor?: TtscLintRuleSetting;

  /** rejects `delete` on array elements. */
  noArrayDelete?: TtscLintRuleSetting;

  /** Reject `new Promise(async (...) => ...)`. */
  noAsyncPromiseExecutor?: TtscLintRuleSetting;

  /** rejects bitwise operators. */
  noBitwise?: TtscLintRuleSetting;

  /** rejects `arguments.caller` and `arguments.callee`. */
  noCaller?: TtscLintRuleSetting;

  /** rejects lexical declarations directly inside `case` clauses. */
  noCaseDeclarations?: TtscLintRuleSetting;

  /** rejects reassignment of class declarations. */
  noClassAssign?: TtscLintRuleSetting;

  /** rejects comparisons against `-0`. */
  noCompareNegZero?: TtscLintRuleSetting;

  /** rejects assignments inside conditions. */
  noCondAssign?: TtscLintRuleSetting;

  /** rejects confusing non-null assertions next to equality checks. */
  noConfusingNonNullAssertion?: TtscLintRuleSetting;

  /** rejects `console` calls. */
  noConsole?: TtscLintRuleSetting;

  /** Reject `while (true)` and other constant test expressions. */
  noConstantCondition?: TtscLintRuleSetting;

  /** rejects `continue` statements. */
  noContinue?: TtscLintRuleSetting;

  /** rejects control characters in regular expressions. */
  noControlRegex?: TtscLintRuleSetting;

  /** Reject `debugger`. */
  noDebugger?: TtscLintRuleSetting;

  /** rejects deleting variables. */
  noDeleteVar?: TtscLintRuleSetting;

  /** Function declared with two parameters of the same name. */
  noDupeArgs?: TtscLintRuleSetting;

  /** `if (a) ... else if (a) ...`. */
  noDupeElseIf?: TtscLintRuleSetting;

  /** `{ a: 1, a: 2 }`. */
  noDupeKeys?: TtscLintRuleSetting;

  /** Same case label twice in a `switch`. */
  noDuplicateCase?: TtscLintRuleSetting;

  /** rejects duplicate enum member values. */
  noDuplicateEnumValues?: TtscLintRuleSetting;

  /** rejects `delete` on dynamically computed property keys. */
  noDynamicDelete?: TtscLintRuleSetting;

  /** Reject `if (x) {}`, `while (x) {}`, etc. */
  noEmpty?: TtscLintRuleSetting;

  /** rejects empty regex character classes. */
  noEmptyCharacterClass?: TtscLintRuleSetting;

  /** Reject `function f() {}`. */
  noEmptyFunction?: TtscLintRuleSetting;

  /** rejects empty interfaces. */
  noEmptyInterface?: TtscLintRuleSetting;

  /** rejects empty object type literals. */
  noEmptyObjectType?: TtscLintRuleSetting;

  /** rejects empty destructuring patterns. */
  noEmptyPattern?: TtscLintRuleSetting;

  /** rejects empty class static blocks. */
  noEmptyStaticBlock?: TtscLintRuleSetting;

  /** rejects loose null comparisons. */
  noEqNull?: TtscLintRuleSetting;

  /** rejects `eval`. */
  noEval?: TtscLintRuleSetting;

  /** rejects reassignment of caught exceptions. */
  noExAssign?: TtscLintRuleSetting;

  /** Reject `any` annotations. Typically `"warning"` during migrations. */
  noExplicitAny?: TtscLintRuleSetting;

  /** rejects unnecessary `.bind()` calls. */
  noExtraBind?: TtscLintRuleSetting;

  /** rejects redundant boolean casts. */
  noExtraBooleanCast?: TtscLintRuleSetting;

  /** Reject `x!!`. Autofixable. */
  noExtraNonNullAssertion?: TtscLintRuleSetting;

  /** Reject `switch` case fall-through without an explicit comment. */
  noFallthrough?: TtscLintRuleSetting;

  /** rejects reassignment of function declarations. */
  noFuncAssign?: TtscLintRuleSetting;

  /** Hoist inline `type` modifiers into a single `import type {}`. Autofixable. */
  noImportTypeSideEffects?: TtscLintRuleSetting;

  /** rejects type annotations TypeScript can infer. */
  noInferrableTypes?: TtscLintRuleSetting;

  /** rejects function declarations nested in blocks. */
  noInnerDeclarations?: TtscLintRuleSetting;

  /** rejects irregular whitespace. */
  noIrregularWhitespace?: TtscLintRuleSetting;

  /** rejects `__iterator__`. */
  noIterator?: TtscLintRuleSetting;

  /** rejects labels. */
  noLabels?: TtscLintRuleSetting;

  /** rejects unnecessary standalone blocks. */
  noLoneBlocks?: TtscLintRuleSetting;

  /** rejects `if` as the only statement in an `else`. */
  noLonelyIf?: TtscLintRuleSetting;

  /** Reject decimal integer literals whose source text cannot round-trip as a JavaScript Number, including overflow-scale values. */
  noLossOfPrecision?: TtscLintRuleSetting;

  /** rejects misleading regex character classes. */
  noMisleadingCharacterClass?: TtscLintRuleSetting;

  /** rejects constructor-like signatures in interfaces. */
  noMisusedNew?: TtscLintRuleSetting;

  /** rejects enums that mix numeric and string members. */
  noMixedEnums?: TtscLintRuleSetting;

  /** Reject `a = b = 0` chains. */
  noMultiAssign?: TtscLintRuleSetting;

  /** rejects multiline string escapes. */
  noMultiStr?: TtscLintRuleSetting;

  /** rejects non-ambient namespaces. */
  noNamespace?: TtscLintRuleSetting;

  /** rejects negated conditions with an `else`. */
  noNegatedCondition?: TtscLintRuleSetting;

  /** rejects nested ternary expressions. */
  noNestedTernary?: TtscLintRuleSetting;

  /** rejects `new` expressions used only for side effects. */
  noNew?: TtscLintRuleSetting;

  /** rejects `Function` constructors. */
  noNewFunc?: TtscLintRuleSetting;

  /** rejects primitive wrapper constructors. */
  noNewWrappers?: TtscLintRuleSetting;

  /** rejects non-null assertions next to `??`. */
  noNonNullAssertedNullishCoalescing?: TtscLintRuleSetting;

  /** rejects non-null assertions on optional chains. */
  noNonNullAssertedOptionalChain?: TtscLintRuleSetting;

  /** rejects postfix non-null assertions. */
  noNonNullAssertion?: TtscLintRuleSetting;

  /** rejects calling global objects as functions. */
  noObjCalls?: TtscLintRuleSetting;

  /** rejects `new Object()`. */
  noObjectConstructor?: TtscLintRuleSetting;

  /** Reject octal literals. */
  noOctal?: TtscLintRuleSetting;

  /** Reject `\08`-style escapes. */
  noOctalEscape?: TtscLintRuleSetting;

  /** rejects `++` and `--`. */
  noPlusplus?: TtscLintRuleSetting;

  /** Reject `return` inside a Promise executor. */
  noPromiseExecutorReturn?: TtscLintRuleSetting;

  /** Reject `obj.__proto__`. */
  noProto?: TtscLintRuleSetting;

  /** Reject `obj.hasOwnProperty(...)`; use `Object.prototype.hasOwnProperty.call`. */
  noPrototypeBuiltins?: TtscLintRuleSetting;

  /** rejects repeated literal spaces in regexes. */
  noRegexSpaces?: TtscLintRuleSetting;

  /** Reject `require(...)` outside CommonJS modules. */
  noRequireImports?: TtscLintRuleSetting;

  /** rejects assignments in `return`. */
  noReturnAssign?: TtscLintRuleSetting;

  /** rejects `javascript:` URLs. */
  noScriptUrl?: TtscLintRuleSetting;

  /** Reject `x = x`, including destructured forms. */
  noSelfAssign?: TtscLintRuleSetting;

  /** Reject `x === x` and friends. */
  noSelfCompare?: TtscLintRuleSetting;

  /** rejects comma expressions. */
  noSequences?: TtscLintRuleSetting;

  /** rejects returned values from setters. */
  noSetterReturn?: TtscLintRuleSetting;

  /** rejects shadowing restricted globals. */
  noShadowRestrictedNames?: TtscLintRuleSetting;

  /** rejects sparse arrays. */
  noSparseArrays?: TtscLintRuleSetting;

  /** Reject `${}` inside non-template strings (probably a bug). */
  noTemplateCurlyInString?: TtscLintRuleSetting;

  /** rejects aliasing `this` to locals. */
  noThisAlias?: TtscLintRuleSetting;

  /** `throw "boom"` → fail. Use `throw new Error(...)`. */
  noThrowLiteral?: TtscLintRuleSetting;

  /** rejects initializing to `undefined`. */
  noUndefInit?: TtscLintRuleSetting;

  /** rejects constructor assignments already handled by parameter properties. */
  noUnnecessaryParameterPropertyAssignment?: TtscLintRuleSetting;

  /** rejects the global `undefined` identifier. */
  noUndefined?: TtscLintRuleSetting;

  /** Reject `<T extends unknown>` and similar. Autofixable. */
  noUnnecessaryTypeConstraint?: TtscLintRuleSetting;

  /** rejects redundant ternary expressions. */
  noUnneededTernary?: TtscLintRuleSetting;

  /** rejects unsafe class/interface declaration merging. */
  noUnsafeDeclarationMerging?: TtscLintRuleSetting;

  /** Reject `return` / `throw` inside a `finally`. */
  noUnsafeFinally?: TtscLintRuleSetting;

  /** rejects the unsafe `Function` type. */
  noUnsafeFunctionType?: TtscLintRuleSetting;

  /** rejects unsafe negation before relational checks. */
  noUnsafeNegation?: TtscLintRuleSetting;

  /** rejects expression statements with no effect. */
  noUnusedExpressions?: TtscLintRuleSetting;

  /** rejects labels that no `break` or `continue` targets. */
  noUnusedLabels?: TtscLintRuleSetting;

  /** rejects unnecessary `.call()` and `.apply()`. */
  noUselessCall?: TtscLintRuleSetting;

  /** rejects catch blocks that only rethrow. */
  noUselessCatch?: TtscLintRuleSetting;

  /** rejects unnecessary computed property keys. */
  noUselessComputedKey?: TtscLintRuleSetting;

  /** rejects unnecessary string concatenation. */
  noUselessConcat?: TtscLintRuleSetting;

  /** rejects empty constructors with no parameters. */
  noUselessConstructor?: TtscLintRuleSetting;

  /** rejects redundant empty `export {}` declarations in module files. */
  noUselessEmptyExport?: TtscLintRuleSetting;

  /** Reject `\.` and friends when not required. Autofixable. */
  noUselessEscape?: TtscLintRuleSetting;

  /** Reject `{ x: x }` in destructuring. Autofixable. */
  noUselessRename?: TtscLintRuleSetting;

  /** Reject `var`. Use `let` or `const`. Autofixable. */
  noVar?: TtscLintRuleSetting;

  /** Reject `with (...)`. */
  noWith?: TtscLintRuleSetting;

  /** Reject `String` / `Number` / `Boolean` / `Symbol` / `BigInt`. Autofixable. `Object` stays detection-only. */
  noWrapperObjectTypes?: TtscLintRuleSetting;

  /** Reject `{ foo: foo }`. Autofixable. */
  objectShorthand?: TtscLintRuleSetting;

  /** prefers compound assignment operators. */
  operatorAssignment?: TtscLintRuleSetting;

  /** Reject `as Literal` when `as const` would do. Autofixable. */
  preferAsConst?: TtscLintRuleSetting;

  /** When a `let` is never reassigned, demand `const`. Autofixable for single declarations. */
  preferConst?: TtscLintRuleSetting;

  /** requires explicit enum member initializers. */
  preferEnumInitializers?: TtscLintRuleSetting;

  /** prefers `**` over `Math.pow`. */
  preferExponentiationOperator?: TtscLintRuleSetting;

  /** Prefer `for..of` when the index is unused. */
  preferForOf?: TtscLintRuleSetting;

  /** prefers function type aliases over single-call interfaces. */
  preferFunctionType?: TtscLintRuleSetting;

  /** prefers literal enum member initializers over computed expressions. */
  preferLiteralEnumMember?: TtscLintRuleSetting;

  /** Use `namespace` not `module`. Autofixable. */
  preferNamespaceKeyword?: TtscLintRuleSetting;

  /** prefers spread arguments over `.apply`. */
  preferSpread?: TtscLintRuleSetting;

  /** prefers template literals over string concatenation. */
  preferTemplate?: TtscLintRuleSetting;

  /** requires a radix argument for `parseInt`. */
  radix?: TtscLintRuleSetting;

  /** requires generator functions to contain `yield`. */
  requireYield?: TtscLintRuleSetting;

  /** rejects triple-slash reference directives. */
  tripleSlashReference?: TtscLintRuleSetting;

  /** requires `Number.isNaN`/`isNaN` for `NaN` checks. */
  useIsNaN?: TtscLintRuleSetting;

  /** restricts `typeof` comparisons to valid strings. */
  validTypeof?: TtscLintRuleSetting;

  /** requires `var` declarations at the top of their scope. */
  varsOnTop?: TtscLintRuleSetting;

  /** rejects literal-first comparisons. */
  yoda?: TtscLintRuleSetting;

  /** Insert or remove trailing semicolons on ASI-terminated statements. */
  formatSemi?: TtscLintRuleOptionsSetting<ITtscLintSemiRuleOptions>;

  /** Convert quoted string literals to the configured quote style. */
  formatQuotes?: TtscLintRuleOptionsSetting<ITtscLintQuotesRuleOptions>;

  /** Add or remove trailing commas in multi-line lists. */
  formatTrailingComma?: TtscLintRuleOptionsSetting<ITtscLintTrailingCommaRuleOptions>;

  /** Reorder and group import declarations. */
  formatSortImports?: TtscLintRuleOptionsSetting<ITtscLintSortImportsRuleOptions>;

  /** Normalize JSDoc spacing, tag names, and tag layout. */
  formatJsdoc?: TtscLintRuleOptionsSetting<ITtscLintJsdocRuleOptions>;

  /** Reflow supported list-shaped syntax when its flat form exceeds print width. */
  formatPrintWidth?: TtscLintRuleOptionsSetting<ITtscLintPrintWidthRuleOptions>;

  /** @deprecated Use `formatSemi`. */
  "format/semi"?: never;

  /** @deprecated Use `formatQuotes`. */
  "format/quotes"?: never;

  /** @deprecated Use `formatTrailingComma`. */
  "format/trailing-comma"?: never;

  /** @deprecated Use `formatSortImports`. */
  "format/sort-imports"?: never;

  /** @deprecated Use `formatJsdoc`. */
  "format/jsdoc"?: never;

  /** @deprecated Use `formatPrintWidth`. */
  "format/print-width"?: never;

  /** Contributor plugin rules keyed by namespace, for example `demo/no-demo`. */
  [ruleName: `${string}/${string}`]:
    | TtscLintRuleSetting
    | readonly [TtscLintSeverity, unknown]
    | undefined;
}
