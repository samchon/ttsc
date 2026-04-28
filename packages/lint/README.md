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

The bundled rule corpus targets parity with the most common ESLint /
`@typescript-eslint` rules that work off the AST alone. Each rule sees the
same node stream, so adding a new one is mechanical.

### ESLint-equivalent (JavaScript)

| Rule | What it catches |
| --- | --- |
| `no-var` | `var` declarations (use `let` / `const`) |
| `no-debugger` | `debugger` statements |
| `no-with` | `with (...)` blocks |
| `no-eval` | direct `eval()` calls |
| `no-empty` | empty blocks / catch / finally |
| `no-empty-function` | empty function / arrow / method bodies |
| `no-throw-literal` | `throw "..."` / `throw 42` |
| `no-self-assign` | `x = x` |
| `no-self-compare` | `x === x` and friends |
| `no-duplicate-case` | duplicated `case` labels in a `switch` |
| `no-dupe-keys` | duplicated object-literal keys |
| `no-dupe-args` | duplicated parameter names |
| `no-sparse-arrays` | `[, , 1]` literals |
| `no-extra-boolean-cast` | `!!x` / `Boolean(x)` in a boolean context |
| `no-unsafe-negation` | `!a in b` / `!a instanceof b` |
| `no-template-curly-in-string` | `${...}` inside a regular string |
| `no-compare-neg-zero` | `x === -0` |
| `for-direction` | `for` loops whose update goes the wrong way |
| `no-cond-assign` | assignment inside `if (a = b)` |
| `no-constant-condition` | `if (true)` / `while (1)` |
| `no-iterator` | `obj.__iterator__` access |
| `no-proto` | `obj.__proto__` access |
| `no-undef-init` | `let x = undefined` |
| `no-useless-concat` | `"a" + "b"` of two literals |
| `radix` | `parseInt(x)` without a radix |
| `use-isnan` | `x === NaN` |
| `valid-typeof` | `typeof x === "stirng"` |
| `eqeqeq` | `==` / `!=` |
| `no-console` | `console.log()` etc. |
| `no-unsafe-finally` | `return` / `break` in `finally` |
| `no-array-constructor` | `new Array()` / `Array(...)` |
| `no-new-wrappers` | `new String / Number / Boolean` |
| `no-script-url` | `"javascript:..."` literals |
| `no-multi-str` | `"line one\` continuation strings |
| `no-octal` | `010` octal literals |

### `@typescript-eslint`-equivalent

| Rule | What it catches |
| --- | --- |
| `no-explicit-any` | `: any` annotations |
| `no-non-null-assertion` | `x!` postfix |
| `no-empty-interface` | empty `interface { }` |
| `no-inferrable-types` | `: number = 5` redundant annotation |
| `no-namespace` | `namespace X {}` (TypeScript-only module) |
| `no-this-alias` | `const self = this` |
| `prefer-as-const` | `as 'foo'` instead of `as const` |
| `no-require-imports` | CommonJS `require()` |
| `ban-ts-comment` | `@ts-ignore` / `@ts-nocheck` |

## Limitations

- The default-off posture means `@ttsc/lint` is silent unless you opt in.
- A rule's body runs against a single source file at a time; no
  cross-file scope analysis (yet).
- Auto-fix is not implemented. The output is diagnostic-only.

## License

MIT — same as the rest of ttsc.
