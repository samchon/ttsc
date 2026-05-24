# Agent A Knowledge

Scope: paths source lookup, emitted suffix mapping, shim `JsxEmit`, and the
allowJs feature test.

Findings:

- `@ttsc/paths` keeps TypeScript source extensions before JavaScript source
  extensions, so ambiguous extensionless aliases remain deterministic.
- Runtime suffix mapping follows source extension and `jsx: preserve`.
- The feature test runs real `ttsc` and asserts emitted files plus rewritten
  specifiers.

Outcome: no surviving proposal.
