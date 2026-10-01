# Lint Rule Test Groups

These Go tests are the engine-internal coverage layer for `@ttsc/lint`'s rule corpus. They live next to the linthost library sources in a scratch module (materialized by `go test`) so they can import unexported engine internals directly.

## Testing contract

Annotated `// expect:` fixtures live as data under `packages/lint/test/testdata/corpus/` (positive fixtures, `clean/` negative controls and `positive/` regression inputs) and are executed by one table-driven test, `packages/lint/test/engine/lint_fixture_corpus_test.go::TestLintFixtureCorpus`. It loads each fixture through the production config path (`loadRules`, the engine cycle, a real Program and checker when a rule needs one, and the production diagnostic renderer) and compares the ordered `(file, rule, severity, line)` sequence. The per-rule Go tests in this tree add what the data cannot express: negative controls with options, fix and suggestion snapshots, ranges and messages, and the type-aware command paths that switch to `seedLintProject` + `captureCommandOutput(run([]string{"check", ...}))`, which DOES invoke the real in-process command entrypoint.

Per AGENTS.md §2.2: one `Test*` function per file, named after what it asserts; opening doc comment in the three-part shape (`Verifies …` headline, _why_ paragraph, numbered 2–4 step list).

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
