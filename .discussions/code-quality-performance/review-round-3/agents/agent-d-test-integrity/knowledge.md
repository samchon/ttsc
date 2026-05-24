# Agent D Knowledge Base - Test Integrity

Scope read: changed Go unit tests, TypeScript feature tests, root test scripts,
and fixture-facing assertions.

Findings:

- No tests were deleted, skipped, or downgraded to snapshot-only assertions.
- No `.only`, `.skip`, empty assertion, or forced green path was introduced in
  changed test code.
- Existing platform gating is limited to legitimate OS behavior, not a failure
  escape hatch.
- `tests/test-ttsc/src/features/go/test_ttsc_go_package_tests_pass.ts` did not
  follow the repository doc-comment rule because the headline began with
  "Runs..." instead of "Verifies...".
- The banner generated-loader test was too brittle when it asserted one exact
  generated line. The behavior being pinned is default-first, guard-before-
  unwrap ordering; the assertion should target that flow.

Proposals:

- Fix the TS feature doc headline to start with `Verifies`.
- Replace the banner exact-line assertion with ordered substring checks that
  preserve the behavioral invariant without locking formatting.
