# Lint Rule Test Groups

These Go tests are the engine-internal coverage layer for `@ttsc/lint`'s
rule corpus. They live next to the linthost library sources in a
scratch module (materialized by `scripts/test-go-lint.cjs`) so they can
import unexported engine internals directly.

## Testing contract

The helper at `packages/lint/test/shared/helpers_test.go::assertRuleCorpusCase`
parses a fixture, calls `NewEngine(rules).Run(...)` **directly**, and
asserts on the normalized `(rule, severity, line)` triples. These tests
intentionally bypass the `ttsc lint` CLI binary; that path is covered
end-to-end by the TypeScript feature suite under
`tests/test-lint/src/features/`. Type-aware rules that need a real
`Program` (e.g. `typescript/strict-boolean-expressions`,
`typescript/no-misused-promises`) switch to `seedLintProject` +
`captureCommandOutput(run([]string{"check", ...}))` — that path DOES
invoke the real in-process command entrypoint.

Per AGENTS.md §2.2: one `Test*` function per file, named after what it
asserts; opening doc comment in the three-part shape (`Verifies …`
headline, *why* paragraph, numbered 2–4 step list).

## Family directories

Rule corpus tests are grouped by rule semantics, not by alphabetic ranges.

- `arrays-objects`: array, object, property access, and object-shape rules.
- `comments-directives`: source comments and TypeScript/ESLint directive rules.
- `control-flow`: branches, loops, labels, fallthrough, and expression-flow rules.
- `functions-classes`: functions, constructors, classes, methods, and call-shape rules.
- `imports-modules`: imports, namespaces, require usage, and module-reference rules.
- `react-refresh`: React Fast Refresh component-module boundary rules.
- `runtime-safety`: runtime hazards, dangerous globals, equality, eval, and diagnostic sanity rules.
- `solid`: Solid JSX, reactivity, import, event handler, and rendering preference rules.
- `strings-regex`: string literal, template, regex, whitespace, and octal-text rules.
- `style-suggestions`: low-risk style/suggestion rules that do not fit a narrower domain.
- `testing-library`: Testing Library query, render-result, waitFor, and user-event rules.
- `typescript`: TypeScript-only type, enum, assertion, namespace, and non-null rules.
- `variables-assignments`: variable declarations, assignment patterns, and self-reference rules.
