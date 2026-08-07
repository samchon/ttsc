import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Shared lint configuration every package extends.
 *
 * Every package lays a `lint.config.ts` extending this file, as is or with the
 * rules that package alone needs. Keeping the rule set here is what stops two
 * packages from drifting into different definitions of correct.
 */
const config = {
  format: {
    // Formatting is applied by `ttsc format`, not reported as a lint failure,
    // so a formatting difference never competes with a real diagnostic.
    severity: "off",
    semi: true,
    singleQuote: false,
    arrowParens: "always",
    bracketSpacing: true,
    quoteProps: "as-needed",
    trailingComma: "all",
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    endOfLine: "lf",
    sortImports: {
      order: ["^@/(.*)$", "<THIRD_PARTY_MODULES>", "^[./]"],
    },
    jsDoc: true,
  },
  rules: {
    // Core: runtime correctness and modern JavaScript, not style policy.
    "default-param-last": "error",
    eqeqeq: "error",
    "for-direction": "error",
    "getter-return": "error",
    "guard-for-in": "error",
    "no-array-constructor": "error",
    "no-async-promise-executor": "error",
    "no-case-declarations": "error",
    "no-class-assign": "error",
    "no-compare-neg-zero": "error",
    "no-cond-assign": "error",
    "no-constructor-return": "error",
    "no-debugger": "error",
    "no-dupe-args": "error",
    "no-dupe-class-members": "error",
    "no-dupe-else-if": "error",
    "no-dupe-keys": "error",
    "no-duplicate-case": "error",
    // A type-only import beside a value import from the same module is the
    // shape `isolatedModules` forces a generator to emit, and the Nestia SDK
    // under `packages/api/src/functional` emits it. That tree is generated
    // output nobody may edit, and it enters every Program that consumes the api
    // package as source, so the accommodation belongs here rather than in one
    // package's override.
    "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
    "no-empty-pattern": "error",
    "no-eval": "error",
    "no-ex-assign": "error",
    "no-extend-native": "error",
    "no-fallthrough": "error",
    "no-func-assign": "error",
    "no-import-assign": "error",
    "no-invalid-this": "error",
    "no-irregular-whitespace": "error",
    "no-loss-of-precision": "error",
    "no-multi-assign": "error",
    "no-new-func": "error",
    "no-obj-calls": "error",
    "no-object-constructor": "error",
    "no-promise-executor-return": "error",
    "no-proto": "error",
    "no-prototype-builtins": "error",
    "no-redeclare": "error",
    "no-return-assign": "error",
    "no-self-assign": "error",
    "no-self-compare": "error",
    "no-sequences": "error",
    "no-setter-return": "error",
    "no-shadow-restricted-names": "error",
    "no-sparse-arrays": "error",
    "no-template-curly-in-string": "error",
    "no-this-before-super": "error",
    "no-unreachable": "error",
    "no-unsafe-finally": "error",
    "no-unsafe-negation": "error",
    "no-useless-assignment": "error",
    "no-useless-call": "error",
    "no-useless-catch": "error",
    "no-useless-escape": "error",
    "no-var": "error",
    "prefer-const": "error",
    radix: "error",
    "use-isnan": "error",
    "valid-typeof": "error",

    // RegExp: invalid, empty, or misleading expression structure.
    "regexp/no-dupe-characters-character-class": "error",
    "regexp/no-empty-alternative": "error",
    "regexp/no-empty-capturing-group": "error",
    "regexp/no-empty-group": "error",
    "regexp/no-useless-escape": "error",
    "regexp/no-useless-flag": "error",
    "regexp/no-zero-quantifier": "error",

    // Promise: chain shapes that swallow or misroute async errors.
    "promise/no-multiple-resolved": "error",
    "promise/no-new-statics": "error",
    "promise/no-return-in-finally": "error",
    "promise/no-return-wrap": "error",
    "promise/param-names": "error",
    "promise/spec-only": "error",

    // Security: concrete sinks with a low false-positive rate here.
    "security/detect-bidi-characters": "error",
    "security/detect-buffer-noassert": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-new-buffer": "error",
    "security/detect-pseudoRandomBytes": "error",
    "security/detect-unsafe-regex": "error",

    // TypeScript: type-aware correctness. `no-floating-promises` and
    // `no-misused-promises` are the two that catch real defects daily.
    "typescript/adjacent-overload-signatures": "error",
    "typescript/await-thenable": "error",
    "typescript/ban-ts-comment": "error",
    "typescript/no-array-delete": "error",
    "typescript/no-confusing-non-null-assertion": "error",
    "typescript/no-duplicate-enum-values": "error",
    "typescript/no-extra-non-null-assertion": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-for-in-array": "error",
    "typescript/no-invalid-void-type": "error",
    "typescript/no-misused-new": "error",
    "typescript/no-misused-promises": "error",
    "typescript/no-misused-spread": "error",
    "typescript/no-mixed-enums": "error",
    "typescript/no-non-null-asserted-nullish-coalescing": "error",
    "typescript/no-non-null-asserted-optional-chain": "error",
    "typescript/no-redundant-type-constituents": "error",
    "typescript/no-unnecessary-type-constraint": "error",
    "typescript/no-unsafe-declaration-merging": "error",
    "typescript/no-unsafe-function-type": "error",
    "typescript/no-wrapper-object-types": "error",
    "typescript/only-throw-error": "error",
    "typescript/prefer-as-const": "error",
    "typescript/prefer-promise-reject-errors": "error",
    "typescript/require-array-sort-compare": "error",
    "typescript/switch-exhaustiveness-check": "error",
    "typescript/use-unknown-in-catch-callback-variable": "error",

    // Unicorn: runtime and API traps, not broad style policy.
    "unicorn/error-message": "error",
    "unicorn/new-for-builtins": "error",
    "unicorn/no-await-in-promise-methods": "error",
    "unicorn/no-invalid-fetch-options": "error",
    "unicorn/no-invalid-remove-event-listener": "error",
    "unicorn/no-thenable": "error",
    "unicorn/no-useless-promise-resolve-reject": "error",
    "unicorn/prefer-node-protocol": "error",
  },
} satisfies ITtscLintConfig;

export default config;
