# Lint Rule Tests

The engine-level tests of `@ttsc/lint` are Go tests in `packages/lint/linthost`, beside the rule sources, so they can call unexported engine internals directly. This directory holds no Go files.

## Fixture corpus

Annotated `// expect:` fixtures live as data under `packages/lint/test/testdata/corpus/`: positive fixtures at the top level, `clean/` negative controls, `positive/` regression inputs, and a few grouped cases whose `src/` companions belong to one entry. One table-driven test, `packages/lint/linthost/lint_fixture_corpus_test.go::TestLintFixtureCorpus`, loads each fixture through the production config path (`loadRules`, the engine cycle, a real Program and checker when a rule needs one, and the production diagnostic renderer) and compares the ordered `(file, rule, severity, line)` sequence.

A fixture that cannot run in the flat corpus carries an audited `@ttsc-corpus-skip(<constraint>)` directive. It must name exactly one rule and exactly one existing `packages/lint/linthost/*_test.go` file that proves the rule.

## Per-rule tests

The per-rule tests add what the data cannot express: negative controls with options, fix and suggestion snapshots, ranges and messages, and the type-aware command paths that switch to `seedLintProject` and `captureCommandOutput(run([]string{"check", ...}))`, which does invoke the real in-process command entrypoint.

Each file holds one `Test*` function named after what it asserts. Its opening doc comment starts with the test name and a `Verifies` headline, followed by a paragraph on the non-obvious branch and a numbered list of two to four steps, and ends with the `@evidence` acknowledgments the repository's contracts ask for.
