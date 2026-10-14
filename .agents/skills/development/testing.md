# Testing

Test behavior at the layer that owns it. Keep portable semantics in unit tests; add an E2E check only when direct unit calls cannot verify a real connection. The [test contracts](../contracts/testing.md) define the evidence every test must provide.

## Unit Tests

| Kind | Location and owner |
| --- | --- |
| Go unit | A `*_test.go` beside its Go package, with one `Test*` entry per file. The Go test runner executes it in the package process. |
| TypeScript unit | A `test_<name>.ts` under `tests/test-*/src/features/`, exporting `test_<name>` and calling maintained source directly. The suite's unit runner discovers it. |

## E2E Tests

An E2E entry lives at `tests/test-e2e/src/features/test_e2e_*.ts`, with scenarios under `<package>/scenes/case_*.ts` and shared static inputs under `tests/test-e2e/fixtures/<package>/`. Add compatible scenarios to an existing batch; do not give every semantic case a separate native run and fixture project. Follow the [E2E contracts](../contracts/e2e.md) for preparation, isolation, and coverage.

## Test Conventions

- Observe behavior through product seams or product output; tests must not replace `fs` functions or `process.env`.
- Start each test case with a `Verifies` headline, a short reason, and two to four numbered steps.
- Reuse `tests/utils` and the suite's own `internal/`, never another suite's.
