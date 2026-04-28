# `@ttsc/lint`

Lint rules hosted inside `ttsc` — same `tsgo.Program` and `Checker` as the
type-check pass, surfaced through the same diagnostics pipeline. One config,
one command, one error stream.

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "rules": {
          "no-var": "error",
          "no-explicit-any": "warn",
          "no-non-null-assertion": "off"
        }
      }
    ]
  }
}
```

```bash
npx ttsc --watch
# Type errors and lint violations both fail the build, in one pass.
```

## Why this exists

TypeScript projects run type-check and lint as two separate commands today.
Two parsers, two `Program` constructions, occasionally divergent type views.
ttsc's plugin model already lets a plugin bootstrap the same `tsgo.Program`
the compiler uses, so the lint pass rides that pipeline instead of standing
up its own.

## Status

`@ttsc/lint` is a **reference implementation**. Its purpose is to prove the
host slot works end-to-end — Program reuse, severity-aware diagnostics,
`tsconfig.json`-driven rule configuration — not to compete with
`eslint`/`@typescript-eslint` on rule depth.

The strongly-preferred outcome is for the `eslint` / `@typescript-eslint`
maintainers to take the work over. If that happens, this package gets
deprecated and re-points at theirs. Until it does, this is the canonical
case study of a non-trivial `ttsc` plugin.

## Severity

Each rule's severity is `"error" | "warn" | "off"`. Numeric forms (`0` /
`1` / `2`) are also accepted to match the ESLint convention.

- `"error"` — fail the build, render in red.
- `"warn"` — print in yellow, leave the exit code untouched.
- `"off"` — skip the rule entirely.

A rule's severity is **off by default** — every rule must be enabled
explicitly in `tsconfig.json`. The package ships no recommended preset on
purpose; pick what you actually want enforced.

## Bundled rules

The bundled rule corpus targets parity with the AST-implementable rules
from ESLint core and `@typescript-eslint`. Run `pnpm --filter @ttsc/lint
test` (or look at `go-plugin/lint/rules_*_test.go`) to see exactly what
each rule catches.

### ESLint core — Possible Problems

`for-direction`, `no-async-promise-executor`, `no-class-assign`,
`no-compare-neg-zero`, `no-cond-assign`, `no-constant-condition`,
`no-control-regex`, `no-debugger`, `no-dupe-args`, `no-dupe-else-if`,
`no-dupe-keys`, `no-duplicate-case`, `no-empty-character-class`,
`no-empty-pattern`, `no-ex-assign`, `no-fallthrough`, `no-func-assign`,
`no-inner-declarations`, `no-irregular-whitespace`, `no-loss-of-precision`,
`no-misleading-character-class`, `no-obj-calls`,
`no-promise-executor-return`, `no-prototype-builtins`, `no-self-assign`,
`no-self-compare`, `no-sparse-arrays`, `no-template-curly-in-string`,
`no-unsafe-finally`, `no-unsafe-negation`, `use-isnan`, `valid-typeof`.

### ESLint core — Suggestions

`eqeqeq`, `no-alert`, `no-array-constructor`, `no-bitwise`, `no-caller`,
`no-case-declarations`, `no-console`, `no-continue`, `no-delete-var`,
`no-empty`, `no-empty-function`, `no-eq-null`, `no-eval`, `no-extra-bind`,
`no-extra-boolean-cast`, `no-iterator`, `no-labels`, `no-lone-blocks`,
`no-lonely-if`, `no-multi-assign`, `no-multi-str`,
`no-negated-condition`, `no-nested-ternary`, `no-new`, `no-new-func`,
`no-new-wrappers`, `no-object-constructor`, `no-octal`, `no-octal-escape`,
`no-plusplus`, `no-proto`, `no-regex-spaces`, `no-return-assign`,
`no-script-url`, `no-sequences`, `no-shadow-restricted-names`,
`no-throw-literal`, `no-undef-init`, `no-undefined`, `no-unneeded-ternary`,
`no-unused-expressions`, `no-useless-call`, `no-useless-catch`,
`no-useless-computed-key`, `no-useless-concat`, `no-useless-rename`,
`no-var`, `no-with`, `object-shorthand`, `operator-assignment`,
`prefer-exponentiation-operator`, `prefer-spread`, `prefer-template`,
`radix`, `require-yield`, `vars-on-top`, `yoda`.

### `@typescript-eslint`-equivalent

`adjacent-overload-signatures`, `array-type`, `ban-ts-comment`,
`ban-tslint-comment`, `consistent-indexed-object-style`,
`consistent-type-imports`, `no-array-delete`,
`no-confusing-non-null-assertion`, `no-duplicate-enum-values`,
`no-empty-interface`, `no-empty-object-type`, `no-explicit-any`,
`no-extra-non-null-assertion`, `no-inferrable-types`, `no-misused-new`,
`no-namespace`, `no-non-null-asserted-optional-chain`,
`no-non-null-assertion`, `no-require-imports`, `no-this-alias`,
`prefer-as-const`, `prefer-enum-initializers`, `prefer-for-of`,
`prefer-function-type`, `prefer-namespace-keyword`,
`triple-slash-reference`.

That's **115 rules total**, every one with at least one positive and
one negative test case in `go-plugin/lint/rules_*_test.go`.

## Limitations

- The default-off posture means `@ttsc/lint` is silent unless you opt in.
- A rule's body runs against a single source file at a time; no
  cross-file scope analysis (yet).
- Auto-fix is not implemented. The output is diagnostic-only.

## License

MIT — same as the rest of ttsc.
